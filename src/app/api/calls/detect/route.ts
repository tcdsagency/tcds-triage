// =============================================================================
// Call Detection API - Screen Pop Trigger via VoIPTools Presence
// =============================================================================
// GET /api/calls/detect?extension=XXX
// This endpoint is polled by CallProvider to detect new calls when:
// - VM Bridge isn't capturing the call (e.g., Twilio forwarded calls)
// - WebSocket events are missed
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { calls, users, customers } from "@/db/schema";
import { eq, and, or, ilike, desc } from "drizzle-orm";
import { getVoIPToolsRelayClient } from "@/lib/api/voiptools-relay";

// =============================================================================
// Realtime Notification
// =============================================================================

async function notifyRealtimeServer(event: Record<string, unknown>) {
  const realtimeUrl = process.env.REALTIME_SERVER_URL;
  if (!realtimeUrl) return; // Skip if no realtime server configured

  try {
    const response = await fetch(`${realtimeUrl}/api/broadcast`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": process.env.REALTIME_API_KEY || "",
      },
      body: JSON.stringify(event),
    });

    if (!response.ok) {
      console.error(`[Call Detect] Realtime broadcast failed: ${response.status}`);
    }
  } catch (error) {
    console.error("[Call Detect] Failed to notify realtime:", error);
  }
}

// =============================================================================
// Phone Normalization
// =============================================================================

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "").slice(-10);
}

// =============================================================================
// GET Handler
// =============================================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const extension = searchParams.get("extension");

    if (!extension) {
      return NextResponse.json(
        { success: false, error: "Extension required" },
        { status: 400 }
      );
    }

    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json(
        { success: false, error: "Tenant not configured" },
        { status: 500 }
      );
    }

    // Look up agent by extension
    const [agent] = await db
      .select({ id: users.id, firstName: users.firstName, lastName: users.lastName })
      .from(users)
      .where(and(eq(users.tenantId, tenantId), eq(users.extension, extension)))
      .limit(1);

    if (!agent) {
      return NextResponse.json(
        { success: false, error: "Agent not found for extension" },
        { status: 404 }
      );
    }

    // Check VoIPTools presence
    const voiptools = await getVoIPToolsRelayClient();
    if (!voiptools) {
      return NextResponse.json({
        success: false,
        error: "VoIPTools not configured",
      }, { status: 503 });
    }

    const presence = await voiptools.getPresence(extension);
    const statusText = presence?.StatusText?.toLowerCase() || "";

    // Check for on-call indicators
    const isOnCall = statusText.includes("isincall: true") ||
                     statusText.includes("isincall:true") ||
                     statusText.includes("talking") ||
                     statusText.includes("ringing");

    if (!isOnCall) {
      // Not on a call - check if there's a stale active call in DB
      const [staleCall] = await db
        .select({ id: calls.id })
        .from(calls)
        .where(
          and(
            eq(calls.tenantId, tenantId),
            eq(calls.agentId, agent.id),
            or(eq(calls.status, "ringing"), eq(calls.status, "in_progress"))
          )
        )
        .limit(1);

      if (staleCall) {
        // Mark as completed since VoIPTools says not on call
        await db
          .update(calls)
          .set({ status: "completed", endedAt: new Date() })
          .where(eq(calls.id, staleCall.id));
      }

      return NextResponse.json({
        success: true,
        isOnCall: false,
        call: null,
      });
    }

    // User IS on a call - check if we already have an active call in DB
    const [existingCall] = await db
      .select({
        id: calls.id,
        direction: calls.direction,
        directionLive: calls.directionLive,
        status: calls.status,
        fromNumber: calls.fromNumber,
        toNumber: calls.toNumber,
        externalNumber: calls.externalNumber,
        customerId: calls.customerId,
        startedAt: calls.startedAt,
      })
      .from(calls)
      .where(
        and(
          eq(calls.tenantId, tenantId),
          eq(calls.agentId, agent.id),
          or(eq(calls.status, "ringing"), eq(calls.status, "in_progress"))
        )
      )
      .orderBy(desc(calls.createdAt))
      .limit(1);

    if (existingCall) {
      // Return existing call - no need to create
      const direction = existingCall.directionLive || existingCall.direction || "inbound";
      const phoneNumber = existingCall.externalNumber ||
        (direction === "inbound" ? existingCall.fromNumber : existingCall.toNumber);

      return NextResponse.json({
        success: true,
        isOnCall: true,
        call: {
          id: existingCall.id,
          sessionId: existingCall.id,
          direction,
          phoneNumber: phoneNumber || "Unknown",
          status: existingCall.status,
          customerId: existingCall.customerId,
          startedAt: existingCall.startedAt,
          extension,
          source: "database",
        },
      });
    }

    // No existing call in DB - CREATE one to trigger screen pop
    // This handles cases where VM Bridge didn't capture the call

    const [newCall] = await db
      .insert(calls)
      .values({
        tenantId,
        agentId: agent.id,
        fromNumber: "Unknown", // Will be updated when we get more info
        toNumber: extension,
        direction: "inbound", // Assume inbound, will be updated
        status: "in_progress",
        transcriptionStatus: null, // No transcription for presence-detected calls
        startedAt: new Date(),
        answeredAt: new Date(),
        disposition: null, // Will be determined later
      })
      .returning();

    // NOTE: Do NOT broadcast call_ringing here - we don't have the phone number yet.
    // The actual call event (from webhook/VM Bridge) will provide the phone number
    // and trigger the proper screen pop. Broadcasting "Unknown" causes double popups.

    return NextResponse.json({
      success: true,
      isOnCall: true,
      call: {
        id: newCall.id,
        sessionId: newCall.id,
        direction: "inbound",
        phoneNumber: "Unknown",
        status: "in_progress",
        customerId: null,
        startedAt: newCall.startedAt,
        extension,
        source: "presence_created",
      },
      message: "Call created from presence detection",
    });
  } catch (error) {
    console.error("[Call Detect] Error:", error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Detection failed",
    }, { status: 500 });
  }
}
