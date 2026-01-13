// =============================================================================
// VM Events Webhook - Receives events from VM Transcription Bridge
// =============================================================================
// POST /api/vm-events
// Events: transcription_started, transcription_failed, call_ended, session_update
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { calls } from "@/db/schema";
import { eq } from "drizzle-orm";

// =============================================================================
// Types
// =============================================================================

interface VMEvent {
  type: "transcription_started" | "transcription_failed" | "call_ended" | "session_update";
  sessionId: string;
  timestamp: string;
  data?: {
    extension?: string;
    direction?: string;
    externalNumber?: string;
    threeCxCallId?: string;
    error?: string;
    reason?: string;
    callState?: string;
    mediaState?: string;
    segmentCount?: number;
  };
}

// =============================================================================
// Auth Validation
// =============================================================================

function validateAuth(request: NextRequest): boolean {
  const authHeader = request.headers.get("authorization");
  const expectedSecret = process.env.VMBRIDGE_API_KEY || "tcds_vm_bridge_secret_2025";

  if (!authHeader) return false;

  // Support both "Bearer <token>" and raw token
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7)
    : authHeader;

  return token === expectedSecret;
}

// =============================================================================
// POST Handler
// =============================================================================

export async function POST(request: NextRequest) {
  // Validate authentication
  if (!validateAuth(request)) {
    console.error("[VM Events] Unauthorized request");
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const event: VMEvent = await request.json();
    const { type, sessionId, timestamp, data } = event;

    console.log(`[VM Events] Received: ${type} for session ${sessionId}`);

    switch (type) {
      case "transcription_started": {
        // Update call record with transcription status
        await db
          .update(calls)
          .set({
            transcriptionStatus: "active",
            extension: data?.extension || null,
          })
          .where(eq(calls.id, sessionId));

        console.log(`[VM Events] Transcription started for ${sessionId}, ext: ${data?.extension}`);
        break;
      }

      case "transcription_failed": {
        // Mark transcription as failed
        await db
          .update(calls)
          .set({
            transcriptionStatus: "failed",
            transcriptionError: data?.error || data?.reason || "Unknown error",
          })
          .where(eq(calls.id, sessionId));

        console.error(`[VM Events] Transcription failed for ${sessionId}: ${data?.error || data?.reason}`);
        break;
      }

      case "call_ended": {
        // Update call status
        await db
          .update(calls)
          .set({
            transcriptionStatus: "completed",
            transcriptionSegmentCount: data?.segmentCount || 0,
          })
          .where(eq(calls.id, sessionId));

        console.log(`[VM Events] Call ended for ${sessionId}, segments: ${data?.segmentCount || 0}`);
        break;
      }

      case "session_update": {
        // Log session state changes for debugging
        console.log(`[VM Events] Session update for ${sessionId}: call=${data?.callState}, media=${data?.mediaState}`);
        break;
      }

      default:
        console.warn(`[VM Events] Unknown event type: ${type}`);
    }

    return NextResponse.json({ success: true, received: type });
  } catch (error) {
    console.error("[VM Events] Error processing event:", error);
    return NextResponse.json(
      { success: false, error: "Failed to process event" },
      { status: 500 }
    );
  }
}

// =============================================================================
// GET Handler - Health check
// =============================================================================

export async function GET() {
  return NextResponse.json({
    status: "ok",
    endpoint: "/api/vm-events",
    supportedEvents: ["transcription_started", "transcription_failed", "call_ended", "session_update"],
  });
}
