// API Route: /api/pending-review/[id]/complete
// Unified completion endpoint for wrapups, messages, and leads

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { wrapupDrafts, messages, customers, users, calls, triageItems } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getAgencyZoomClient } from "@/lib/api/agencyzoom";
import { createClient } from "@/lib/supabase/server";

// =============================================================================
// TYPES
// =============================================================================

interface CompleteRequest {
  itemType: 'wrapup' | 'message' | 'lead';
  action: 'note' | 'ticket' | 'lead' | 'skip' | 'acknowledge' | 'void' | 'ncm' | 'delete';
  customerId?: string;
  isLead?: boolean; // true if matched to a lead (not a customer)
  noteContent?: string;
  reviewerId?: string; // ID of the user who reviewed this item
  ticketDetails?: {
    subject?: string;
    description?: string;
    priority?: 'low' | 'medium' | 'high';
    assigneeAgentId?: number; // AgencyZoom CSR ID - USER SELECTED
    appendToTicketId?: number; // Existing ticket ID to append to instead of creating new
  };
  leadDetails?: {
    firstName: string;
    lastName: string;
    email?: string;
    phone?: string;
    source?: string;
  };
  // For grouped messages - acknowledge all messages from same phone number
  messageIds?: string[];
  // For delete action
  deleteReason?: string;
  deleteNotes?: string;
}

// NCM (No Customer Match) customer ID in AgencyZoom
// This is a placeholder customer used for service requests from unknown callers
const NCM_CUSTOMER_ID = process.env.NCM_CUSTOMER_ID || '0'; // Default to 0 if not set

// Undo token expiration (5 seconds)
const UNDO_EXPIRATION_MS = 5000;

