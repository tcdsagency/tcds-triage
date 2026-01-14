// =============================================================================
// VM Events Webhook - Receives events from VM Transcription Bridge
// =============================================================================
// POST /api/vm-events
// Events: transcription_started, transcription_failed, call_ended, session_update
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { calls, customers, liveTranscriptSegments, pendingVmEvents } from "@/db/schema";
import { eq, lt } from "drizzle-orm";
import { getAgencyZoomClient } from "@/lib/api/agencyzoom";

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
  const realtimeUrl = process.env.REALTIME_SERVER_URL || "https://realtime.tcdsagency.com";

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
// AI Summary Generation
// =============================================================================

async function generateAISummary(callId: string) {
  console.log(`[VM Events] Generating AI summary for call ${callId}`);

  // Fetch all transcript segments
  const segments = await db
    .select({
      speaker: liveTranscriptSegments.speaker,
      text: liveTranscriptSegments.text,
      sequenceNumber: liveTranscriptSegments.sequenceNumber,
    })
    .from(liveTranscriptSegments)
    .where(eq(liveTranscriptSegments.callId, callId))
    .orderBy(liveTranscriptSegments.sequenceNumber);

  if (segments.length === 0) {
    console.log(`[VM Events] No segments for call ${callId}`);
    return;
  }

  // Build transcript text
  const transcript = segments
    .map(s => `${s.speaker.toUpperCase()}: ${s.text}`)
    .join("\n");

  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) {
    console.warn("[VM Events] OPENAI_API_KEY not configured - skipping AI summary");
    return;
  }

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are an insurance call analyst. Analyze this call transcript and provide:
1. A brief summary (2-3 sentences)
2. Action items (as JSON array of strings)
3. Overall sentiment (positive/neutral/negative)
4. Key topics discussed (as JSON array of strings)

Respond in this exact JSON format:
{
  "summary": "...",
  "actionItems": ["...", "..."],
  "sentiment": "positive|neutral|negative",
  "topics": ["...", "..."]
}`,
          },
          {
            role: "user",
            content: transcript,
          },
        ],
        temperature: 0.3,
        max_tokens: 500,
      }),
    });

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content;

    if (content) {
      // Parse JSON with error handling
      let analysis;
      try {
        // Clean potential markdown code blocks from response
        const cleanContent = content.replace(/```json\n?|\n?```/g, '').trim();
        analysis = JSON.parse(cleanContent);
      } catch (parseError) {
        console.error(`[VM Events] Failed to parse AI response as JSON:`, content);
        // Fallback: create basic analysis from raw content
        analysis = {
          summary: content.substring(0, 500),
          actionItems: [],
          sentiment: "neutral",
          topics: [],
        };
      }

      await db
        .update(calls)
        .set({
          aiSummary: analysis.summary,
          aiActionItems: analysis.actionItems || [],
          aiSentiment: { overall: analysis.sentiment || "neutral", score: 0, timeline: [] },
          aiTopics: analysis.topics || [],
          updatedAt: new Date(),
        })
        .where(eq(calls.id, callId));

      console.log(`[VM Events] AI summary generated for call ${callId}`);

      // Broadcast AI analysis to realtime subscribers
      await notifyRealtimeServer({
        type: "ai_summary_ready",
        sessionId: callId,
        summary: analysis.summary,
        sentiment: analysis.sentiment,
        actionItems: analysis.actionItems,
        topics: analysis.topics,
      });

      // Trigger AgencyZoom writeback (async)
      writeToAgencyZoom(callId, analysis).catch(err =>
        console.error(`[VM Events] AgencyZoom writeback failed:`, err.message)
      );
    }
  } catch (error) {
    console.error(`[VM Events] AI summary error:`, error);
  }
}

// =============================================================================
// AgencyZoom Writeback
// =============================================================================

async function writeToAgencyZoom(callId: string, analysis: any) {
  // Check if AgencyZoom credentials are configured
  const hasCredentials = process.env.AGENCYZOOM_API_USERNAME && process.env.AGENCYZOOM_API_PASSWORD;
  if (!hasCredentials) {
    console.log("[VM Events] AgencyZoom credentials not configured - skipping writeback");
    return;
  }

  // Get call with customer info
  const [call] = await db
    .select({
      id: calls.id,
      direction: calls.direction,
      durationSeconds: calls.durationSeconds,
      customerId: calls.customerId,
    })
    .from(calls)
    .where(eq(calls.id, callId))
    .limit(1);

  if (!call?.customerId) {
    console.log(`[VM Events] No customer linked to call ${callId}`);
    return;
  }

  // Get customer's AgencyZoom ID
  const [customer] = await db
    .select({
      agencyzoomId: customers.agencyzoomId,
      firstName: customers.firstName,
      lastName: customers.lastName,
    })
    .from(customers)
    .where(eq(customers.id, call.customerId))
    .limit(1);

  if (!customer?.agencyzoomId) {
    console.log(`[VM Events] Customer ${call.customerId} has no AgencyZoom ID`);
    return;
  }

  const durationMin = Math.floor((call.durationSeconds || 0) / 60);
  const durationSec = (call.durationSeconds || 0) % 60;

  const actionItemsList = (analysis.actionItems || []).length > 0
    ? `\n\nAction Items:\n${analysis.actionItems.map((item: string) => `- ${item}`).join("\n")}`
    : "";

  const topicsList = (analysis.topics || []).length > 0
    ? `\n\nTopics: ${analysis.topics.join(", ")}`
    : "";

  const noteContent = `Call Summary (${call.direction === "inbound" ? "Inbound" : "Outbound"})
