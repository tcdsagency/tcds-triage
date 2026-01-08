// API Route: /api/calls/[sessionId]
// Get call details and manage call state

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { calls, liveTranscriptSegments } from "@/db/schema";
import { eq, sql } from "drizzle-orm";

// Helper to check if string is a valid UUID
const isValidUUID = (str: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

// Look up call by sessionId (UUID or externalCallId)
async function findCall(sessionId: string) {
  let call = null;

  // Try by UUID first
  if (isValidUUID(sessionId)) {
    call = await db
      .select()
      .from(calls)
      .where(eq(calls.id, sessionId))
      .limit(1)
      .then(r => r[0]);
  }

  // Fall back to externalCallId
  if (!call) {
    call = await db
      .select()
      .from(calls)
      .where(eq(calls.externalCallId, sessionId))
      .limit(1)
      .then(r => r[0]);
  }

  return call;
}

// GET - Fetch call details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    const call = await findCall(sessionId);

    if (!call) {
      return NextResponse.json(
        { success: false, error: "Call not found" },
        { status: 404 }
      );
    }

    // Get transcript segment count
    const segmentCount = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(liveTranscriptSegments)
      .where(eq(liveTranscriptSegments.callId, call.id))
      .then(r => r[0]?.count || 0);

    return NextResponse.json({
      success: true,
      call: {
        id: call.id,
        externalCallId: call.externalCallId,
        status: call.status,
        direction: call.direction,
        fromNumber: call.fromNumber,
        toNumber: call.toNumber,
        startedAt: call.startedAt,
        endedAt: call.endedAt,
        agentId: call.agentId,
        transcriptSegments: segmentCount,
      },
    });
  } catch (error) {
    console.error("[Calls] Get call error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to get call" },
      { status: 500 }
    );
  }
}

// PATCH - Update call (end call, change status)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    const body = await request.json();

    const call = await findCall(sessionId);

    if (!call) {
      return NextResponse.json(
        { success: false, error: "Call not found" },
        { status: 404 }
      );
    }

    const updates: Record<string, any> = {};

    // Handle end call action
    if (body.action === "end" || body.status === "completed") {
      updates.status = "completed";
      updates.endedAt = new Date();
      console.log(`[Calls] Ending call ${call.id} (sessionId: ${sessionId})`);
    } else if (body.status) {
      updates.status = body.status;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({
        success: true,
        message: "No changes",
        call: { id: call.id },
      });
    }

    // Apply updates
    await db
      .update(calls)
      .set(updates)
      .where(eq(calls.id, call.id));

    return NextResponse.json({
      success: true,
      message: updates.endedAt ? "Call ended" : "Call updated",
      call: {
        id: call.id,
        status: updates.status || call.status,
        endedAt: updates.endedAt || call.endedAt,
      },
    });
  } catch (error) {
    console.error("[Calls] Update call error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update call" },
      { status: 500 }
    );
  }
}

// DELETE - End call (alternative to PATCH)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    const call = await findCall(sessionId);

    if (!call) {
      return NextResponse.json(
        { success: false, error: "Call not found" },
        { status: 404 }
      );
    }

    await db
      .update(calls)
      .set({
        status: "completed",
        endedAt: new Date(),
      })
      .where(eq(calls.id, call.id));

    console.log(`[Calls] Deleted/ended call ${call.id} (sessionId: ${sessionId})`);

    return NextResponse.json({
      success: true,
      message: "Call ended",
      callId: call.id,
    });
  } catch (error) {
    console.error("[Calls] Delete call error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to end call" },
      { status: 500 }
    );
  }
}