// Generate a simple undo token
function generateUndoToken(): string {
  return `undo_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}

// Helper to get the current user's database ID from auth session
async function getCurrentUserId(providedId?: string): Promise<string | null> {
  // If a valid ID was provided, use it
  if (providedId) {
    return providedId;
  }

  // Otherwise, try to get from auth session
  try {
    const supabase = await createClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();

    if (!authUser?.email) {
      return null;
    }

    // Look up user ID by email
    const [dbUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, authUser.email))
      .limit(1);

    return dbUser?.id || null;
  } catch (error) {
    console.error("[Complete API] Failed to get current user:", error);
    return null;
  }
}

// =============================================================================
// HELPERS
// =============================================================================

// Helper to fetch call transcript from the calls table
async function getCallTranscript(callId: string | null): Promise<string | null> {
  if (!callId) return null;

  try {
    const [call] = await db
      .select({
        transcription: calls.transcription,
        transcriptionSegments: calls.transcriptionSegments,
      })
      .from(calls)
      .where(eq(calls.id, callId))
      .limit(1);

    if (!call) return null;

    // If we have segments, format them nicely with speaker labels
    if (call.transcriptionSegments && Array.isArray(call.transcriptionSegments) && call.transcriptionSegments.length > 0) {
      const formattedSegments = call.transcriptionSegments.map((segment: any) => {
        const speaker = segment.speaker || segment.channel === 0 ? 'Agent' : 'Caller';
        const text = segment.text || segment.transcript || '';
        return `${speaker}: ${text}`;
      }).join('\n');
      return formattedSegments;
    }

    // Fall back to plain transcription
    return call.transcription || null;
  } catch (error) {
    console.error("[Complete API] Failed to fetch call transcript:", error);
    return null;
  }
}

function formatNoteText(
  type: string,
  content: string,
  metadata?: {
    phone?: string;
    requestType?: string;
    agentName?: string;
    transcript?: string | null;
  }
): string {
  const timestamp = new Date().toLocaleString("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "America/Chicago",
  });

  const lines = [];

  if (type === 'wrapup') {
    lines.push("Call Note:");
  } else if (type === 'message') {
    lines.push("SMS Message:");
  }

  lines.push(content);
  lines.push("");

  if (metadata?.requestType) {
    lines.push(`Request Type: ${metadata.requestType}`);
  }
  if (metadata?.phone) {
    lines.push(`Phone: ${metadata.phone}`);
  }
  if (metadata?.agentName) {
    lines.push(`Handled by: ${metadata.agentName}`);
  }

  lines.push(`Date/Time: ${timestamp}`);

  // Add transcript at the end if available
  if (metadata?.transcript) {
    lines.push("");
    lines.push("--- Call Transcript ---");
    lines.push(metadata.transcript);
  }

  return lines.join("\n");
}

// =============================================================================
// POST - Complete pending item
// =============================================================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: itemId } = await params;
    const body: CompleteRequest = await request.json();
    const tenantId = process.env.DEFAULT_TENANT_ID;

    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    // Get the reviewer ID - either from body or from auth session
    const reviewerId = await getCurrentUserId(body.reviewerId);

    // Get AgencyZoom client if needed
    const azClient = body.action !== 'skip' && body.action !== 'acknowledge'
      ? await getAgencyZoomClient()
      : null;

    let result: {
      success: boolean;
      action: string;
      message?: string;
      noteId?: number;
      ticketId?: number;
      leadId?: number;
      undoToken?: string;
    } = { success: false, action: body.action };

    // =======================================================================
    // HANDLE WRAPUP
    // =======================================================================
    if (body.itemType === 'wrapup') {
      const [wrapup] = await db
        .select()
        .from(wrapupDrafts)
        .where(eq(wrapupDrafts.id, itemId))
        .limit(1);

      if (!wrapup) {
        return NextResponse.json({ error: "Wrapup not found" }, { status: 404 });
      }

      if (body.action === 'skip') {
        const undoToken = generateUndoToken();
        const undoExpiresAt = new Date(Date.now() + UNDO_EXPIRATION_MS);

        await db
          .update(wrapupDrafts)
          .set({
            status: "completed",
            reviewerDecision: "skipped",
            outcome: "skipped",
            completionAction: "skipped",
            completedAt: new Date(),
            reviewerId: reviewerId,
            reviewedAt: new Date(),
            undoToken,
            undoExpiresAt,
          })
          .where(eq(wrapupDrafts.id, itemId));

        return NextResponse.json({ success: true, action: "skip", message: "Wrapup skipped", undoToken });
      }

      if (body.action === 'void') {
        const undoToken = generateUndoToken();
        const undoExpiresAt = new Date(Date.now() + UNDO_EXPIRATION_MS);

        await db
          .update(wrapupDrafts)
          .set({
            status: "completed",
            reviewerDecision: "voided",
            outcome: "voided",
            completionAction: "voided",
            completedAt: new Date(),
            reviewerId: reviewerId,
            reviewedAt: new Date(),
            undoToken,
            undoExpiresAt,
          })
          .where(eq(wrapupDrafts.id, itemId));

        return NextResponse.json({ success: true, action: "void", message: "Wrapup voided", undoToken });
      }

      if (body.action === 'delete') {
        if (!body.deleteReason) {
          return NextResponse.json({ error: "Delete reason required" }, { status: 400 });
        }

        const undoToken = generateUndoToken();
        const undoExpiresAt = new Date(Date.now() + UNDO_EXPIRATION_MS);

        await db
          .update(wrapupDrafts)
          .set({
            status: "completed",
            reviewerDecision: "deleted",
            outcome: "deleted",
            completionAction: "deleted",
            completedAt: new Date(),
            reviewerId: reviewerId,
            reviewedAt: new Date(),
            deleteReason: body.deleteReason,
            deleteNotes: body.deleteNotes || null,
            deletedById: reviewerId,
            deletedAt: new Date(),
            undoToken,
            undoExpiresAt,
          })
          .where(eq(wrapupDrafts.id, itemId));

        return NextResponse.json({ success: true, action: "delete", message: "Item deleted", undoToken });
      }

      // Extract IDs and check if it's a lead or customer
      const aiExtraction = wrapup.aiExtraction as {
        agencyZoomCustomerId?: string;
        agencyZoomLeadId?: string;
        isLead?: boolean;
      } | null;

      const isLead = body.isLead || aiExtraction?.isLead;

      // Get the ID - prefer explicit body.customerId, then check aiExtraction
      let contactId: number | null = null;
      if (body.customerId) {
        contactId = parseInt(body.customerId);
      } else if (isLead && aiExtraction?.agencyZoomLeadId) {
        contactId = parseInt(aiExtraction.agencyZoomLeadId);
      } else if (!isLead && aiExtraction?.agencyZoomCustomerId) {
        contactId = parseInt(aiExtraction.agencyZoomCustomerId);
      }

      if (!contactId && (body.action === 'note' || body.action === 'ticket')) {
        return NextResponse.json({ error: "Customer or Lead ID required" }, { status: 400 });
      }

      if (body.action === 'note' && contactId && azClient) {
        // Fetch call transcript if available
        const transcript = await getCallTranscript(wrapup.callId);

        const noteText = formatNoteText('wrapup', body.noteContent || wrapup.aiCleanedSummary || wrapup.summary || '', {
          phone: wrapup.customerPhone || undefined,
          requestType: wrapup.requestType || undefined,
          transcript: transcript,
        });

        // Use addLeadNote for leads, addNote for customers
        const noteResult = isLead
          ? await azClient.addLeadNote(contactId, noteText)
          : await azClient.addNote(contactId, noteText);

        if (noteResult.success) {
          await db
            .update(wrapupDrafts)
            .set({
              status: "completed",
              reviewerDecision: "approved",
              outcome: isLead ? "lead_note_posted" : "note_posted",
              agencyzoomNoteId: noteResult.id?.toString(),
              completedAt: new Date(),
              reviewerId: reviewerId,
              reviewedAt: new Date(),
            })
            .where(eq(wrapupDrafts.id, itemId));

          result = { success: true, action: "note", noteId: noteResult.id };
        } else {
          return NextResponse.json({ error: `Failed to post note to ${isLead ? 'lead' : 'customer'}` }, { status: 500 });
        }
      }

      if (body.action === 'ticket' && contactId) {
        // Fetch call transcript if available
        const transcript = await getCallTranscript(wrapup.callId);

        // Build summary with transcript appended
        let summaryWithTranscript = body.noteContent || wrapup.aiCleanedSummary || wrapup.summary || '';
        if (transcript) {
          summaryWithTranscript += '\n\n--- Call Transcript ---\n' + transcript;
        }

        // Check if we're appending to an existing ticket
        const appendToTicketId = body.ticketDetails?.appendToTicketId;

        if (appendToTicketId) {
          // APPEND MODE: Add note to existing service ticket
          console.log(`[Complete API] Appending to existing ticket ${appendToTicketId}`);

          // Format the note content
          const timestamp = new Date().toLocaleString("en-US", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
            timeZone: "America/Chicago",
          });

          const noteContent = [
            '📞 Additional Call Note Added',
            `Date: ${timestamp}`,
            '',
            summaryWithTranscript,
            '',
            `Request Type: ${wrapup.requestType || 'General'}`,
            wrapup.agentName ? `Handled by: ${wrapup.agentName}` : '',
          ].filter(Boolean).join('\n');

          // Try to add note to the service ticket
          if (azClient) {
            const ticketNoteResult = await azClient.addServiceTicketNote(appendToTicketId, noteContent);

            if (ticketNoteResult.success) {
              // Update wrapup record
              await db
                .update(wrapupDrafts)
                .set({
                  status: "completed",
                  reviewerDecision: "approved",
                  outcome: "ticket_appended",
                  agencyzoomTicketId: appendToTicketId.toString(),
                  completedAt: new Date(),
                  reviewerId: reviewerId,
                  reviewedAt: new Date(),
                })
                .where(eq(wrapupDrafts.id, itemId));

              result = { success: true, action: "ticket", ticketId: appendToTicketId, message: "Note appended to existing ticket" };
            } else {
              // Fallback: Post as customer note instead
              console.log('[Complete API] Ticket note failed, posting as customer note');
              const noteResult = isLead
                ? await azClient.addLeadNote(contactId, `[Appended to Service Request #${appendToTicketId}]\n\n${noteContent}`)
                : await azClient.addNote(contactId, `[Appended to Service Request #${appendToTicketId}]\n\n${noteContent}`);

              if (noteResult.success) {
                await db
                  .update(wrapupDrafts)
                  .set({
                    status: "completed",
                    reviewerDecision: "approved",
                    outcome: "ticket_appended",
                    agencyzoomTicketId: appendToTicketId.toString(),
                    agencyzoomNoteId: noteResult.id?.toString(),
                    completedAt: new Date(),
                    reviewerId: reviewerId,
                    reviewedAt: new Date(),
                  })
                  .where(eq(wrapupDrafts.id, itemId));

                result = { success: true, action: "ticket", ticketId: appendToTicketId, noteId: noteResult.id, message: "Note posted to customer (ticket note API unavailable)" };
              } else {
                return NextResponse.json({ error: "Failed to append note" }, { status: 500 });
              }
            }
          } else {
            return NextResponse.json({ error: "AgencyZoom client not available" }, { status: 500 });
          }
        } else {
          // CREATE NEW MODE: Create service request via Zapier webhook
          const aiExtract = wrapup.aiExtraction as {
            serviceRequestTypeId?: number;
            serviceRequestTypeName?: string;
            priorityId?: number;
            policyNumbers?: string[];
            agencyZoomEmail?: string;
          } | null;

          // Get customer email - check extraction, wrapup, then lookup from database
          let customerEmail = aiExtract?.agencyZoomEmail || wrapup.customerEmail || null;

          // If no email found and we have a customer ID, look it up from the database
          if (!customerEmail && contactId && !isLead) {
            try {
              const [matchedCustomer] = await db
                .select({ email: customers.email })
                .from(customers)
                .where(eq(customers.agencyzoomId, contactId.toString()))
                .limit(1);

              if (matchedCustomer?.email) {
                customerEmail = matchedCustomer.email;
                console.log(`[Complete API] Looked up customer email: ${customerEmail} for AZ ID ${contactId}`);
              }
            } catch (lookupError) {
              console.error('[Complete API] Error looking up customer email:', lookupError);
            }
          }

          const serviceRequestPayload = {
            customerId: contactId.toString(),
            customerName: wrapup.customerName || 'Unknown',
            customerEmail: customerEmail,
            customerPhone: wrapup.customerPhone || null,
            customerType: isLead ? 'lead' : 'customer',
            summary: summaryWithTranscript,
            serviceRequestTypeId: aiExtract?.serviceRequestTypeId,
            serviceRequestTypeName: aiExtract?.serviceRequestTypeName || wrapup.requestType,
            priorityId: aiExtract?.priorityId,
            policyNumbers: aiExtract?.policyNumbers || [],
            assigneeAgentId: body.ticketDetails?.assigneeAgentId || 94007, // Default to Lee if not specified
            wrapupId: itemId,
          };

          // Call the service-request API which handles Zapier webhook
          const baseUrl = process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://tcds-triage.vercel.app');
          const serviceResponse = await fetch(`${baseUrl}/api/service-request`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(serviceRequestPayload),
          });

          const serviceResult = await serviceResponse.json();
          if (serviceResult.success) {
            result = { success: true, action: "ticket", ticketId: serviceResult.ticketId, noteId: serviceResult.noteId };
          } else {
            return NextResponse.json({ error: serviceResult.error || "Failed to create service request" }, { status: 500 });
          }
        }
      }

      if (body.action === 'lead' && azClient) {
        const trestleData = wrapup.trestleData as { person?: { firstName?: string; lastName?: string } } | null;

        const leadPayload = {
          firstName: body.leadDetails?.firstName || trestleData?.person?.firstName || wrapup.customerName?.split(" ")[0] || "Unknown",
          lastName: body.leadDetails?.lastName || trestleData?.person?.lastName || wrapup.customerName?.split(" ").slice(1).join(" ") || "Caller",
          email: body.leadDetails?.email || wrapup.customerEmail || undefined,
          phone: body.leadDetails?.phone || wrapup.customerPhone || undefined,
          pipelineId: 1,
          stageId: 1,
          source: body.leadDetails?.source || "Phone Call",
        };

        const leadResult = await azClient.createLead(leadPayload);
        if (leadResult.success) {
          await db
            .update(wrapupDrafts)
            .set({
              status: "completed",
              reviewerDecision: "approved",
              outcome: "lead_created",
              completedAt: new Date(),
              reviewerId: reviewerId,
              reviewedAt: new Date(),
            })
            .where(eq(wrapupDrafts.id, itemId));

          result = { success: true, action: "lead", leadId: leadResult.leadId };
        } else {
          return NextResponse.json({ error: "Failed to create lead" }, { status: 500 });
        }
      }

      // NCM - Post to No Customer Match service request via Zapier
      if (body.action === 'ncm') {
        const ncmCustomerId = NCM_CUSTOMER_ID;
        if (!ncmCustomerId || ncmCustomerId === '0') {
          return NextResponse.json({ error: "NCM customer not configured. Please set NCM_CUSTOMER_ID environment variable." }, { status: 500 });
        }

        // Fetch call transcript if available
        const callTranscript = await getCallTranscript(wrapup.callId);

        // Build the caller info for the note
        const callerName = wrapup.customerName || 'Unknown Caller';
        const callerPhone = wrapup.customerPhone || 'No phone';
        const summaryText = wrapup.aiCleanedSummary || wrapup.summary || 'No summary available';
        const requestType = wrapup.requestType || 'General Inquiry';

        // Format the description with all caller details
        const descriptionParts = [
          summaryText,
          '',
          '--- Caller Information ---',
          `Name: ${callerName}`,
          `Phone: ${callerPhone}`,
          wrapup.customerEmail ? `Email: ${wrapup.customerEmail}` : 'Email: N/A',
          '',
          '--- Call Details ---',
          `Request Type: ${requestType}`,
          `Handled By: ${wrapup.agentName || 'Unknown'}`,
          `Date/Time: ${new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' })}`,
        ];

        // Add call transcript at the end if available
        if (callTranscript) {
          descriptionParts.push('');
          descriptionParts.push('--- Call Transcript ---');
          descriptionParts.push(callTranscript);
        }

        const description = descriptionParts.filter(Boolean).join('\n');

        // Create service request via Zapier webhook (uses No Customer Match email)
        const serviceRequestPayload = {
          customerId: ncmCustomerId,
          customerName: callerName,
          customerEmail: null, // Forces No Match email to be used
          customerPhone: callerPhone,
          customerType: 'customer' as const,
          summary: description,
          serviceRequestTypeName: `NCM: ${requestType}`,
          assigneeAgentId: body.ticketDetails?.assigneeAgentId || 94007, // Default to Lee if not specified
          wrapupId: itemId,
        };

        // Call the service-request API which handles Zapier webhook
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://tcds-triage.vercel.app');
        const serviceResponse = await fetch(`${baseUrl}/api/service-request`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(serviceRequestPayload),
        });

        const serviceResult = await serviceResponse.json();
        if (serviceResult.success) {
          await db
            .update(wrapupDrafts)
            .set({
              status: "completed",
              reviewerDecision: "approved",
              outcome: "ncm_posted",
              agencyzoomTicketId: serviceResult.ticketId?.toString(),
              completedAt: new Date(),
              reviewerId: reviewerId,
              reviewedAt: new Date(),
            })
            .where(eq(wrapupDrafts.id, itemId));

          result = { success: true, action: "ncm", ticketId: serviceResult.ticketId };
        } else {
          return NextResponse.json({ error: serviceResult.error || "Failed to create NCM service request" }, { status: 500 });
        }
      }
    }

    // =======================================================================
    // HANDLE MESSAGE (including after-hours triage items)
    // =======================================================================
    else if (body.itemType === 'message') {
      // First check if this is a triage item (after-hours)
      const [triageItem] = await db
        .select()
        .from(triageItems)
        .where(eq(triageItems.id, itemId))
        .limit(1);

      if (triageItem) {
        // Handle triage item completion
        if (body.action === 'acknowledge' || body.action === 'skip' || body.action === 'void') {
          await db
            .update(triageItems)
            .set({
              status: 'completed',
              resolvedAt: new Date(),
              resolvedById: reviewerId,
              resolution: body.action === 'void' ? 'voided' : 'acknowledged',
            })
            .where(eq(triageItems.id, itemId));

          // Also acknowledge the linked message if it exists
          if (triageItem.messageId) {
            await db
              .update(messages)
              .set({
                isAcknowledged: true,
                acknowledgedAt: new Date(),
                acknowledgedById: reviewerId,
              })
              .where(eq(messages.id, triageItem.messageId));
          }

          return NextResponse.json({
            success: true,
            action: body.action,
            message: `After-hours item ${body.action === 'void' ? 'voided' : 'acknowledged'}`
          });
        }

        if (body.action === 'delete') {
          await db
            .update(triageItems)
            .set({
              status: 'cancelled',
              resolvedAt: new Date(),
              resolvedById: reviewerId,
              resolution: `Deleted: ${body.deleteReason || 'No reason'}`,
            })
            .where(eq(triageItems.id, itemId));

          // Also acknowledge the linked message if it exists
          if (triageItem.messageId) {
            await db
              .update(messages)
              .set({
                isAcknowledged: true,
                acknowledgedAt: new Date(),
                acknowledgedById: reviewerId,
              })
              .where(eq(messages.id, triageItem.messageId));
          }

          return NextResponse.json({
            success: true,
            action: 'delete',
            message: 'After-hours item deleted'
          });
        }

        // Handle note/ticket actions for after-hours items
        if (body.action === 'note' || body.action === 'ticket' || body.action === 'ncm') {
          // Get customer ID - first from body, then try to look up from triage item's linked customer
          let customerId = body.customerId ? parseInt(body.customerId) : null;

          // If no customer ID provided and triage item has a linked customer, look up their AgencyZoom ID
          if (!customerId && triageItem.customerId) {
            const [linkedCustomer] = await db
              .select({ agencyzoomId: customers.agencyzoomId })
              .from(customers)
              .where(eq(customers.id, triageItem.customerId))
              .limit(1);

            if (linkedCustomer?.agencyzoomId) {
              customerId = parseInt(linkedCustomer.agencyzoomId);
              console.log(`[Complete API] Found linked customer AgencyZoom ID: ${customerId} from triage item`);
            }
          }

          // Get linked message for phone number
          let linkedMessage = null;
          if (triageItem.messageId) {
            const [msg] = await db
              .select()
              .from(messages)
              .where(eq(messages.id, triageItem.messageId))
              .limit(1);
            linkedMessage = msg;
          }

          // Extract phone from title (format: "Name - +1XXXXXXXXXX") if no linked message
          let callerPhone = linkedMessage?.fromNumber?.replace('+1', '') || 'Unknown';
          if (callerPhone === 'Unknown' && triageItem.title) {
            const phoneMatch = triageItem.title.match(/\+?1?(\d{10})$/);
            if (phoneMatch) {
              callerPhone = phoneMatch[1];
            }
          }
          const callerName = triageItem.title?.replace(/\s*-\s*\+?1?\d{10}$/, '') || linkedMessage?.contactName || 'Unknown Caller';
          const summary = triageItem.aiSummary || triageItem.description || linkedMessage?.body || 'After-hours callback request';

          if (body.action === 'note') {
            if (!customerId) {
              return NextResponse.json({ error: "Customer ID required for note" }, { status: 400 });
            }
            if (!azClient) {
              return NextResponse.json({ error: "AgencyZoom not configured" }, { status: 500 });
            }

            const noteText = formatNoteText('message', summary, {
              phone: callerPhone,
              requestType: 'After Hours Callback',
            });

            const noteResult = await azClient.addNote(customerId, noteText);
            if (noteResult.success) {
              await db
                .update(triageItems)
                .set({
                  status: 'completed',
                  resolvedAt: new Date(),
                  resolvedById: reviewerId,
                  resolution: 'note_posted',
                })
                .where(eq(triageItems.id, itemId));

              if (triageItem.messageId) {
                await db
                  .update(messages)
                  .set({
                    isAcknowledged: true,
                    acknowledgedAt: new Date(),
                    acknowledgedById: reviewerId,
                  })
                  .where(eq(messages.id, triageItem.messageId));
              }

              return NextResponse.json({ success: true, action: "note", noteId: noteResult.id });
            } else {
              return NextResponse.json({ error: "Failed to post note" }, { status: 500 });
            }
          }

          if (body.action === 'ticket') {
            if (!customerId) {
              return NextResponse.json({ error: "Customer ID required for ticket" }, { status: 400 });
            }

            // Fetch customer email
            let customerEmail = null;
            const [matchedCustomer] = await db
              .select({ email: customers.email, firstName: customers.firstName, lastName: customers.lastName })
              .from(customers)
              .where(eq(customers.agencyzoomId, customerId.toString()))
              .limit(1);
            customerEmail = matchedCustomer?.email || null;

            const description = [
              summary,
              '',
              '--- Caller Information ---',
              `Name: ${callerName}`,
              `Phone: ${callerPhone}`,
              '',
              `Received: ${new Date(triageItem.createdAt).toLocaleString('en-US', { timeZone: 'America/Chicago' })}`,
            ].join('\n');

            // Try to determine a better service request type from the summary
            let serviceRequestType = body.ticketDetails?.subject;
            if (!serviceRequestType) {
              // Check for common request types in the summary
              const summaryLower = summary.toLowerCase();
              if (summaryLower.includes('claim') || summaryLower.includes('accident') || summaryLower.includes('damage')) {
                serviceRequestType = 'After Hours - Claims';
              } else if (summaryLower.includes('cancel') || summaryLower.includes('cancellation')) {
                serviceRequestType = 'After Hours - Cancellation Request';
              } else if (summaryLower.includes('payment') || summaryLower.includes('bill') || summaryLower.includes('pay')) {
                serviceRequestType = 'After Hours - Billing';
              } else if (summaryLower.includes('quote') || summaryLower.includes('new policy')) {
                serviceRequestType = 'After Hours - Quote Request';
              } else if (summaryLower.includes('change') || summaryLower.includes('update') || summaryLower.includes('add') || summaryLower.includes('remove')) {
                serviceRequestType = 'After Hours - Policy Change';
              } else if (summaryLower.includes('id card') || summaryLower.includes('proof of insurance') || summaryLower.includes('certificate')) {
                serviceRequestType = 'After Hours - ID Cards';
              } else if (summaryLower.includes('renewal') || summaryLower.includes('renew')) {
                serviceRequestType = 'After Hours - Renewal';
              } else {
                serviceRequestType = 'After Hours Callback';
              }
            }

            const serviceRequestPayload = {
              customerId: customerId.toString(),
              customerName: callerName,
              customerEmail: customerEmail,
              customerPhone: callerPhone,
              customerType: 'customer' as const,
              summary: description,
              serviceRequestTypeName: serviceRequestType,
              assigneeAgentId: body.ticketDetails?.assigneeAgentId || 94007,
            };

            const baseUrl = process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://tcds-triage.vercel.app');
            const serviceResponse = await fetch(`${baseUrl}/api/service-request`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(serviceRequestPayload),
            });

            const serviceResult = await serviceResponse.json();
            if (serviceResult.success) {
              await db
                .update(triageItems)
                .set({
                  status: 'completed',
                  resolvedAt: new Date(),
                  resolvedById: reviewerId,
                  resolution: 'ticket_created',
                })
                .where(eq(triageItems.id, itemId));

              if (triageItem.messageId) {
                await db
                  .update(messages)
                  .set({
                    isAcknowledged: true,
                    acknowledgedAt: new Date(),
                    acknowledgedById: reviewerId,
                  })
                  .where(eq(messages.id, triageItem.messageId));
              }

              return NextResponse.json({ success: true, action: "ticket", ticketId: serviceResult.ticketId, noteId: serviceResult.noteId });
            } else {
              return NextResponse.json({ error: serviceResult.error || "Failed to create service request" }, { status: 500 });
            }
          }

          if (body.action === 'ncm') {
            const ncmCustomerId = NCM_CUSTOMER_ID;
            if (!ncmCustomerId || ncmCustomerId === '0') {
              return NextResponse.json({ error: "NCM customer not configured" }, { status: 500 });
            }

            const description = [
              summary,
              '',
              '--- Caller Information ---',
              `Name: ${callerName}`,
              `Phone: ${callerPhone}`,
              '',
              `Received: ${new Date(triageItem.createdAt).toLocaleString('en-US', { timeZone: 'America/Chicago' })}`,
            ].join('\n');

            const serviceRequestPayload = {
              customerId: ncmCustomerId,
              customerName: callerName,
              customerEmail: null,
              customerPhone: callerPhone,
              customerType: 'customer' as const,
              summary: description,
              serviceRequestTypeName: 'NCM: After Hours Callback',
              assigneeAgentId: body.ticketDetails?.assigneeAgentId || 94007,
            };

            const baseUrl = process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://tcds-triage.vercel.app');
            const serviceResponse = await fetch(`${baseUrl}/api/service-request`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(serviceRequestPayload),
            });

            const serviceResult = await serviceResponse.json();
            if (serviceResult.success) {
              await db
                .update(triageItems)
                .set({
                  status: 'completed',
                  resolvedAt: new Date(),
                  resolvedById: reviewerId,
                  resolution: 'ncm_posted',
                })
                .where(eq(triageItems.id, itemId));

              if (triageItem.messageId) {
                await db
                  .update(messages)
                  .set({
                    isAcknowledged: true,
                    acknowledgedAt: new Date(),
                    acknowledgedById: reviewerId,
                  })
                  .where(eq(messages.id, triageItem.messageId));
              }

              return NextResponse.json({ success: true, action: "ncm", ticketId: serviceResult.ticketId });
            } else {
              return NextResponse.json({ error: serviceResult.error || "Failed to create NCM service request" }, { status: 500 });
            }
          }
        }

        return NextResponse.json({ error: "Action not supported for after-hours items" }, { status: 400 });
      }

      // Not a triage item, look for message
      const [message] = await db
        .select()
        .from(messages)
        .where(eq(messages.id, itemId))
        .limit(1);

      if (!message) {
        return NextResponse.json({ error: "Message not found" }, { status: 404 });
      }

      if (body.action === 'acknowledge' || body.action === 'skip') {
        // Acknowledge all grouped messages if messageIds provided, otherwise just the single message
        const idsToAcknowledge = body.messageIds && body.messageIds.length > 0 ? body.messageIds : [itemId];

        for (const msgId of idsToAcknowledge) {
          await db
            .update(messages)
            .set({
              isAcknowledged: true,
              acknowledgedAt: new Date(),
              acknowledgedById: reviewerId,
            })
            .where(eq(messages.id, msgId));
        }

        return NextResponse.json({
          success: true,
          action: body.action,
          message: `${idsToAcknowledge.length} message(s) acknowledged`
        });
      }

      if (body.action === 'void') {
        // Void all grouped messages if messageIds provided
        const idsToVoid = body.messageIds && body.messageIds.length > 0 ? body.messageIds : [itemId];

        for (const msgId of idsToVoid) {
          await db
            .update(messages)
            .set({
              isAcknowledged: true,
              acknowledgedAt: new Date(),
              acknowledgedById: reviewerId,
            })
            .where(eq(messages.id, msgId));
        }

        return NextResponse.json({
          success: true,
          action: "void",
          message: `${idsToVoid.length} message(s) voided`
        });
      }

      const customerId = body.customerId
        ? parseInt(body.customerId)
        : message.contactId
          ? parseInt(message.contactId)
          : null;

      if (!customerId && (body.action === 'note' || body.action === 'ticket')) {
        return NextResponse.json({ error: "Customer ID required" }, { status: 400 });
      }

      if (body.action === 'note' && customerId && azClient) {
        const noteText = formatNoteText('message', body.noteContent || message.body || '', {
          phone: message.fromNumber || undefined,
        });

        const noteResult = await azClient.addNote(customerId, noteText);
        if (noteResult.success) {
          await db
            .update(messages)
            .set({
              isAcknowledged: true,
              acknowledgedAt: new Date(),
              acknowledgedById: reviewerId,
            })
            .where(eq(messages.id, itemId));

          result = { success: true, action: "note", noteId: noteResult.id };
        } else {
          return NextResponse.json({ error: "Failed to post note" }, { status: 500 });
        }
      }

      // Ticket - Create service request for matched customer or append to existing
      if (body.action === 'ticket' && customerId) {
        // Fetch the matched customer's email from our database
        const [matchedCustomer] = await db
          .select({
            email: customers.email,
            firstName: customers.firstName,
            lastName: customers.lastName,
          })
          .from(customers)
          .where(eq(customers.agencyzoomId, customerId.toString()))
          .limit(1);

        const customerEmail = matchedCustomer?.email || null;
        const customerName = matchedCustomer
          ? `${matchedCustomer.firstName || ''} ${matchedCustomer.lastName || ''}`.trim() || message.contactName || 'Unknown'
          : message.contactName || 'Unknown Sender';

        const senderPhone = message.fromNumber || 'Unknown';
        const messageBody = body.noteContent || message.body || 'No message content';

        // Format the description with sender details
        const description = [
          messageBody,
          '',
          '--- Sender Information ---',
          `Name: ${customerName}`,
          `Phone: ${senderPhone}`,
          '',
          `Received: ${new Date(message.createdAt || Date.now()).toLocaleString('en-US', { timeZone: 'America/Chicago' })}`,
        ].join('\n');

        // Check if we're appending to an existing ticket
        const appendToTicketId = body.ticketDetails?.appendToTicketId;

        if (appendToTicketId) {
          // APPEND MODE: Add note to existing service ticket
          console.log(`[Complete API] Appending SMS to existing ticket ${appendToTicketId}`);

          const timestamp = new Date().toLocaleString("en-US", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
            timeZone: "America/Chicago",
          });

          const noteContent = [
            '💬 Additional SMS Note Added',
            `Date: ${timestamp}`,
            '',
            description,
          ].join('\n');

          if (azClient) {
            const ticketNoteResult = await azClient.addServiceTicketNote(appendToTicketId, noteContent);

            if (ticketNoteResult.success) {
              await db
                .update(messages)
                .set({
                  isAcknowledged: true,
                  acknowledgedAt: new Date(),
                  acknowledgedById: reviewerId,
                })
                .where(eq(messages.id, itemId));

              result = { success: true, action: "ticket", ticketId: appendToTicketId, message: "Note appended to existing ticket" };
            } else {
              // Fallback: Post as customer note instead
              console.log('[Complete API] Ticket note failed, posting as customer note');
              const noteResult = await azClient.addNote(customerId, `[Appended to Service Request #${appendToTicketId}]\n\n${noteContent}`);

              if (noteResult.success) {
                await db
                  .update(messages)
                  .set({
                    isAcknowledged: true,
                    acknowledgedAt: new Date(),
                    acknowledgedById: reviewerId,
                  })
                  .where(eq(messages.id, itemId));

                result = { success: true, action: "ticket", ticketId: appendToTicketId, noteId: noteResult.id, message: "Note posted to customer (ticket note API unavailable)" };
              } else {
                return NextResponse.json({ error: "Failed to append note" }, { status: 500 });
              }
            }
          } else {
            return NextResponse.json({ error: "AgencyZoom client not available" }, { status: 500 });
          }
        } else {
          // CREATE NEW MODE: Create service request via Zapier webhook
          // Use appropriate service request type based on message type
          const defaultServiceType = message.isAfterHours
            ? 'After Hours Callback'
            : 'SMS Service Request';

          const serviceRequestPayload = {
            customerId: customerId.toString(),
            customerName: customerName,
            customerEmail: customerEmail,  // Use fetched email so it routes to correct customer
            customerPhone: senderPhone,
            customerType: 'customer' as const,
            summary: description,
            serviceRequestTypeName: body.ticketDetails?.subject || defaultServiceType,
            assigneeAgentId: body.ticketDetails?.assigneeAgentId || 94007, // Default to Lee
          };

          const baseUrl = process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://tcds-triage.vercel.app');
          const serviceResponse = await fetch(`${baseUrl}/api/service-request`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(serviceRequestPayload),
          });

          const serviceResult = await serviceResponse.json();
          if (serviceResult.success) {
            await db
              .update(messages)
              .set({
                isAcknowledged: true,
                acknowledgedAt: new Date(),
                acknowledgedById: reviewerId,
              })
              .where(eq(messages.id, itemId));

            result = { success: true, action: "ticket", ticketId: serviceResult.ticketId, noteId: serviceResult.noteId };
          } else {
            return NextResponse.json({ error: serviceResult.error || "Failed to create service request" }, { status: 500 });
          }
        }
      }

      // NCM - Post message to No Customer Match service request via Zapier
      if (body.action === 'ncm') {
        const ncmCustomerId = NCM_CUSTOMER_ID;
        if (!ncmCustomerId || ncmCustomerId === '0') {
          return NextResponse.json({ error: "NCM customer not configured. Please set NCM_CUSTOMER_ID environment variable." }, { status: 500 });
        }

        // Build the sender info for the description
        const senderPhone = message.fromNumber || 'Unknown';
        const senderName = message.contactName || 'Unknown Sender';
        const messageBody = message.body || 'No message content';

        // Format the description with all sender details
        const description = [
          messageBody,
          '',
          '--- Sender Information ---',
          `Name: ${senderName}`,
          `Phone: ${senderPhone}`,
          '',
          `Received: ${new Date(message.createdAt || Date.now()).toLocaleString('en-US', { timeZone: 'America/Chicago' })}`,
        ].join('\n');

        // Create service request via Zapier webhook (uses No Customer Match email)
        const serviceRequestPayload = {
          customerId: ncmCustomerId,
          customerName: senderName,
          customerEmail: null, // Forces No Match email to be used
          customerPhone: senderPhone,
          customerType: 'customer' as const,
          summary: description,
          serviceRequestTypeName: 'NCM: SMS Message',
          assigneeAgentId: body.ticketDetails?.assigneeAgentId || 94007, // Default to Lee if not specified
        };

        // Call the service-request API which handles Zapier webhook
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://tcds-triage.vercel.app');
        const serviceResponse = await fetch(`${baseUrl}/api/service-request`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(serviceRequestPayload),
        });

        const serviceResult = await serviceResponse.json();
        if (serviceResult.success) {
          await db
            .update(messages)
            .set({
              isAcknowledged: true,
              acknowledgedAt: new Date(),
              acknowledgedById: reviewerId,
            })
            .where(eq(messages.id, itemId));

          result = { success: true, action: "ncm", ticketId: serviceResult.ticketId };
        } else {
          return NextResponse.json({ error: serviceResult.error || "Failed to create NCM service request" }, { status: 500 });
        }
      }
    }

    // =======================================================================
    // HANDLE LEAD
    // =======================================================================
    else if (body.itemType === 'lead') {
      const [lead] = await db
        .select()
        .from(customers)
        .where(eq(customers.id, itemId))
        .limit(1);

      if (!lead) {
        return NextResponse.json({ error: "Lead not found" }, { status: 404 });
      }

      if (body.action === 'skip') {
        // For leads, "skip" could mean marking as processed
        // For now, just return success
        return NextResponse.json({ success: true, action: "skip", message: "Lead skipped" });
      }

      // Leads are already in the system, so actions might involve assigning or updating
      // For MVP, just acknowledge
      return NextResponse.json({ success: true, action: body.action, message: "Lead processed" });
    }

    if (!result.success) {
      return NextResponse.json({ error: "Action not supported or failed" }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("[Pending Review Complete] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Completion failed" },
      { status: 500 }
    );
  }
}
