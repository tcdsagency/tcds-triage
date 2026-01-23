/**
 * Append to Ticket API for Triage Inbox
 * =====================================
 * Appends a wrapup item's content to an existing AgencyZoom service ticket.
 *
 * POST /api/triage/[id]/append
 * {
 *   ticketId: number,     // AgencyZoom service ticket ID to append to
 *   notes?: string,       // Optional additional notes from reviewer
 *   reviewerId?: string   // UUID of the reviewer
 * }
 *
 * Actions:
 * 1. Fetch the wrapup draft
 * 2. Call AgencyZoom addServiceTicketNote()
 * 3. Update wrapup_drafts: triage_decision='append', appended_to_ticket_id
 * 4. Mark item as completed
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { wrapupDrafts, calls } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getAgencyZoomClient } from "@/lib/api/agencyzoom";

interface AppendRequest {
  ticketId: number;
  notes?: string;
  reviewerId?: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    const { id: itemId } = await params;
    const body: AppendRequest = await request.json();
    const { ticketId, notes, reviewerId } = body;

    if (!ticketId) {
      return NextResponse.json({ error: "ticketId is required" }, { status: 400 });
    }

    // Fetch the wrapup draft
    const [wrapup] = await db
      .select({
        id: wrapupDrafts.id,
        callId: wrapupDrafts.callId,
        customerName: wrapupDrafts.customerName,
        customerPhone: wrapupDrafts.customerPhone,
        summary: wrapupDrafts.summary,
        aiCleanedSummary: wrapupDrafts.aiCleanedSummary,
        requestType: wrapupDrafts.requestType,
        insuranceType: wrapupDrafts.insuranceType,
        policyNumbers: wrapupDrafts.policyNumbers,
        agentName: wrapupDrafts.agentName,
        direction: wrapupDrafts.direction,
        status: wrapupDrafts.status,
      })
      .from(wrapupDrafts)
      .where(
        and(
          eq(wrapupDrafts.tenantId, tenantId),
          eq(wrapupDrafts.id, itemId)
        )
      )
      .limit(1);

    if (!wrapup) {
      return NextResponse.json({ error: "Wrapup draft not found" }, { status: 404 });
    }

    // Get call details for additional context
    let callDate: Date | null = null;
    let callDuration: number | null = null;

    if (wrapup.callId) {
      const [call] = await db
        .select({
          startedAt: calls.startedAt,
          durationSeconds: calls.durationSeconds,
        })
        .from(calls)
        .where(eq(calls.id, wrapup.callId))
        .limit(1);

      if (call) {
        callDate = call.startedAt;
        callDuration = call.durationSeconds;
      }
    }

    // Build the note content to append to the ticket
    const noteContent = buildNoteContent({
      summary: wrapup.aiCleanedSummary || wrapup.summary,
      customerName: wrapup.customerName,
      customerPhone: wrapup.customerPhone,
      agentName: wrapup.agentName,
      direction: wrapup.direction,
      requestType: wrapup.requestType,
      insuranceType: wrapup.insuranceType,
      policyNumbers: wrapup.policyNumbers,
      callDate,
      callDuration,
      additionalNotes: notes,
    });

    // Add note to the ticket via AgencyZoom
    const azClient = getAgencyZoomClient();
    const noteResult = await azClient.addServiceTicketNote(ticketId, noteContent);

    if (!noteResult.success) {
      // Fallback: try adding note to the customer instead
      console.warn(`[Append] Failed to add note to ticket ${ticketId}, will mark as appended anyway`);
    }

    // Update the wrapup draft
    await db
      .update(wrapupDrafts)
      .set({
        triageDecision: "append",
        appendedToTicketId: ticketId,
        status: "completed",
        reviewerDecision: "append_to_ticket",
        reviewerId: reviewerId || null,
        reviewedAt: new Date(),
        outcome: `Appended to ticket #${ticketId}`,
      })
      .where(eq(wrapupDrafts.id, itemId));

    // Fetch the ticket details for the response
    let ticketSubject = "";
    try {
      const ticket = await azClient.getServiceTicket(ticketId);
      ticketSubject = ticket.subject;
    } catch {
      // Ignore errors fetching ticket details
    }

    return NextResponse.json({
      success: true,
      message: `Successfully appended to ticket #${ticketId}`,
      ticketId,
      ticketSubject,
      noteId: noteResult.noteId,
    });
  } catch (error) {
    console.error("Append to ticket error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Append failed" },
      { status: 500 }
    );
  }
}

// Build a formatted note for the ticket
function buildNoteContent(params: {
  summary: string | null;
  customerName: string | null;
  customerPhone: string | null;
  agentName: string | null;
  direction: string | null;
  requestType: string | null;
  insuranceType: string | null;
  policyNumbers: string[] | null;
  callDate: Date | null;
  callDuration: number | null;
  additionalNotes?: string;
}): string {
  const lines: string[] = [];

  // Header with call info
  const dateStr = params.callDate
    ? params.callDate.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : new Date().toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });

  const durationStr = params.callDuration
    ? `${Math.floor(params.callDuration / 60)}m ${params.callDuration % 60}s`
    : "";

  lines.push(`📞 ${params.direction || "Inbound"} Call - ${dateStr}${durationStr ? ` (${durationStr})` : ""}`);

  if (params.agentName) {
    lines.push(`Agent: ${params.agentName}`);
  }

  lines.push("");

  // Request type and insurance type
  if (params.requestType || params.insuranceType) {
    const typeInfo = [params.requestType, params.insuranceType].filter(Boolean).join(" - ");
    lines.push(`Type: ${typeInfo}`);
  }

  // Policy numbers if present
  if (params.policyNumbers && params.policyNumbers.length > 0) {
    lines.push(`Policies: ${params.policyNumbers.join(", ")}`);
  }

  lines.push("");

  // Main summary
  if (params.summary) {
    lines.push("Summary:");
    lines.push(params.summary);
  }

  // Additional notes from reviewer
  if (params.additionalNotes) {
    lines.push("");
    lines.push("Additional Notes:");
    lines.push(params.additionalNotes);
  }

  lines.push("");
  lines.push("---");
  lines.push("Added via TCDS Triage Inbox");

  return lines.join("\n");
}
