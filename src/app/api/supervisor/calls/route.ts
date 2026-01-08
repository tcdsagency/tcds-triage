import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { calls, users, tenants } from "@/db/schema";
import { eq, desc, and, gte, sql } from "drizzle-orm";
import { getThreeCXClient } from "@/lib/api/threecx";

// =============================================================================
// Types
// =============================================================================

interface ActiveCall {
  id: string;
  sessionId: string;
  direction: "inbound" | "outbound";
  status: "ringing" | "connected" | "on_hold" | "wrap_up";
  agentId: string;
  agentName: string;
  agentExtension: string;
  customerName: string;
  customerPhone: string;
  startTime: string;
  duration: number; // seconds
  queueTime?: number; // seconds waited in queue
  isRecording: boolean;
}

interface AgentStatus {
  id: string;
  name: string;
  extension: string;
  status: "available" | "on_call" | "wrap_up" | "away" | "offline";
  currentCallId?: string;
  callsHandled: number;
  avgHandleTime: number; // seconds
  avgTalkTime: number; // seconds
}

interface QueueStats {
  callsWaiting: number;
  longestWait: number; // seconds
  avgWaitTime: number; // seconds
  abandonedToday: number;
  serviceLevelPct: number; // % answered within SLA
}

// =============================================================================
// GET /api/supervisor/calls - Get supervisor dashboard data
// =============================================================================
export async function GET(request: NextRequest) {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID || "00000000-0000-0000-0000-000000000001";
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get all users/agents
    const agents = await db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        extension: users.extension,
        role: users.role,
      })
      .from(users)
      .where(eq(users.tenantId, tenantId));

    // Get today's calls
    const todaysCalls = await db
      .select()
      .from(calls)
      .where(
        and(
          eq(calls.tenantId, tenantId),
          gte(calls.startedAt, today)
        )
      )
      .orderBy(desc(calls.startedAt));

    // Fetch real-time presence from 3CX/VoIPTools
    let presenceMap = new Map<string, string>();
    try {
      const presenceRes = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/3cx/presence`);
      if (presenceRes.ok) {
        const presenceData = await presenceRes.json();
        if (presenceData.team) {
          presenceData.team.forEach((p: any) => {
            if (p.extension) {
              presenceMap.set(p.extension, p.status);
            }
          });
        }
      }
    } catch (e) {
      console.log("[Supervisor] Could not fetch presence data:", e);
    }

    // Calculate agent stats
    const agentStats: AgentStatus[] = agents.map((agent) => {
      const agentCalls = todaysCalls.filter(
        (c) => c.agentId === agent.id
      );

      const completedCalls = agentCalls.filter((c) => c.endedAt);
      const totalTalkTime = completedCalls.reduce((sum, c) => {
        if (c.startedAt && c.endedAt) {
          return sum + (new Date(c.endedAt).getTime() - new Date(c.startedAt).getTime()) / 1000;
        }
        return sum;
      }, 0);

      // Check if agent is on an active call
      const activeCall = agentCalls.find((c) => !c.endedAt);

      // Get presence status from 3CX/VoIPTools if available, otherwise derive from calls
      let status: AgentStatus["status"] = "available";
      const presenceStatus = agent.extension ? presenceMap.get(agent.extension) : null;

      if (presenceStatus) {
        // Map 3CX/VoIPTools presence to our status enum
        if (presenceStatus === "on_call" || presenceStatus === "talking" || presenceStatus === "ringing") {
          status = "on_call";
        } else if (presenceStatus === "away" || presenceStatus === "dnd") {
          status = "away";
        } else if (presenceStatus === "offline") {
          status = "offline";
        } else if (presenceStatus === "available") {
          status = "available";
        }
      } else if (activeCall) {
        // Fallback to DB call status
        status = "on_call";
      }

      return {
        id: agent.id,
        name: `${agent.firstName || ''} ${agent.lastName || ''}`.trim() || 'Unknown',
        extension: agent.extension || '',
        status,
        currentCallId: activeCall?.id,
        callsHandled: completedCalls.length,
        avgHandleTime: completedCalls.length > 0 ? totalTalkTime / completedCalls.length : 0,
        avgTalkTime: completedCalls.length > 0 ? totalTalkTime / completedCalls.length : 0,
      };
    });

    // Get active calls
    const activeCalls: ActiveCall[] = todaysCalls
      .filter((c) => !c.endedAt)
      .map((call) => {
        const agent = agents.find((a) => a.id === call.agentId);
        const duration = call.startedAt
          ? Math.floor((Date.now() - new Date(call.startedAt).getTime()) / 1000)
          : 0;

        return {
          id: call.id,
          sessionId: call.externalCallId || call.id,
          direction: (call.direction as "inbound" | "outbound") || "inbound",
          status: (call.status as ActiveCall["status"]) || "connected",
          agentId: agent?.id || '',
          agentName: agent ? `${agent.firstName || ''} ${agent.lastName || ''}`.trim() : 'Unknown',
          agentExtension: agent?.extension || '',
          customerName: 'Customer', // calls table doesn't have customerName
          customerPhone: call.fromNumber || call.toNumber || '',
          startTime: call.startedAt?.toISOString() || new Date().toISOString(),
          duration,
          isRecording: call.recordingUrl ? true : false,
        };
      });

    // Calculate queue stats (simulated for now - would come from 3CX)
    const answeredCalls = todaysCalls.filter((c) => c.endedAt && c.status !== "missed");
    const missedCalls = todaysCalls.filter((c) => c.status === "missed");

    const queueStats: QueueStats = {
      callsWaiting: activeCalls.filter((c) => c.status === "ringing").length,
      longestWait: 0,
      avgWaitTime: 15, // Placeholder
      abandonedToday: missedCalls.length,
      serviceLevelPct: todaysCalls.length > 0
        ? Math.round((answeredCalls.length / todaysCalls.length) * 100)
        : 100,
    };

    // Calculate summary stats
    const stats = {
      totalCallsToday: todaysCalls.length,
      answeredCalls: answeredCalls.length,
      missedCalls: missedCalls.length,
      activeNow: activeCalls.length,
      avgHandleTime: answeredCalls.length > 0
        ? Math.round(
            answeredCalls.reduce((sum, c) => {
              if (c.startedAt && c.endedAt) {
                return sum + (new Date(c.endedAt).getTime() - new Date(c.startedAt).getTime()) / 1000;
              }
              return sum;
            }, 0) / answeredCalls.length
          )
        : 0,
      agentsOnline: agentStats.filter((a) => a.status !== "offline").length,
      agentsOnCall: agentStats.filter((a) => a.status === "on_call").length,
    };

    return NextResponse.json({
      success: true,
      activeCalls,
      agents: agentStats,
      queue: queueStats,
      stats,
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Supervisor calls error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch supervisor data" },
      { status: 500 }
    );
  }
}

// =============================================================================
// POST /api/supervisor/calls - Perform supervisor action (listen/whisper/barge)
// =============================================================================
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, callId, agentExtension } = body;

    // Validate action
    if (!["listen", "whisper", "barge", "hangup", "hold", "retrieve", "transfer"].includes(action)) {
      return NextResponse.json(
        { success: false, error: "Invalid action" },
        { status: 400 }
      );
    }

    // Get 3CX client (uses OAuth2)
    const threecxClient = await getThreeCXClient();

    if (!threecxClient) {
      // Return success but note that 3CX is not configured
      return NextResponse.json({
        success: true,
        message: `${action} action queued (3CX not configured - demo mode)`,
        demo: true,
      });
    }

    // Execute action using the 3CX client
    try {
      let success = false;
      let message = "";

      switch (action) {
        case "listen":
          success = await threecxClient.monitorCall(callId, agentExtension, "silent");
          message = success ? "Now monitoring call (silent)" : "Failed to monitor call";
          break;

        case "whisper":
          success = await threecxClient.monitorCall(callId, agentExtension, "whisper");
          message = success ? "Now monitoring call (whisper)" : "Failed to start whisper";
          break;

        case "barge":
          success = await threecxClient.monitorCall(callId, agentExtension, "barge");
          message = success ? "Joined call" : "Failed to barge into call";
          break;

        case "hangup":
          success = await threecxClient.dropCall(callId);
          message = success ? "Call ended" : "Failed to end call";
          break;

        case "hold":
          success = await threecxClient.holdCall(callId);
          message = success ? "Call placed on hold" : "Failed to hold call";
          break;

        case "retrieve":
          success = await threecxClient.retrieveCall(callId);
          message = success ? "Call retrieved from hold" : "Failed to retrieve call";
          break;

        case "transfer":
          const { targetExtension, blind } = body;
          if (!targetExtension) {
            return NextResponse.json({
              success: false,
              error: "Target extension required for transfer",
            });
          }
          success = await threecxClient.transferCall(callId, targetExtension, blind);
          message = success
            ? `Call transferred to ${targetExtension}`
            : "Failed to transfer call";
          break;
      }

      return NextResponse.json({ success, message });
    } catch (apiError: any) {
      console.error(`3CX API error:`, apiError);
      return NextResponse.json({
        success: false,
        error: apiError.message || `Failed to execute ${action}`,
      });
    }
  } catch (error) {
    console.error("Supervisor action error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to execute action" },
      { status: 500 }
    );
  }
}
