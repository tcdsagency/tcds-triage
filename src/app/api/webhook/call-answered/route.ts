// API Route: /api/webhook/call-answered
// Called when an agent answers a ringing call (assigns ownership)
// Also triggers live transcription via VM Bridge

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { calls, users } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getVMBridgeClient } from "@/lib/api/vm-bridge";

// Notify realtime server
async function notifyRealtimeServer(event: Record<string, unknown>) {
  const realtimeUrl = process.env.REALTIME_SERVER_URL;
  if (!realtimeUrl) return; // Skip if no realtime server configured

  try {
    await fetch(`${realtimeUrl}/api/broadcast`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": process.env.REALTIME_API_KEY || "",
      },
      body: JSON.stringify(event),
    });
    console.log(`[Call-Answered] Broadcasted to realtime server`);
  } catch (error) {
    console.error("[Call-Answered] Failed to notify realtime server:", error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log("[Call-Answered] Received:", JSON.stringify(body, null, 2));

    const tenantId = process.env.DEFAULT_TENANT_ID || "00000000-0000-0000-0000-000000000001";
    const { callId, sessionId, extension } = body;

    // Find the call by external call ID
    const externalId = callId || sessionId;
    const [existingCall] = await db
      .select()
      .from(calls)
      .where(and(eq(calls.tenantId, tenantId), eq(calls.externalCallId, externalId)))
      .limit(1);

    if (!existingCall) {
      console.warn(`[Call-Answered] No call found for callId ${externalId}`);
      return NextResponse.json({ success: false, error: "Call not found" }, { status: 404 });
    }

    // Find the agent by extension
    let agentId: string | undefined;
    let agentName: string | undefined;
    if (extension) {
      const [agent] = await db
        .select({ id: users.id, firstName: users.firstName, lastName: users.lastName })
        .from(users)
        .where(and(eq(users.tenantId, tenantId), eq(users.extension, extension)))
        .limit(1);

      if (agent) {
        agentId = agent.id;
        agentName = `${agent.firstName || ''} ${agent.lastName || ''}`.trim() || 'Unknown';
        console.log(`[Call-Answered] Agent: ${agentName} (${extension})`);
      }
    }

    // Update call record with answering agent, status, and extension
    await db
      .update(calls)
      .set({
        status: "in_progress",
        agentId: agentId || existingCall.agentId,
        answeredAt: new Date(),
        extension: extension || existingCall.extension, // Ensure extension is stored
        transcriptionStatus: "starting", // About to start transcription
        updatedAt: new Date(),
      })
      .where(eq(calls.id, existingCall.id));

    console.log(`[Call-Answered] Updated call ${existingCall.id} - answered by ext ${extension}`);

    // Start live transcription via VM Bridge
    console.log(`[Call-Answered] ========== TRANSCRIPTION START ==========`);
    console.log(`[Call-Answered] Extension from request: ${extension || "NOT PROVIDED"}`);
    console.log(`[Call-Answered] Session ID: ${existingCall.id}`);

    let transcriptionStarted = false;
    let transcriptionError: string | null = null;

    if (!extension) {
      console.error(`[Call-Answered] Cannot start transcription: No extension provided in request!`);
      console.error(`[Call-Answered] Request body:`, JSON.stringify(body, null, 2));
      transcriptionError = "No extension provided";
    } else {
      try {
        const vmBridge = await getVMBridgeClient();
        if (vmBridge) {
          const threecxCallId = body.callId || body.sessionId;
          console.log(`[Call-Answered] VM Bridge client obtained`);
          console.log(`[Call-Answered] Starting transcription for session ${existingCall.id}, ext ${extension}, 3CX callId ${threecxCallId}`);

          const session = await vmBridge.startTranscription(existingCall.id, extension, String(threecxCallId));

          if (session) {
            console.log(`[Call-Answered] Transcription started successfully:`, JSON.stringify(session, null, 2));
            transcriptionStarted = true;
          } else {
            console.warn(`[Call-Answered] Transcription start returned null`);
            transcriptionError = "VM Bridge returned null";
          }
        } else {
          console.warn(`[Call-Answered] VM Bridge not configured - transcription skipped`);
          console.warn(`[Call-Answered] VMBRIDGE_URL:`, process.env.VMBRIDGE_URL ? "SET" : "NOT SET");
          console.warn(`[Call-Answered] DEEPGRAM_API_KEY:`, process.env.DEEPGRAM_API_KEY ? "SET" : "NOT SET");
          transcriptionError = "VM Bridge not configured";
        }
      } catch (err) {
        console.error(`[Call-Answered] Failed to start transcription:`, err);
        console.error(`[Call-Answered] Error details:`, err instanceof Error ? err.message : String(err));
        transcriptionError = err instanceof Error ? err.message : String(err);
      }
    }

    // Update transcription status based on result
    await db
      .update(calls)
      .set({
        transcriptionStatus: transcriptionStarted ? "active" : "failed",
        transcriptionError: transcriptionError,
        updatedAt: new Date(),
      })
      .where(eq(calls.id, existingCall.id));

    console.log(`[Call-Answered] ========== TRANSCRIPTION START COMPLETE (success: ${transcriptionStarted}) ==========`);

    // Broadcast to realtime server
    await notifyRealtimeServer({
      type: "call_answered",
      sessionId: existingCall.id,
      extension,
      agentId,
      agentName,
      status: "in_progress",
    });

    return NextResponse.json({
      success: true,
      sessionId: existingCall.id,
      extension,
      agentId,
      agentName,
      status: "in_progress",
      transcriptionStarted,
      transcriptionError,
    });
  } catch (error) {
    console.error("[Call-Answered] Error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Processing failed" },
      { status: 500 }
    );
  }
}
