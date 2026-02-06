// =============================================================================
// VM Events Webhook - Receives events from VM Transcription Bridge
// =============================================================================
// POST /api/vm-events
// Events: transcription_started, transcription_failed, call_ended, session_update
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { calls, customers, pendingVmEvents, pendingTranscriptJobs, users } from "@/db/schema";
import { eq, lt, and, or, gt, desc, sql } from "drizzle-orm";

// =============================================================================
// Types
// =============================================================================

interface VMEvent {
  // New format (recommended)
  event?: string;
  sessionId: string;
  threeCxCallId?: string;
  extension?: string;
  direction?: string;
  externalNumber?: string;
  duration?: number;
  segments?: number;
  reason?: string;
  timestamp?: number;

  // Legacy format
  type?: string;
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
  const xApiKey = request.headers.get("X-Api-Key") || request.headers.get("x-api-key");
  const expectedSecret = process.env.VMBRIDGE_API_KEY || process.env.VM_API_SECRET;

  if (!expectedSecret) {
    console.warn("[VM Events] No API key configured - allowing request");
    return true;
  }

  // Check X-Api-Key header
  if (xApiKey === expectedSecret) return true;

  // Check Bearer token
  if (authHeader) {
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7)
      : authHeader;
    if (token === expectedSecret) return true;
  }

  return false;
}

// =============================================================================
// Realtime Notification
// =============================================================================

async function notifyRealtimeServer(event: Record<string, any>) {
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
      console.error(`[VM Events] Realtime broadcast failed: ${response.status}`);
    }
  } catch (error) {
    console.error("[VM Events] Failed to notify realtime:", error);
  }
}

// =============================================================================
// Queue Transcript Job for SQL Server Polling
// =============================================================================
// Instead of processing live transcript immediately, we queue a job to poll
// SQL Server (source of truth) for the authoritative transcript.

async function queueTranscriptJob(
  callId: string,
  tenantId: string | null,
  callerNumber: string | null,
  agentExtension: string | null,
  callStartedAt: Date,
  callEndedAt: Date
) {
  console.log(`[VM Events] Queuing transcript job for call ${callId}`);

  try {
    // Initial delay of 30 seconds to let SQL Server catch up
    const initialDelay = 30;
    const nextAttemptAt = new Date(Date.now() + initialDelay * 1000);

    await db.insert(pendingTranscriptJobs).values({
      tenantId: tenantId,
      callId: callId,
      callerNumber: callerNumber,
      agentExtension: agentExtension,
      callStartedAt: callStartedAt,
      callEndedAt: callEndedAt,
      status: "pending",
      attemptCount: 0,
      nextAttemptAt: nextAttemptAt,
    });

    console.log(`[VM Events] Transcript job queued for call ${callId} - first attempt at ${nextAttemptAt.toISOString()}`);

    // Notify UI that transcript processing is pending
    await notifyRealtimeServer({
      type: "transcript_processing",
      sessionId: callId,
      status: "pending",
      message: "Waiting for SQL Server transcript...",
    });
  } catch (error) {
    console.error(`[VM Events] Failed to queue transcript job:`, error);
  }
}

// =============================================================================
// Cleanup Expired Pending Events
// =============================================================================

