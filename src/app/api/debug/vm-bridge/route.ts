import { NextRequest, NextResponse } from "next/server";
import { getVMBridgeClient } from "@/lib/api/vm-bridge";
import { db } from "@/db";
import { calls } from "@/db/schema";
import { desc, and, gte, or, eq } from "drizzle-orm";

// GET /api/debug/vm-bridge - Test VM Bridge connectivity and recent call status
export async function GET(request: NextRequest) {
  try {
    const vmBridge = await getVMBridgeClient();

    if (!vmBridge) {
      return NextResponse.json({
        success: false,
        error: "VM Bridge not configured",
        config: {
          VMBRIDGE_URL: process.env.VMBRIDGE_URL ? "SET" : "NOT SET",
          VMBRIDGE_API_KEY: process.env.VMBRIDGE_API_KEY ? "SET" : "NOT SET",
          DEEPGRAM_API_KEY: process.env.DEEPGRAM_API_KEY ? "SET" : "NOT SET",
        }
      });
    }

    // Check VM Bridge health
    const health = await vmBridge.healthCheck();

    // Get active sessions from VM Bridge
    let activeSessions: any[] = [];
    try {
      activeSessions = await vmBridge.getActiveSessions();
    } catch (e) {
      // Ignore errors getting sessions
    }

    // Get recent calls with transcription status
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const recentCalls = await db
      .select({
        id: calls.id,
        direction: calls.direction,
        status: calls.status,
        fromNumber: calls.fromNumber,
        toNumber: calls.toNumber,
        extension: calls.extension,
        vmSessionId: calls.vmSessionId,
        externalCallId: calls.externalCallId,
        transcriptionStatus: calls.transcriptionStatus,
        createdAt: calls.createdAt,
        startedAt: calls.startedAt,
        endedAt: calls.endedAt,
      })
      .from(calls)
      .where(gte(calls.createdAt, today))
      .orderBy(desc(calls.createdAt))
      .limit(20);

    // Categorize calls
    const activeCalls = recentCalls.filter(c => !c.endedAt);
    const withTranscription = recentCalls.filter(c => c.vmSessionId);
    const outboundCalls = recentCalls.filter(c => c.direction === "outbound");

    return NextResponse.json({
      success: true,
      vmBridge: {
        url: vmBridge.getBridgeUrl(),
        health,
        activeSessions: activeSessions.length,
        sessions: activeSessions,
      },
      calls: {
        todayTotal: recentCalls.length,
        active: activeCalls.length,
        withTranscription: withTranscription.length,
        outbound: outboundCalls.length,
        recentCalls: recentCalls.map(c => ({
          id: c.id.slice(0, 8),
          direction: c.direction,
          status: c.status,
          from: c.fromNumber?.slice(-10),
          to: c.toNumber?.slice(-10),
          ext: c.extension,
          vmSession: c.vmSessionId ? "YES" : "NO",
          transcription: c.transcriptionStatus || "none",
          age: c.createdAt ? Math.round((Date.now() - new Date(c.createdAt).getTime()) / 60000) + "m" : "?",
        })),
      },
    });
  } catch (error) {
    console.error("[Debug VM Bridge] Error:", error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

// POST /api/debug/vm-bridge - Manually start transcription for a call
export async function POST(request: NextRequest) {
  try {
    const { callId, extension } = await request.json();

    if (!extension) {
      return NextResponse.json({ success: false, error: "Extension required" }, { status: 400 });
    }

    const vmBridge = await getVMBridgeClient();
    if (!vmBridge) {
      return NextResponse.json({ success: false, error: "VM Bridge not configured" }, { status: 500 });
    }

    console.log(`[Debug VM Bridge] Starting transcription for call ${callId || 'new'}, ext=${extension}`);

    const session = await vmBridge.startTranscription(callId || `debug_${Date.now()}`, extension);

    if (session) {
      // If callId provided, update the call record
      if (callId) {
        await db
          .update(calls)
          .set({ vmSessionId: session.sessionId, transcriptionStatus: "active" })
          .where(eq(calls.id, callId));
      }
    }

    return NextResponse.json({
      success: !!session,
      session,
      message: session ? "Transcription started" : "Failed to start transcription",
    });
  } catch (error) {
    console.error("[Debug VM Bridge] Error:", error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
