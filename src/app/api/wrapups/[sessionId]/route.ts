// API Route: /api/wrapups/[sessionId]
// Fetches wrap-up data for a call session (already has AI summary from background worker)

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { wrapupDrafts, calls } from "@/db/schema";
import { eq, and, or } from "drizzle-orm";

// =============================================================================
// GET - Fetch Wrap-up Draft by Session ID or Call ID
// =============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    const tenantId = process.env.DEFAULT_TENANT_ID;

    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    if (!sessionId) {
      return NextResponse.json({ error: "Session ID required" }, { status: 400 });
    }

    // First, try to find the call by external call ID or internal ID
    const [call] = await db
      .select({
        id: calls.id,
        externalCallId: calls.externalCallId,
        fromNumber: calls.fromNumber,
        toNumber: calls.toNumber,
        direction: calls.direction,
        status: calls.status,
        durationSeconds: calls.durationSeconds,
        transcription: calls.transcription,
        aiSummary: calls.aiSummary,
      })
      .from(calls)
      .where(
        and(
          eq(calls.tenantId, tenantId),
          or(
            eq(calls.id, sessionId),
            eq(calls.externalCallId, sessionId)
          )
        )
      )
      .limit(1);

    if (!call) {
      return NextResponse.json({
        success: false,
        error: "Call not found",
        status: "not_found",
      }, { status: 404 });
    }

    // Look for existing wrap-up draft
    const [wrapup] = await db
      .select({
        id: wrapupDrafts.id,
        callId: wrapupDrafts.callId,
        status: wrapupDrafts.status,
        direction: wrapupDrafts.direction,
        agentName: wrapupDrafts.agentName,
        customerName: wrapupDrafts.customerName,
        customerPhone: wrapupDrafts.customerPhone,
        customerEmail: wrapupDrafts.customerEmail,
        policyNumbers: wrapupDrafts.policyNumbers,
        insuranceType: wrapupDrafts.insuranceType,
        requestType: wrapupDrafts.requestType,
        summary: wrapupDrafts.summary,
        aiCleanedSummary: wrapupDrafts.aiCleanedSummary,
        aiProcessingStatus: wrapupDrafts.aiProcessingStatus,
        aiExtraction: wrapupDrafts.aiExtraction,
        aiConfidence: wrapupDrafts.aiConfidence,
        matchStatus: wrapupDrafts.matchStatus,
        reviewerDecision: wrapupDrafts.reviewerDecision,
        outcome: wrapupDrafts.outcome,
        createdAt: wrapupDrafts.createdAt,
      })
      .from(wrapupDrafts)
      .where(eq(wrapupDrafts.callId, call.id))
      .limit(1);

    if (wrapup) {
      // Wrap-up draft exists - return it with AI summary
      return NextResponse.json({
        success: true,
        status: wrapup.status,
        hasWrapup: true,
        wrapup: {
          ...wrapup,
          aiConfidence: wrapup.aiConfidence ? parseFloat(wrapup.aiConfidence) : null,
        },
        call: {
          id: call.id,
          direction: call.direction,
          durationSeconds: call.durationSeconds,
        },
      });
    }

    // No wrap-up draft yet - check if transcript is available
    if (call.transcription) {
      // Transcript exists but no wrapup draft yet (maybe still processing)
      return NextResponse.json({
        success: true,
        status: "pending_processing",
        hasWrapup: false,
        hasTranscript: true,
        call: {
          id: call.id,
          direction: call.direction,
          durationSeconds: call.durationSeconds,
          transcription: call.transcription,
          aiSummary: call.aiSummary,
        },
      });
    }

    // No transcript yet - still waiting for MSSQL fetch
    return NextResponse.json({
      success: true,
      status: "pending_transcript",
      hasWrapup: false,
      hasTranscript: false,
      message: "Transcript not yet available. It may still be processing from the phone system.",
      call: {
        id: call.id,
        direction: call.direction,
        durationSeconds: call.durationSeconds,
      },
    });
  } catch (error) {
    console.error("Wrapup fetch error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Fetch failed" },
      { status: 500 }
    );
  }
}