async function cleanupExpiredPendingEvents() {
  try {
    const result = await db
      .delete(pendingVmEvents)
      .where(lt(pendingVmEvents.expiresAt, new Date()))
      .returning({ id: pendingVmEvents.id });

    if (result.length > 0) {
      console.log(`[VM Events] Cleaned up ${result.length} expired pending events`);
    }
  } catch (error) {
    // Don't fail the request if cleanup fails
    console.error("[VM Events] Cleanup error:", error);
  }
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

  // Cleanup expired events periodically (1 in 10 chance per request)
  if (Math.random() < 0.1) {
    cleanupExpiredPendingEvents();
  }

  try {
    const body: VMEvent = await request.json();

    // Support both new and legacy formats
    const eventType = body.event || body.type || "";
    const sessionId = body.sessionId;
    const threeCxCallId = body.threeCxCallId || body.data?.threeCxCallId;
    const extension = body.extension || body.data?.extension;
    const direction = body.direction || body.data?.direction;
    const externalNumber = body.externalNumber || body.data?.externalNumber;
    const duration = body.duration;
    const segments = body.segments || body.data?.segmentCount;
    const reason = body.reason || body.data?.error || body.data?.reason;

    console.log(`[VM Events] Received: ${eventType} sessionId=${sessionId} 3cxId=${threeCxCallId}`);

    switch (eventType) {
      case "transcription_started": {
        // Try to find the call by threeCxCallId or vmSessionId
        let existingCall = null;

        // First try by VM session ID
        if (sessionId) {
          const [bySession] = await db
            .select({ id: calls.id })
            .from(calls)
            .where(eq(calls.vmSessionId, sessionId))
            .limit(1);
          if (bySession) existingCall = bySession;
        }

        // Then try by threeCxCallId
        if (!existingCall && threeCxCallId) {
          const [found] = await db
            .select({ id: calls.id })
            .from(calls)
            .where(eq(calls.externalCallId, threeCxCallId))
            .limit(1);
          existingCall = found;
        }

        // Look up agent by extension
        let agentId: string | null = null;
        if (extension) {
          const [agent] = await db
            .select({ id: users.id })
            .from(users)
            .where(eq(users.extension, extension))
            .limit(1);
          agentId = agent?.id || null;
        }

        // If no existing call found by vmSessionId/threeCxCallId, also check for
        // recent calls created by presence detection (which have "Unknown" fromNumber or no externalCallId)
        if (!existingCall && agentId) {
          const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
          const [presenceCall] = await db
            .select({ id: calls.id, fromNumber: calls.fromNumber, externalCallId: calls.externalCallId })
            .from(calls)
            .where(
              and(
                eq(calls.agentId, agentId),
                or(
                  eq(calls.status, "ringing"),
                  eq(calls.status, "in_progress")
                ),
                gt(calls.createdAt, fiveMinutesAgo),
                // Only match calls that don't have an externalCallId (presence-created)
                // or have "Unknown" as fromNumber
                or(
                  sql`${calls.externalCallId} IS NULL`,
                  eq(calls.fromNumber, "Unknown")
                )
              )
            )
            .orderBy(desc(calls.createdAt))
            .limit(1);

          if (presenceCall) {
            console.log(`[VM Events] Found presence-detected call ${presenceCall.id} for ext=${extension}, linking to VM session ${sessionId}`);
            existingCall = presenceCall;

            // Also link the externalCallId so future events can find it
            if (threeCxCallId) {
              await db
                .update(calls)
                .set({ externalCallId: threeCxCallId })
                .where(eq(calls.id, presenceCall.id));
              console.log(`[VM Events] Linked externalCallId ${threeCxCallId} to presence call ${presenceCall.id}`);
            }
          }
        }

        // Also try to find by extension alone if still no match (wider search)
        if (!existingCall && extension) {
          const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
          const [extCall] = await db
            .select({ id: calls.id, fromNumber: calls.fromNumber })
            .from(calls)
            .where(
              and(
                eq(calls.extension, extension),
                or(eq(calls.status, "ringing"), eq(calls.status, "in_progress")),
                gt(calls.createdAt, fiveMinutesAgo),
                sql`${calls.externalCallId} IS NULL`
              )
            )
            .orderBy(desc(calls.createdAt))
            .limit(1);

          if (extCall) {
            console.log(`[VM Events] Found call by extension ${extension}: ${extCall.id}`);
            existingCall = extCall;

            if (threeCxCallId) {
              await db
                .update(calls)
                .set({ externalCallId: threeCxCallId })
                .where(eq(calls.id, extCall.id));
            }
          }
        }

        if (existingCall) {
          // Update call with VM Bridge session info AND agent
          const isOutbound = direction === "outbound";
          await db
            .update(calls)
            .set({
              vmSessionId: sessionId,
              externalNumber: externalNumber || undefined,
              transcriptionStatus: "active",
              agentId: agentId || undefined,
              direction: direction ? (isOutbound ? "outbound" : "inbound") : undefined,
              // Update fromNumber if it was "Unknown" (presence-detected)
              fromNumber: externalNumber && !isOutbound ? externalNumber : undefined,
              updatedAt: new Date(),
            })
            .where(eq(calls.id, existingCall.id));

          console.log(`[VM Events] Linked VM session ${sessionId} to call ${existingCall.id}, agent=${agentId}, updated fromNumber=${externalNumber}`);

          // Notify realtime with updated caller info to refresh screen pop
          await notifyRealtimeServer({
            type: "transcription_started",
            sessionId: existingCall.id,
            vmSessionId: sessionId,
            fromNumber: externalNumber,
            externalNumber: externalNumber,
          });
        } else {
          // No existing call - CREATE one for screen pop
          // This ensures the call shows up immediately in the UI
          const tenantId = process.env.DEFAULT_TENANT_ID;

          if (tenantId && extension) {
            console.log(`[VM Events] Creating call for transcription: ext=${extension} session=${sessionId}`);

            // Look up agent by extension
            const [agent] = await db
              .select({ id: users.id })
              .from(users)
              .where(eq(users.extension, extension))
              .limit(1);

            const isOutbound = direction === "outbound";
            const customerPhone = isOutbound ? externalNumber : externalNumber;

            // Look up customer by phone number
            let customerId: string | null = null;
            if (customerPhone) {
              try {
                const phoneDigits = customerPhone.replace(/\D/g, "").slice(-10);
                const [customer] = await db
                  .select({ id: customers.id })
                  .from(customers)
                  .where(
                    and(
                      eq(customers.tenantId, tenantId),
                      or(
                        sql`${customers.phone} LIKE ${'%' + phoneDigits}`,
                        sql`${customers.phoneAlt} LIKE ${'%' + phoneDigits}`
                      )
                    )
                  )
                  .limit(1);
                if (customer) {
                  customerId = customer.id;
                  console.log(`[VM Events] Matched customer ${customerId} for phone ${phoneDigits}`);
                }
              } catch (err) {
                console.error(`[VM Events] Customer lookup failed:`, err);
              }
            }

            const [newCall] = await db
              .insert(calls)
              .values({
                tenantId,
                vmSessionId: sessionId,
                externalCallId: threeCxCallId || null,
                fromNumber: isOutbound ? extension : (externalNumber || "Unknown"),
                toNumber: isOutbound ? (externalNumber || "Unknown") : extension,
                externalNumber: externalNumber || null,
                direction: isOutbound ? "outbound" : "inbound",
                status: "in_progress",
                transcriptionStatus: "active",
                agentId: agent?.id || null,
                customerId: customerId,
                startedAt: new Date(),
                answeredAt: new Date(),
              })
              .returning();

            console.log(`[VM Events] Created call ${newCall.id} for ext=${extension} agent=${agent?.id || 'none'}`);

            // Notify realtime for screen pop - use call_ringing to trigger popup
            await notifyRealtimeServer({
              type: "call_ringing",
              callId: newCall.id,
              sessionId: newCall.id,
              vmSessionId: sessionId,
              extension,
              direction: newCall.direction,
              externalNumber,
              fromNumber: newCall.fromNumber,
              toNumber: newCall.toNumber,
            });
          } else {
            // Store pending event as fallback
            console.warn(`[VM Events] Cannot create call - missing tenant or extension`);
            if (threeCxCallId) {
              await db.insert(pendingVmEvents).values({
                threecxCallId: threeCxCallId,
                sessionId: sessionId,
                externalNumber: externalNumber || null,
                direction: direction || null,
                extension: extension || null,
                expiresAt: new Date(Date.now() + 5 * 60 * 1000),
              });
            }
          }
        }
        break;
      }

      case "call_ended": {
        // Find call by VM session ID (most reliable) or threeCxCallId
        let call = null;

        // Try by VM session ID first
        const [bySession] = await db
          .select()
          .from(calls)
          .where(eq(calls.vmSessionId, sessionId))
          .limit(1);

        if (bySession) {
          call = bySession;
        } else if (threeCxCallId) {
          // Try by external call ID
          const [byExternal] = await db
            .select()
            .from(calls)
            .where(eq(calls.externalCallId, threeCxCallId))
            .limit(1);
          call = byExternal;
        }

        // If still no match, try to find by extension (presence-created calls)
        if (!call && extension) {
          const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
          const [extCall] = await db
            .select()
            .from(calls)
            .where(
              and(
                eq(calls.extension, extension),
                or(
                  eq(calls.status, "ringing"),
                  eq(calls.status, "in_progress")
                ),
                gt(calls.createdAt, tenMinutesAgo),
                or(
                  sql`${calls.externalCallId} IS NULL`,
                  eq(calls.fromNumber, "Unknown")
                )
              )
            )
            .orderBy(desc(calls.createdAt))
            .limit(1);

          if (extCall) {
            console.log(`[VM Events] call_ended: Found presence call by extension ${extension}: ${extCall.id}`);
            call = extCall;

            // Link the IDs for transcript processing
            if (threeCxCallId || sessionId) {
              await db
                .update(calls)
                .set({
                  externalCallId: threeCxCallId || undefined,
                  vmSessionId: sessionId || undefined,
                })
                .where(eq(calls.id, extCall.id));
            }
          }
        }

        if (call) {
          // Update with final stats
          await db
            .update(calls)
            .set({
              transcriptionStatus: "completed",
              transcriptionSegmentCount: segments || 0,
              directionFinal: direction as "inbound" | "outbound" | undefined,
              durationSeconds: duration,
              status: "completed",
              endedAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(calls.id, call.id));

          console.log(`[VM Events] Call ${call.id} ended: ${duration}s, ${segments} segments`);

          // Notify realtime
          await notifyRealtimeServer({
            type: "call_ended",
            sessionId: call.id,
            duration,
            segments,
          });

          // Queue transcript job to poll SQL Server (source of truth)
          // The transcript worker will fetch the authoritative transcript from
          // 3CX Recording Manager SQL Server and run AI extraction on that.
          queueTranscriptJob(
            call.id,
            call.tenantId,
            externalNumber || null,
            extension || null,
            call.createdAt || new Date(),
            new Date()
          ).catch(err =>
            console.error(`[VM Events] Failed to queue transcript job:`, err.message)
          );
        } else {
          console.warn(`[VM Events] Call not found for session ${sessionId} or 3CX ID ${threeCxCallId}`);
        }
        break;
      }

      case "transcription_failed": {
        // Find call
        let callId = null;

        const [bySession] = await db
          .select({ id: calls.id })
          .from(calls)
          .where(eq(calls.vmSessionId, sessionId))
          .limit(1);

        if (bySession) {
          callId = bySession.id;
        } else if (threeCxCallId) {
          const [byExternal] = await db
            .select({ id: calls.id })
            .from(calls)
            .where(eq(calls.externalCallId, threeCxCallId))
            .limit(1);
          if (byExternal) callId = byExternal.id;
        }

        if (callId) {
          await db
            .update(calls)
            .set({
              transcriptionStatus: "failed",
              transcriptionError: reason,
              updatedAt: new Date(),
            })
            .where(eq(calls.id, callId));

          console.log(`[VM Events] Transcription failed for call ${callId}: ${reason}`);
        }
        break;
      }

      case "session_update": {
        // Log session state changes for debugging
        console.log(`[VM Events] Session update for ${sessionId}: call=${body.data?.callState}, media=${body.data?.mediaState}`);
        break;
      }

      default:
        console.warn(`[VM Events] Unknown event type: ${eventType}`);
    }

    return NextResponse.json({ success: true, received: eventType });
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
