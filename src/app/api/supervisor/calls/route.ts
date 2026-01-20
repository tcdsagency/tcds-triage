import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { calls, users, tenants } from "@/db/schema";
import { eq, desc, and, gte, sql } from "drizzle-orm";
import { getThreeCXClient } from "@/lib/api/threecx";
import { getVMBridgeClient } from "@/lib/api/vm-bridge";

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

    // Get all users with extensions (they handle calls)
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
    const presenceMap = new Map<string, string>();
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
      // Presence fetch failed - continue without it
    }

    // Calculate agent stats (only for users with extensions - they handle calls)
    const agentStats: AgentStatus[] = agents.filter(a => a.extension).map((agent) => {
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
        // Map 3CX/VoIPTools presence to our status enum (this is the source of truth)
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
        // Fallback to DB call status only if call is recent (within last 30 minutes)
        // Stale calls without endedAt are likely failed webhook updates
        const callAge = activeCall.startedAt
          ? Date.now() - new Date(activeCall.startedAt).getTime()
          : Infinity;
        const thirtyMinutes = 30 * 60 * 1000;

        if (callAge < thirtyMinutes) {
          status = "on_call";
        }
        // If call is older than 30 minutes, leave status as "available" (stale data)
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

    // Auto-cleanup very stale calls (>2 hours without endedAt) - these are definitely stale
    const twoHoursAgo = Date.now() - (2 * 60 * 60 * 1000);
    const veryStaleCallsToClean = todaysCalls.filter(
      (c) => !c.endedAt && c.startedAt && new Date(c.startedAt).getTime() < twoHoursAgo
    );

    if (veryStaleCallsToClean.length > 0) {
      console.log(`[Supervisor] Auto-cleaning ${veryStaleCallsToClean.length} very stale calls (>2hrs)`);
      Promise.all(
        veryStaleCallsToClean.map((call) =>
          db.update(calls)
            .set({
              status: call.status === "ringing" ? "missed" : "completed",
              endedAt: new Date(),
            })
            .where(eq(calls.id, call.id))
            .catch((e) => console.error(`Failed to cleanup call ${call.id}:`, e))
        )
      );
    }

    // Check for agents on call (per presence) but without a database call record
    // This catches calls that didn't trigger webhooks
    const agentsOnCallPerPresence = agents.filter(a => {
      if (!a.extension) return false;
      const status = presenceMap.get(a.extension);
      return status === "on_call" || status === "talking" || status === "ringing";
    });

    // Create missing call records for agents on call without DB records
    for (const agent of agentsOnCallPerPresence) {
      const hasActiveCall = todaysCalls.some(c =>
        !c.endedAt && c.agentId === agent.id
      );

      if (!hasActiveCall) {
        // Create a call record from presence detection
        try {
          const [newCall] = await db
            .insert(calls)
            .values({
              tenantId,
              direction: "inbound",
              status: "in_progress",
              fromNumber: "Unknown",
              toNumber: agent.extension || "",
              agentId: agent.id,
              extension: agent.extension,
              startedAt: new Date(),
              answeredAt: new Date(),
            })
            .returning();

          // Add to todaysCalls so it shows up
          todaysCalls.push(newCall);
          console.log(`[Supervisor] Created call record from presence for ${agent.firstName} ${agent.lastName} (${agent.extension})`);

          // Start VM Bridge transcription for this call
          if (agent.extension) {
            try {
              const vmBridge = await getVMBridgeClient();
              if (vmBridge) {
                console.log(`[Supervisor] Starting transcription for presence-detected call ${newCall.id}, ext=${agent.extension}`);
                const session = await vmBridge.startTranscription(newCall.id, agent.extension);
                if (session) {
                  console.log(`[Supervisor] Transcription started: session=${session.sessionId}`);
                  // Update call with VM session ID
                  await db
                    .update(calls)
                    .set({ vmSessionId: session.sessionId, transcriptionStatus: "active" })
                    .where(eq(calls.id, newCall.id));
                }
              }
            } catch (transcriptError) {
              console.error(`[Supervisor] Failed to start transcription:`, transcriptError);
            }
          }
        } catch (err) {
          // Ignore errors - might be race condition
        }
      }
    }

    // Get active calls - use presence as source of truth
    // Only show calls where the agent's presence confirms they're on a call
    const activeCalls: ActiveCall[] = todaysCalls
      .filter((c) => {
        if (c.endedAt) return false;
        if (!c.startedAt) return false;
        const startTime = new Date(c.startedAt).getTime();
        // Exclude calls older than 2 hours (definitely stale)
        if (startTime < twoHoursAgo) return false;

        // Check presence - if agent shows as available/away/offline, call is stale
        const agent = agents.find((a) => a.id === c.agentId);
        if (agent?.extension) {
          const agentPresence = presenceMap.get(agent.extension);
          if (agentPresence && agentPresence !== "on_call" && agentPresence !== "talking" && agentPresence !== "ringing") {
            // Agent is not on a call per presence - mark this call as ended in background
            db.update(calls)
              .set({
                status: c.status === "ringing" ? "missed" : "completed",
                endedAt: new Date(),
              })
              .where(eq(calls.id, c.id))
              .catch(() => {}); // Silently fail cleanup
            return false;
          }
        }
        return true;
      })
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