Duration: ${durationMin}m ${durationSec}s
Sentiment: ${analysis.sentiment || "neutral"}

${analysis.summary || "No summary available."}${actionItemsList}${topicsList}

— Auto-generated by TCDS Triage`;

  try {
    // Use the existing AgencyZoom client with proper auth
    const azClient = getAgencyZoomClient();
    const azId = parseInt(customer.agencyzoomId, 10);

    if (isNaN(azId)) {
      console.error(`[VM Events] Invalid AgencyZoom ID: ${customer.agencyzoomId}`);
      return;
    }

    const result = await azClient.addNote(azId, noteContent);

    if (result.success) {
      await db
        .update(calls)
        .set({
          agencyzoomNoteId: result.id ? String(result.id) : null,
          agencyzoomSyncedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(calls.id, callId));

      console.log(`[VM Events] AgencyZoom note created for call ${callId} (note ID: ${result.id})`);
    } else {
      console.error(`[VM Events] AgencyZoom addNote failed for call ${callId}`);
    }
  } catch (error) {
    console.error(`[VM Events] AgencyZoom error:`, error);
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
        // Try to find the call by threeCxCallId
        let existingCall = null;

        if (threeCxCallId) {
          const [found] = await db
            .select({ id: calls.id })
            .from(calls)
            .where(eq(calls.externalCallId, threeCxCallId))
            .limit(1);
          existingCall = found;
        }

        if (existingCall) {
          // Update call with VM Bridge session info
          await db
            .update(calls)
            .set({
              vmSessionId: sessionId,
              externalNumber: externalNumber,
              transcriptionStatus: "active",
              updatedAt: new Date(),
            })
            .where(eq(calls.id, existingCall.id));

          console.log(`[VM Events] Linked VM session ${sessionId} to call ${existingCall.id}`);

          // Notify realtime
          await notifyRealtimeServer({
            type: "transcription_started",
            sessionId: existingCall.id,
            vmSessionId: sessionId,
          });
        } else {
          // Call not found yet - store pending event for race condition handling
          console.warn(`[VM Events] Call not found for 3CX ID ${threeCxCallId} - storing pending event`);

          if (threeCxCallId) {
            await db.insert(pendingVmEvents).values({
              threecxCallId: threeCxCallId,
              sessionId: sessionId,
              externalNumber: externalNumber || null,
              direction: direction || null,
              extension: extension || null,
              expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 min expiry
            });
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

          // Trigger AI summary generation (async)
          generateAISummary(call.id).catch(err =>
            console.error(`[VM Events] AI summary failed:`, err.message)
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
