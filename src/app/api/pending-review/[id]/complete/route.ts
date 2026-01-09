// API Route: /api/pending-review/[id]/complete
// Unified completion endpoint for wrapups, messages, and leads

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { wrapupDrafts, messages, customers } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getAgencyZoomClient } from "@/lib/api/agencyzoom";

// =============================================================================
// TYPES
// =============================================================================

interface CompleteRequest {
  itemType: 'wrapup' | 'message' | 'lead';
  action: 'note' | 'ticket' | 'lead' | 'skip' | 'acknowledge' | 'void';
  customerId?: string;
  noteContent?: string;
  ticketDetails?: {
    subject: string;
    description?: string;
    priority?: 'low' | 'medium' | 'high';
  };
  leadDetails?: {
    firstName: string;
    lastName: string;
    email?: string;
    phone?: string;
    source?: string;
  };
}

// =============================================================================
// HELPERS
// =============================================================================

function formatNoteText(
  type: string,
  content: string,
  metadata?: {
    phone?: string;
    requestType?: string;
    agentName?: string;
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
        await db
          .update(wrapupDrafts)
          .set({
            status: "completed",
            reviewerDecision: "skipped",
            outcome: "skipped",
            completedAt: new Date(),
          })
          .where(eq(wrapupDrafts.id, itemId));

        return NextResponse.json({ success: true, action: "skip", message: "Wrapup skipped" });
      }

      if (body.action === 'void') {
        await db
          .update(wrapupDrafts)
          .set({
            status: "completed",
            reviewerDecision: "voided",
            outcome: "voided",
            completedAt: new Date(),
          })
          .where(eq(wrapupDrafts.id, itemId));

        return NextResponse.json({ success: true, action: "void", message: "Wrapup voided" });
      }

      const customerId = body.customerId
        ? parseInt(body.customerId)
        : (wrapup.aiExtraction as { agencyZoomCustomerId?: string })?.agencyZoomCustomerId
          ? parseInt((wrapup.aiExtraction as { agencyZoomCustomerId: string }).agencyZoomCustomerId)
          : null;

      if (!customerId && (body.action === 'note' || body.action === 'ticket')) {
        return NextResponse.json({ error: "Customer ID required" }, { status: 400 });
      }

      if (body.action === 'note' && customerId && azClient) {
        const noteText = formatNoteText('wrapup', body.noteContent || wrapup.aiCleanedSummary || wrapup.summary || '', {
          phone: wrapup.customerPhone || undefined,
          requestType: wrapup.requestType || undefined,
        });

        const noteResult = await azClient.addNote(customerId, noteText);
        if (noteResult.success) {
          await db
            .update(wrapupDrafts)
            .set({
              status: "completed",
              reviewerDecision: "approved",
              outcome: "note_posted",
              agencyzoomNoteId: noteResult.id?.toString(),
              completedAt: new Date(),
            })
            .where(eq(wrapupDrafts.id, itemId));

          result = { success: true, action: "note", noteId: noteResult.id };
        } else {
          return NextResponse.json({ error: "Failed to post note" }, { status: 500 });
        }
      }

      if (body.action === 'ticket' && customerId && azClient) {
        // First create note
        const noteText = formatNoteText('wrapup', body.noteContent || wrapup.aiCleanedSummary || wrapup.summary || '', {
          phone: wrapup.customerPhone || undefined,
          requestType: wrapup.requestType || undefined,
        });

        let noteId: number | undefined;
        const noteResult = await azClient.addNote(customerId, noteText);
        if (noteResult.success) {
          noteId = noteResult.id;
        }

        // Then create ticket
        const ticketPayload = {
          subject: body.ticketDetails?.subject || `Follow-up: ${wrapup.requestType || 'Call'} - ${wrapup.customerName || 'Customer'}`,
          description: body.ticketDetails?.description || body.noteContent || wrapup.aiCleanedSummary || wrapup.summary || '',
          customerId,
          pipelineId: 1,
          stageId: 1,
          priorityId: body.ticketDetails?.priority === 'high' ? 1 : body.ticketDetails?.priority === 'low' ? 3 : 2,
        };

        const ticketResult = await azClient.createServiceTicket(ticketPayload);
        if (ticketResult.success) {
          await db
            .update(wrapupDrafts)
            .set({
              status: "completed",
              reviewerDecision: "approved",
              outcome: "ticket_created",
              agencyzoomNoteId: noteId?.toString(),
              agencyzoomTicketId: ticketResult.serviceTicketId?.toString(),
              completedAt: new Date(),
            })
            .where(eq(wrapupDrafts.id, itemId));

          result = { success: true, action: "ticket", noteId, ticketId: ticketResult.serviceTicketId };
        } else {
          return NextResponse.json({ error: "Failed to create ticket" }, { status: 500 });
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
            })
            .where(eq(wrapupDrafts.id, itemId));

          result = { success: true, action: "lead", leadId: leadResult.leadId };
        } else {
          return NextResponse.json({ error: "Failed to create lead" }, { status: 500 });
        }
      }
    }

    // =======================================================================
    // HANDLE MESSAGE
    // =======================================================================
    else if (body.itemType === 'message') {
      const [message] = await db
        .select()
        .from(messages)
        .where(eq(messages.id, itemId))
        .limit(1);

      if (!message) {
        return NextResponse.json({ error: "Message not found" }, { status: 404 });
      }

      if (body.action === 'acknowledge' || body.action === 'skip') {
        await db
          .update(messages)
          .set({ isAcknowledged: true })
          .where(eq(messages.id, itemId));

        return NextResponse.json({ success: true, action: body.action, message: "Message acknowledged" });
      }

      if (body.action === 'void') {
        await db
          .update(messages)
          .set({ isAcknowledged: true })
          .where(eq(messages.id, itemId));

        return NextResponse.json({ success: true, action: "void", message: "Message voided" });
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
            .set({ isAcknowledged: true })
            .where(eq(messages.id, itemId));

          result = { success: true, action: "note", noteId: noteResult.id };
        } else {
          return NextResponse.json({ error: "Failed to post note" }, { status: 500 });
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
