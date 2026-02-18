// API Route: /api/webhook/call-answered
// Called when an agent answers a ringing call (assigns ownership)

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { calls, users } from "@/db/schema";
import { eq, and } from "drizzle-orm";

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
        extension: extension || existingCall.extension,
        updatedAt: new Date(),
      })
      .where(eq(calls.id, existingCall.id));

    console.log(`[Call-Answered] Updated call ${existingCall.id} - answered by ext ${extension}`);

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
    });
  } catch (error) {
    console.error("[Call-Answered] Error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Processing failed" },
      { status: 500 }
    );
  }
}
