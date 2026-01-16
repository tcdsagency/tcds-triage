// API Route: /api/calls/[sessionId]
// Get call details and manage call state

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { calls, liveTranscriptSegments } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { getThreeCXClient } from "@/lib/api/threecx";

// Helper to check if string is a valid UUID
const isValidUUID = (str: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

// Look up call by sessionId (UUID, vmSessionId, or externalCallId)
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

  // Try by vmSessionId (sess_xxx format from VM bridge)
  if (!call && sessionId.startsWith('sess_')) {
    call = await db
      .select()
      .from(calls)
      .where(eq(calls.vmSessionId, sessionId))
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

// PATCH - Update call (end call, hold, resume, transfer, change status)
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
    const action = body.action;

    // Get the 3CX call ID for call control actions
    const externalCallId = call.externalCallId;

    // Get agent extension for 3CX Call Control API (used as DN)
    const agentExtension = call.extension;

    // ========================================================================
    // HOLD - Put call on hold using 3CX Call Control API
    // ========================================================================
    if (action === "hold") {
      if (!externalCallId) {
        return NextResponse.json(
          { success: false, error: "No external call ID - cannot control call" },
          { status: 400 }
        );
      }

      console.log(`[Calls] Putting call ${call.id} on hold (3CX ID: ${externalCallId}, ext: ${agentExtension})`);
      console.log(`[Calls] DEFAULT_TENANT_ID: ${process.env.DEFAULT_TENANT_ID}`);

      const threecxClient = await getThreeCXClient();
      console.log(`[Calls] 3CX client available: ${!!threecxClient}`);

      if (threecxClient) {
        try {
          const success = await threecxClient.holdCall(externalCallId, agentExtension || undefined);
          console.log(`[Calls] holdCall result: ${success}`);
          if (success) {
            updates.status = "on_hold";
            await db.update(calls).set(updates).where(eq(calls.id, call.id));
            return NextResponse.json({
              success: true,
              message: "Call placed on hold",
              call: { id: call.id, status: "on_hold" },
            });
          }
          return NextResponse.json(
            { success: false, error: "Hold failed - no active participant found on extension" },
            { status: 400 }
          );
        } catch (err: any) {
          console.error("[Calls] holdCall error:", err);
          return NextResponse.json(
            { success: false, error: `Hold failed: ${err.message}` },
            { status: 500 }
          );
        }
      }

      return NextResponse.json(
        { success: false, error: "3CX client not available - check tenant configuration" },
        { status: 500 }
      );
    }

    // ========================================================================
    // RESUME - Retrieve call from hold using 3CX Call Control API
    // ========================================================================
    if (action === "resume") {
      if (!externalCallId) {
        return NextResponse.json(
          { success: false, error: "No external call ID - cannot control call" },
          { status: 400 }
        );
      }

      console.log(`[Calls] Resuming call ${call.id} from hold (3CX ID: ${externalCallId}, ext: ${agentExtension})`);

      const threecxClient = await getThreeCXClient();
      if (threecxClient) {
        const success = await threecxClient.retrieveCall(externalCallId, agentExtension || undefined);
        if (success) {
          updates.status = "active";
          await db.update(calls).set(updates).where(eq(calls.id, call.id));
          return NextResponse.json({
            success: true,
            message: "Call resumed",
            call: { id: call.id, status: "active" },
          });
        }
      }

      return NextResponse.json(
        { success: false, error: "Failed to resume call - 3CX API not available" },
        { status: 500 }
      );
    }

    // ========================================================================
    // TRANSFER - Transfer call using 3CX Call Control API
    // ========================================================================
    if (action === "transfer") {
      const { targetExtension, blind = true } = body;

      if (!targetExtension) {
        return NextResponse.json(
          { success: false, error: "Target extension required for transfer" },
          { status: 400 }
        );
      }

      if (!externalCallId) {
        return NextResponse.json(
          { success: false, error: "No external call ID - cannot control call" },
          { status: 400 }
        );
      }

      console.log(`[Calls] Transferring call ${call.id} to ext ${targetExtension} (blind: ${blind}, 3CX ID: ${externalCallId}, ext: ${agentExtension})`);

      const threecxClient = await getThreeCXClient();
      if (threecxClient) {
        const success = await threecxClient.transferCall(externalCallId, targetExtension, blind, agentExtension || undefined);
        if (success) {
          updates.status = "transferred";
          await db.update(calls).set(updates).where(eq(calls.id, call.id));
          return NextResponse.json({
            success: true,
            message: `Call transferred to ${targetExtension}`,
            call: { id: call.id, status: "transferred" },
          });
        }
      }

      return NextResponse.json(
        { success: false, error: "Failed to transfer call - 3CX API not available" },
        { status: 500 }
      );
    }

    // ========================================================================
    // END - End the call using 3CX Call Control API
    // ========================================================================
    if (action === "end" || body.status === "completed") {
      let threecxDropped = false;
      let threecxError: string | null = null;

      // Try to actually drop the call via 3CX if we have an external call ID
      if (externalCallId && agentExtension) {
        console.log(`[Calls] Ending call ${call.id} via 3CX Call Control API (3CX ID: ${externalCallId}, ext: ${agentExtension})`);

        const threecxClient = await getThreeCXClient();
        console.log(`[Calls] 3CX client available for drop: ${!!threecxClient}`);

        if (threecxClient) {
          try {
            threecxDropped = await threecxClient.dropCall(externalCallId, agentExtension);
            console.log(`[Calls] dropCall result: ${threecxDropped}`);
            if (!threecxDropped) {
              threecxError = "No active call found on extension (call may have already ended)";
            }
          } catch (err: any) {
            threecxError = err.message;
            console.error("[Calls] 3CX drop call error:", err.message);
          }
        } else {
          threecxError = "3CX client not available";
        }
      } else {
        threecxError = `Missing externalCallId (${externalCallId}) or extension (${agentExtension})`;
        console.log(`[Calls] Cannot drop call - ${threecxError}`);
      }

      updates.status = "completed";
      updates.endedAt = new Date();
      console.log(`[Calls] Marking call ${call.id} as completed (sessionId: ${sessionId}, 3cxDropped: ${threecxDropped})`);

      // Update database
      await db
        .update(calls)
        .set(updates)
        .where(eq(calls.id, call.id));

      return NextResponse.json({
        success: true,
        message: threecxDropped ? "Call ended" : "Call marked as ended (phone may need manual hangup)",
        threecxDropped,
        threecxError,
        call: {
          id: call.id,
          status: "completed",
          endedAt: updates.endedAt,
        },
      });
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
