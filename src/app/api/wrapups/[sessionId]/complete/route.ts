// API Route: /api/wrapups/[sessionId]/complete
// Complete a wrapup by posting to AgencyZoom (note, ticket, or lead)

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { wrapupDrafts, matchSuggestions, calls, liveTranscriptSegments } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import { getAgencyZoomClient } from "@/lib/api/agencyzoom";
import { addToRetryQueue } from "@/lib/api/retry-queue";

// =============================================================================
// TYPES
// =============================================================================

interface CompleteRequest {
  action: "note" | "ticket" | "lead" | "skip" | "delete";
  customerId?: string; // AgencyZoom customer ID to use (for match selection)
  noteContent?: string; // Override AI summary (legacy)
  editedSummary?: string; // User-edited summary
  reviewerId?: string; // ID of the user who reviewed this wrapup
  ticketDetails?: {
    subject: string;
    description?: string;
    priority?: "low" | "medium" | "high";
    pipelineId?: number;
    stageId?: number;
    assigneeId?: number;
    // New required fields for UI
    ticketType?: "service_request" | "policy_change" | "billing" | "claims" | "general";
    assignedToId?: string; // Internal user ID
  };
  leadDetails?: {
    firstName: string;
    lastName: string;
    email?: string;
    phone?: string;
    source?: string;
    pipelineId?: number;
    stageId?: number;
    // New required fields for UI
    leadType?: "new_business" | "cross_sell" | "referral" | "requote";
    assignedToId?: string; // Internal user ID
  };
  // New delete action fields
  deleteReason?: "spam" | "wrong_number" | "duplicate" | "test_call" | "no_action_needed" | "other";
  deleteNotes?: string;
}

// =============================================================================
// HELPERS
// =============================================================================

async function getFullTranscript(callId: string): Promise<string> {
  const segments = await db
    .select({ text: liveTranscriptSegments.text })
    .from(liveTranscriptSegments)
    .where(eq(liveTranscriptSegments.callId, callId))
    .orderBy(asc(liveTranscriptSegments.sequenceNumber));

  if (segments.length > 0) {
    return segments.map((s) => s.text).join(" ");
  }

  // Fallback to call.transcription
  const [call] = await db
    .select({ transcription: calls.transcription })
    .from(calls)
    .where(eq(calls.id, callId))
    .limit(1);

  return call?.transcription || "";
}

function formatCallNote(
  wrapup: {
    direction: string | null;
    customerName: string | null;
    customerPhone: string | null;
    requestType: string | null;
    summary: string | null;
    aiCleanedSummary: string | null;
    aiExtraction: unknown;
    agentName?: string | null;
  },
  noteContent?: string
): string {
  const extraction = wrapup.aiExtraction as {
    actionItems?: string[];
    policyNumbers?: string[];
  } | null;
  const actionItems = extraction?.actionItems || [];
  const policyNumbers = extraction?.policyNumbers || [];

  // Format timestamp in Central Time
  const timestamp = new Date().toLocaleString("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
    timeZone: "America/Chicago",
  });

  const summaryText = noteContent || wrapup.aiCleanedSummary || wrapup.summary ||
    `${wrapup.customerName || "Customer"} called regarding policy inquiry.`;

  const lines = [
    "Call Note:",
    summaryText,
  ];

  // Add action items if present
  if (actionItems.length > 0) {
    lines.push("");
    lines.push("Action Items:");
    actionItems.forEach((item) => lines.push(`• ${item}`));
  }

  // Add policies referenced
  const policySection = policyNumbers.length > 0
    ? policyNumbers.join(", ")
    : "None mentioned";
  lines.push("");
  lines.push(`Policies Referenced: ${policySection}`);

  // Add agent info
  lines.push(`Handled by: ${wrapup.agentName || "Agent"}`);
  lines.push(`Date/Time: ${timestamp}`);

  return lines.join("\n");
}

