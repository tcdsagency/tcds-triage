// API Route: POST /api/triage-log/match
// Match a pending wrapup to a customer and post note to AgencyZoom

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { wrapupDrafts, calls, customers } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getAgencyZoomClient } from "@/lib/api/agencyzoom";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { callId, customerId } = body;

    if (!callId || !customerId) {
      return NextResponse.json(
        { success: false, error: "callId and customerId are required" },
        { status: 400 }
      );
    }

    // Look up the wrapup draft for this call
    const [wrapup] = await db
      .select({
        id: wrapupDrafts.id,
        aiCleanedSummary: wrapupDrafts.aiCleanedSummary,
        noteAutoPosted: wrapupDrafts.noteAutoPosted,
        isAutoVoided: wrapupDrafts.isAutoVoided,
        agencyzoomTicketId: wrapupDrafts.agencyzoomTicketId,
        agencyzoomNoteId: wrapupDrafts.agencyzoomNoteId,
      })
      .from(wrapupDrafts)
      .where(eq(wrapupDrafts.callId, callId))
      .limit(1);

    if (!wrapup) {
      return NextResponse.json(
        { success: false, error: "No wrapup found for this call" },
        { status: 404 }
      );
    }

    if (wrapup.noteAutoPosted) {
      return NextResponse.json(
        { success: false, error: "Note already posted for this call" },
        { status: 400 }
      );
    }

    // Look up the customer to get their AZ ID
    const [customer] = await db
      .select({
        id: customers.id,
        agencyzoomId: customers.agencyzoomId,
        firstName: customers.firstName,
        lastName: customers.lastName,
        isLead: customers.isLead,
      })
      .from(customers)
      .where(eq(customers.id, customerId))
      .limit(1);

    if (!customer) {
      return NextResponse.json(
        { success: false, error: "Customer not found" },
        { status: 404 }
      );
    }

    if (!customer.agencyzoomId) {
      return NextResponse.json(
        { success: false, error: "Customer has no AgencyZoom ID" },
        { status: 400 }
      );
    }

    // Look up call details for the note
    const [call] = await db
      .select({
        directionFinal: calls.directionFinal,
        directionLive: calls.directionLive,
        startedAt: calls.startedAt,
        aiSummary: calls.aiSummary,
        agentId: calls.agentId,
      })
      .from(calls)
      .where(eq(calls.id, callId))
      .limit(1);

    const direction = call?.directionFinal || call?.directionLive || "inbound";
    const summary = wrapup.aiCleanedSummary || call?.aiSummary || "Call completed - no summary available";
    const callTime = call?.startedAt
      ? call.startedAt.toLocaleTimeString("en-US", { timeZone: "America/Chicago", hour: "numeric", minute: "2-digit" })
      : "";
    const callDate = call?.startedAt
      ? call.startedAt.toLocaleDateString("en-US", { timeZone: "America/Chicago", month: "numeric", day: "numeric", year: "numeric" })
      : "";

    // Post note to AgencyZoom
    const azClient = getAgencyZoomClient();
    if (!azClient) {
      return NextResponse.json(
        { success: false, error: "AgencyZoom client not configured" },
        { status: 500 }
      );
    }

    const noteText = `📞 ${direction === "inbound" ? "Inbound" : "Outbound"} Call - ${callDate} ${callTime}\n\n${summary}\n\nMatched manually via Triage Log`;

    const azId = parseInt(customer.agencyzoomId);
    const result = customer.isLead
      ? await azClient.addLeadNote(azId, noteText)
      : await azClient.addNote(azId, noteText);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: `Failed to post note to AgencyZoom ${customer.isLead ? 'lead' : 'customer'}` },
        { status: 500 }
      );
    }

    // Update wrapup draft
    const now = new Date();
    await db
      .update(wrapupDrafts)
      .set({
        noteAutoPosted: true,
        noteAutoPostedAt: now,
        completionAction: "posted",
        status: "completed",
        completedAt: now,
        matchStatus: "matched",
        customerName: `${customer.firstName || ""} ${customer.lastName || ""}`.trim(),
        agencyzoomNoteId: result.id?.toString() || null,
      })
      .where(eq(wrapupDrafts.id, wrapup.id));

    // Also update the call's customer_id if not set
    await db
      .update(calls)
      .set({ customerId: customer.id })
      .where(eq(calls.id, callId));

    return NextResponse.json({
      success: true,
      noteId: result.id || null,
      customerName: `${customer.firstName || ""} ${customer.lastName || ""}`.trim(),
    });
  } catch (error: any) {
    console.error("[Triage Match API] Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to match customer" },
      { status: 500 }
    );
  }
}