// =============================================================================
// POST - Complete Wrapup
// =============================================================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId: wrapupId } = await params;
    const body: CompleteRequest = await request.json();
    const tenantId = process.env.DEFAULT_TENANT_ID;

    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    // Fetch wrapup
    const [wrapup] = await db
      .select()
      .from(wrapupDrafts)
      .where(eq(wrapupDrafts.id, wrapupId))
      .limit(1);

    if (!wrapup) {
      return NextResponse.json({ error: "Wrapup not found" }, { status: 404 });
    }

    // Handle skip action
    if (body.action === "skip") {
      await db
        .update(wrapupDrafts)
        .set({
          status: "completed",
          reviewerDecision: "skipped",
          outcome: "skipped",
          completionAction: "skipped",
          completedAt: new Date(),
          reviewerId: body.reviewerId || null,
          reviewedAt: new Date(),
        })
        .where(eq(wrapupDrafts.id, wrapupId));

      return NextResponse.json({
        success: true,
        action: "skip",
        message: "Wrapup skipped",
      });
    }

    // Handle delete action
    if (body.action === "delete") {
      if (!body.deleteReason) {
        return NextResponse.json(
          { error: "Delete reason is required" },
          { status: 400 }
        );
      }

      await db
        .update(wrapupDrafts)
        .set({
          status: "completed",
          reviewerDecision: "deleted",
          outcome: "deleted",
          completionAction: "deleted",
          deleteReason: body.deleteReason,
          deleteNotes: body.deleteNotes || null,
          deletedById: body.reviewerId || null,
          deletedAt: new Date(),
          completedAt: new Date(),
          reviewerId: body.reviewerId || null,
          reviewedAt: new Date(),
        })
        .where(eq(wrapupDrafts.id, wrapupId));

      return NextResponse.json({
        success: true,
        action: "delete",
        message: "Wrapup deleted",
        deleteReason: body.deleteReason,
      });
    }

    // Get AgencyZoom client
    const azClient = await getAgencyZoomClient();
    if (!azClient) {
      return NextResponse.json(
        { error: "AgencyZoom not configured" },
        { status: 500 }
      );
    }

    // Determine customer ID
    let customerId: number | null = null;

    if (body.customerId) {
      // Use provided customer ID (from match selection)
      customerId = parseInt(body.customerId);
    } else if (wrapup.matchStatus === "matched") {
      // Get from AI extraction
      const extraction = wrapup.aiExtraction as { agencyZoomCustomerId?: string } | null;
      if (extraction?.agencyZoomCustomerId) {
        customerId = parseInt(extraction.agencyZoomCustomerId);
      }
    }

    let result: {
      success: boolean;
      action: string;
      agencyZoomNoteId?: number;
      agencyZoomTicketId?: number;
      agencyZoomLeadId?: number;
      customerId?: number;
      error?: string;
      queued?: boolean;
      message?: string;
    } = { success: false, action: body.action };

    // Process based on action
    switch (body.action) {
      case "note": {
        if (!customerId) {
          return NextResponse.json(
            { error: "Customer ID required for note action" },
            { status: 400 }
          );
        }

        // Use edited summary if provided, fall back to noteContent (legacy)
        const summaryToUse = body.editedSummary || body.noteContent;
        const noteText = formatCallNote(wrapup, summaryToUse);

        try {
          const noteResult = await azClient.addNote(customerId, noteText);

          if (noteResult.success) {
            result = {
              success: true,
              action: "note",
              agencyZoomNoteId: noteResult.id,
              customerId,
            };

            // Update wrapup with new tracking fields
            await db
              .update(wrapupDrafts)
              .set({
                status: "completed",
                reviewerDecision: "approved",
                outcome: "note_posted",
                completionAction: "posted",
                editedSummary: body.editedSummary || null,
                agencyzoomNoteId: noteResult.id?.toString(),
                completedAt: new Date(),
                reviewerId: body.reviewerId || null,
                reviewedAt: new Date(),
              })
              .where(eq(wrapupDrafts.id, wrapupId));

            // Mark match suggestion as selected if applicable
            if (body.customerId && wrapup.matchStatus === "multiple_matches") {
              await db
                .update(matchSuggestions)
                .set({ isSelected: true })
                .where(eq(matchSuggestions.contactId, body.customerId));
            }
          } else {
            // Add to retry queue
            await addToRetryQueue(tenantId, {
              operationType: "agencyzoom_note",
              targetService: "agencyzoom",
              requestPayload: { customerId, noteText },
              wrapupDraftId: wrapupId,
              callId: wrapup.callId,
              customerId: customerId.toString(),
            }, "Initial note post failed");

            result = {
              success: true, // Return success since it's queued for retry
              action: "note",
              queued: true,
              message: "Note queued for retry",
            };

            // Mark wrapup as pending retry
            await db
              .update(wrapupDrafts)
              .set({
                status: "pending_review", // Keep in review until retry succeeds
                reviewerDecision: "retry_pending",
              })
              .where(eq(wrapupDrafts.id, wrapupId));
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "Unknown error";

          // Add to retry queue
          await addToRetryQueue(tenantId, {
            operationType: "agencyzoom_note",
            targetService: "agencyzoom",
            requestPayload: { customerId, noteText },
            wrapupDraftId: wrapupId,
            callId: wrapup.callId,
            customerId: customerId.toString(),
          }, errorMessage);

          result = {
            success: true, // Return success since it's queued for retry
            action: "note",
            queued: true,
            message: "Note queued for retry due to error",
          };
        }
        break;
      }

      case "ticket": {
        if (!customerId) {
          return NextResponse.json(
            { error: "Customer ID required for ticket action" },
            { status: 400 }
          );
        }

        if (!body.ticketDetails?.subject) {
          return NextResponse.json(
            { error: "Ticket subject required" },
            { status: 400 }
          );
        }

        // Validate required fields for new UI
        if (!body.ticketDetails?.ticketType) {
          return NextResponse.json(
            { error: "Ticket type is required" },
            { status: 400 }
          );
        }

        if (!body.ticketDetails?.assignedToId) {
          return NextResponse.json(
            { error: "Assigned user is required" },
            { status: 400 }
          );
        }

        // Step 1: Create note first (call documentation)
        const summaryForTicket = body.editedSummary || body.noteContent;
        const ticketNoteText = formatCallNote(wrapup, summaryForTicket);
        let noteId: number | undefined;
        try {
          const noteResult = await azClient.addNote(customerId, ticketNoteText);
          if (noteResult.success) {
            noteId = noteResult.id;
            console.log(`[Wrapup Complete] Posted note ${noteId} to customer ${customerId}`);
          } else {
            // Queue note for retry but continue with ticket
            await addToRetryQueue(tenantId, {
              operationType: "agencyzoom_note",
              targetService: "agencyzoom",
              requestPayload: { customerId, noteText: ticketNoteText },
              wrapupDraftId: wrapupId,
              callId: wrapup.callId,
              customerId: customerId.toString(),
            }, "Note creation failed during ticket flow");
          }
        } catch (noteError) {
          console.error("[Wrapup Complete] Note creation failed, queuing for retry:", noteError);
          const errorMessage = noteError instanceof Error ? noteError.message : "Unknown error";
          await addToRetryQueue(tenantId, {
            operationType: "agencyzoom_note",
            targetService: "agencyzoom",
            requestPayload: { customerId, noteText: ticketNoteText },
            wrapupDraftId: wrapupId,
            callId: wrapup.callId,
            customerId: customerId.toString(),
          }, errorMessage);
        }

        // Step 2: Create service ticket
        const ticketPayload = {
          subject: body.ticketDetails.subject,
          description:
            body.ticketDetails.description ||
            body.noteContent ||
            wrapup.aiCleanedSummary ||
            wrapup.summary ||
            "",
          customerId,
          pipelineId: body.ticketDetails.pipelineId || 1,
          stageId: body.ticketDetails.stageId || 1,
          priorityId:
            body.ticketDetails.priority === "high"
              ? 1
              : body.ticketDetails.priority === "low"
              ? 3
              : 2,
        };

        try {
          const ticketResult = await azClient.createServiceTicket(ticketPayload);

          if (ticketResult.success) {
            result = {
              success: true,
              action: "ticket",
              agencyZoomNoteId: noteId,
              agencyZoomTicketId: ticketResult.serviceTicketId,
              customerId,
            };

            await db
              .update(wrapupDrafts)
              .set({
                status: "completed",
                reviewerDecision: "approved",
                outcome: "ticket_created",
                completionAction: "ticket",
                editedSummary: body.editedSummary || null,
                ticketType: body.ticketDetails?.ticketType || null,
                ticketAssignedToId: body.ticketDetails?.assignedToId || null,
                agencyzoomNoteId: noteId?.toString(),
                agencyzoomTicketId: ticketResult.serviceTicketId?.toString(),
                completedAt: new Date(),
                reviewerId: body.reviewerId || null,
                reviewedAt: new Date(),
              })
              .where(eq(wrapupDrafts.id, wrapupId));
          } else {
            // Queue ticket for retry
            await addToRetryQueue(tenantId, {
              operationType: "agencyzoom_ticket",
              targetService: "agencyzoom",
              requestPayload: ticketPayload,
              wrapupDraftId: wrapupId,
              callId: wrapup.callId,
              customerId: customerId.toString(),
            }, "Initial ticket creation failed");

            result = {
              success: true,
              action: "ticket",
              queued: true,
              agencyZoomNoteId: noteId,
              message: "Ticket queued for retry",
            };

            await db
              .update(wrapupDrafts)
              .set({
                status: "pending_review",
                reviewerDecision: "retry_pending",
                agencyzoomNoteId: noteId?.toString(),
              })
              .where(eq(wrapupDrafts.id, wrapupId));
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "Unknown error";

          await addToRetryQueue(tenantId, {
            operationType: "agencyzoom_ticket",
            targetService: "agencyzoom",
            requestPayload: ticketPayload,
            wrapupDraftId: wrapupId,
            callId: wrapup.callId,
            customerId: customerId.toString(),
          }, errorMessage);

          result = {
            success: true,
            action: "ticket",
            queued: true,
            agencyZoomNoteId: noteId,
            message: "Ticket queued for retry due to error",
          };
        }
        break;
      }

      case "lead": {
        // Validate required fields for new UI
        if (!body.leadDetails?.leadType) {
          return NextResponse.json(
            { error: "Lead type is required" },
            { status: 400 }
          );
        }

        // Store assignedToId before we potentially overwrite leadDetails
        const leadAssignedToId = body.leadDetails?.assignedToId;
        const leadType = body.leadDetails?.leadType;

        if (!leadAssignedToId) {
          return NextResponse.json(
            { error: "Assigned user is required" },
            { status: 400 }
          );
        }

        if (!body.leadDetails?.firstName || !body.leadDetails?.lastName) {
          // Try to extract from wrapup
          const trestleData = wrapup.trestleData as { person?: { firstName?: string; lastName?: string } } | null;
          body.leadDetails = {
            firstName: body.leadDetails?.firstName || trestleData?.person?.firstName || wrapup.customerName?.split(" ")[0] || "Unknown",
            lastName: body.leadDetails?.lastName || trestleData?.person?.lastName || wrapup.customerName?.split(" ").slice(1).join(" ") || "Caller",
            leadType: leadType || "new_business",
            assignedToId: leadAssignedToId,
          };
        }

        const leadPayload = {
          firstName: body.leadDetails!.firstName,
          lastName: body.leadDetails!.lastName,
          email: body.leadDetails!.email || wrapup.customerEmail || undefined,
          phone: body.leadDetails!.phone || wrapup.customerPhone || undefined,
          pipelineId: body.leadDetails!.pipelineId || 1,
          stageId: body.leadDetails!.stageId || 1,
          source: body.leadDetails!.source || "Phone Call",
        };

        try {
          const leadResult = await azClient.createLead(leadPayload);

          if (leadResult.success) {
            result = {
              success: true,
              action: "lead",
              agencyZoomLeadId: leadResult.leadId,
            };

            await db
              .update(wrapupDrafts)
              .set({
                status: "completed",
                reviewerDecision: "approved",
                outcome: "lead_created",
                completionAction: "lead",
                editedSummary: body.editedSummary || null,
                leadType: body.leadDetails?.leadType || null,
                leadAssignedToId: body.leadDetails?.assignedToId || null,
                agencyzoomLeadId: leadResult.leadId?.toString(),
                completedAt: new Date(),
                reviewerId: body.reviewerId || null,
                reviewedAt: new Date(),
              })
              .where(eq(wrapupDrafts.id, wrapupId));

            // Also post a note to the new lead
            if (leadResult.leadId) {
              const summaryForLead = body.editedSummary || body.noteContent;
              const leadNoteText = formatCallNote(wrapup, summaryForLead);
              try {
                await azClient.addLeadNote(leadResult.leadId, leadNoteText);
              } catch (noteError) {
                // Queue lead note for retry
                const errorMessage = noteError instanceof Error ? noteError.message : "Unknown error";
                await addToRetryQueue(tenantId, {
                  operationType: "agencyzoom_lead_note",
                  targetService: "agencyzoom",
                  requestPayload: { leadId: leadResult.leadId, noteText: leadNoteText },
                  wrapupDraftId: wrapupId,
                  callId: wrapup.callId,
                }, errorMessage);
              }
            }
          } else {
            // Queue lead creation for retry
            await addToRetryQueue(tenantId, {
              operationType: "agencyzoom_lead",
              targetService: "agencyzoom",
              requestPayload: leadPayload,
              wrapupDraftId: wrapupId,
              callId: wrapup.callId,
            }, "Initial lead creation failed");

            result = {
              success: true,
              action: "lead",
              queued: true,
              message: "Lead queued for retry",
            };

            await db
              .update(wrapupDrafts)
              .set({
                status: "pending_review",
                reviewerDecision: "retry_pending",
              })
              .where(eq(wrapupDrafts.id, wrapupId));
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "Unknown error";

          await addToRetryQueue(tenantId, {
            operationType: "agencyzoom_lead",
            targetService: "agencyzoom",
            requestPayload: leadPayload,
            wrapupDraftId: wrapupId,
            callId: wrapup.callId,
          }, errorMessage);

          result = {
            success: true,
            action: "lead",
            queued: true,
            message: "Lead queued for retry due to error",
          };
        }
        break;
      }

      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    if (!result.success) {
      return NextResponse.json(result, { status: 500 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("[Wrapup Complete] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Completion failed" },
      { status: 500 }
    );
  }
}

// =============================================================================
// GET - Get completion options
// =============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId: wrapupId } = await params;

    const [wrapup] = await db
      .select({
        id: wrapupDrafts.id,
        matchStatus: wrapupDrafts.matchStatus,
        customerName: wrapupDrafts.customerName,
        customerPhone: wrapupDrafts.customerPhone,
        aiExtraction: wrapupDrafts.aiExtraction,
        trestleData: wrapupDrafts.trestleData,
      })
      .from(wrapupDrafts)
      .where(eq(wrapupDrafts.id, wrapupId))
      .limit(1);

    if (!wrapup) {
      return NextResponse.json({ error: "Wrapup not found" }, { status: 404 });
    }

    // Get match suggestions if multiple matches
    let suggestions: Array<{
      id: string;
      contactId: string | null;
      contactName: string | null;
      contactPhone: string | null;
      contactEmail: string | null;
      confidence: string | null;
      isSelected: boolean | null;
    }> = [];

    if (wrapup.matchStatus === "multiple_matches") {
      suggestions = await db
        .select({
          id: matchSuggestions.id,
          contactId: matchSuggestions.contactId,
          contactName: matchSuggestions.contactName,
          contactPhone: matchSuggestions.contactPhone,
          contactEmail: matchSuggestions.contactEmail,
          confidence: matchSuggestions.confidence,
          isSelected: matchSuggestions.isSelected,
        })
        .from(matchSuggestions)
        .where(eq(matchSuggestions.wrapupDraftId, wrapupId));
    }

    return NextResponse.json({
      success: true,
      wrapupId,
      matchStatus: wrapup.matchStatus,
      canComplete: true,
      availableActions: ["note", "ticket", "lead", "skip", "delete"],
      matchSuggestions: suggestions,
      customerHint: wrapup.trestleData
        ? {
            source: "trestle",
            name: (wrapup.trestleData as { person?: { name?: string } })?.person?.name,
            phone: wrapup.customerPhone,
          }
        : null,
    });
  } catch (error) {
    console.error("[Wrapup Complete] GET Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Fetch failed" },
      { status: 500 }
    );
  }
}
