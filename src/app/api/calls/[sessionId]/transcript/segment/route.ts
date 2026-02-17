// API Route: /api/calls/[sessionId]/transcript/segment
// Webhook endpoint to receive transcript segments from VM Bridge

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { calls, liveTranscriptSegments } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { nanoid } from "nanoid";

// =============================================================================
// Entity Detection - Extract structured data from transcript text
// =============================================================================

type EntityType = 'VIN' | 'POLICY_NUMBER' | 'PHONE' | 'DATE' | 'MONEY' | 'ADDRESS';

interface DetectedEntity {
  type: EntityType;
  value: string;
  confidence: number;
}

function detectEntities(text: string): DetectedEntity[] {
  const entities: DetectedEntity[] = [];

  // VIN detection (17 alphanumeric, no I, O, Q)
  const vinRegex = /\b[A-HJ-NPR-Z0-9]{17}\b/gi;
  const vins = text.match(vinRegex);
  if (vins) {
    vins.forEach(vin => entities.push({ type: 'VIN', value: vin.toUpperCase(), confidence: 0.9 }));
  }

  // Policy number patterns (common formats)
  const policyRegex = /\b(POL|AUTO|HOME|UMB)?[-\s]?(\d{6,12})\b/gi;
  const policies = text.match(policyRegex);
  if (policies) {
    policies.forEach(p => entities.push({ type: 'POLICY_NUMBER', value: p, confidence: 0.7 }));
  }

  // Phone numbers
  const phoneRegex = /\b(\+?1?[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})\b/g;
  const phones = text.match(phoneRegex);
  if (phones) {
    phones.forEach(p => entities.push({ type: 'PHONE', value: p.replace(/\D/g, ''), confidence: 0.85 }));
  }

  // Dates (various formats)
  const dateRegex = /\b(0?[1-9]|1[0-2])[\/\-](0?[1-9]|[12][0-9]|3[01])[\/\-](\d{2,4})\b/g;
  const dates = text.match(dateRegex);
  if (dates) {
    dates.forEach(d => entities.push({ type: 'DATE', value: d, confidence: 0.8 }));
  }

  // Dollar amounts
  const moneyRegex = /\$[\d,]+\.?\d{0,2}/g;
  const amounts = text.match(moneyRegex);
  if (amounts) {
    amounts.forEach(a => entities.push({ type: 'MONEY', value: a, confidence: 0.9 }));
  }

  // Addresses (basic detection)
  const addressRegex = /\b\d{1,5}\s+[\w\s]+(?:street|st|avenue|ave|road|rd|drive|dr|lane|ln|way|court|ct|circle|cir)\b/gi;
  const addresses = text.match(addressRegex);
  if (addresses) {
    addresses.forEach(a => entities.push({ type: 'ADDRESS', value: a, confidence: 0.6 }));
  }

  return entities;
}

// =============================================================================
// Sentiment Detection - Simple keyword-based sentiment analysis
// =============================================================================

function detectSentiment(text: string): 'positive' | 'neutral' | 'negative' {
  const lowerText = text.toLowerCase();

  const positiveWords = ['thank', 'great', 'appreciate', 'happy', 'excellent', 'perfect', 'wonderful', 'love', 'amazing', 'helpful'];
  const negativeWords = ['angry', 'upset', 'frustrated', 'terrible', 'horrible', 'worst', 'hate', 'ridiculous', 'unacceptable', 'disappointed', 'annoyed'];

  let score = 0;
  positiveWords.forEach(w => { if (lowerText.includes(w)) score++; });
  negativeWords.forEach(w => { if (lowerText.includes(w)) score--; });

  if (score > 0) return 'positive';
  if (score < 0) return 'negative';
  return 'neutral';
}

// =============================================================================
// Session Resolution - Find call by various ID formats
// =============================================================================

async function resolveCallId(sessionId: string, agentExtension?: string): Promise<string | null> {
  const isValidUUID = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

  // 1. Try as direct UUID (call.id)
  if (isValidUUID(sessionId)) {
    const [call] = await db
      .select({ id: calls.id })
      .from(calls)
      .where(eq(calls.id, sessionId))
      .limit(1);
    if (call) return call.id;
  }

  // 2. Try as VM Bridge session ID (most reliable for VM Bridge)
  if (sessionId.startsWith('sess_')) {
    const [call] = await db
      .select({ id: calls.id })
      .from(calls)
      .where(eq(calls.vmSessionId, sessionId))
      .limit(1);
    if (call) {
      console.log(`[Transcript] Resolved vmSessionId ${sessionId} to call ${call.id}`);
      return call.id;
    }
  }

  // 3. Try as external call ID (3CX call ID)
  const [byExternal] = await db
    .select({ id: calls.id })
    .from(calls)
    .where(eq(calls.externalCallId, sessionId))
    .limit(1);
  if (byExternal) {
    console.log(`[Transcript] Resolved externalCallId ${sessionId} to call ${byExternal.id}`);
    return byExternal.id;
  }

  // 4. Drachtio fallback - find most recent active call (last resort)
  if (sessionId.startsWith('drachtio-')) {
    console.log(`[Transcript] Drachtio fallback ID: ${sessionId}, finding active call...`);
    const [call] = await db
      .select({ id: calls.id })
      .from(calls)
      .where(eq(calls.status, 'in_progress'))
      .orderBy(sql`${calls.startedAt} DESC`)
      .limit(1);
    if (call) {
      console.log(`[Transcript] Mapped drachtio ID to active call: ${call.id}`);
      return call.id;
    }
  }

  // 5. sess_ without vmSessionId match - find active call by extension or most recent (fallback)
  if (sessionId.startsWith('sess_')) {
    console.log(`[Transcript] VM Bridge session ${sessionId} not linked, finding active call (ext=${agentExtension || 'unknown'})...`);

    let call: { id: string; status: string | null } | undefined;

    // 5a. If we have an agent extension, find the active call for THAT specific extension
    if (agentExtension) {
      [call] = await db
        .select({ id: calls.id, status: calls.status })
        .from(calls)
        .where(sql`${calls.extension} = ${agentExtension} AND ${calls.status} IN ('in_progress', 'ringing')`)
        .orderBy(sql`${calls.startedAt} DESC`)
        .limit(1);

      if (call) {
        console.log(`[Transcript] Found active call for ext=${agentExtension}: ${call.id}`);
      }
    }

    // 5b. Fallback to most recent active call (only if no extension match)
    if (!call) {
      [call] = await db
        .select({ id: calls.id, status: calls.status })
        .from(calls)
        .where(sql`${calls.status} IN ('in_progress', 'ringing')`)
        .orderBy(sql`${calls.startedAt} DESC`)
        .limit(1);
    }

    if (call) {
      // Link this session to the call for future lookups
      await db
        .update(calls)
        .set({
          vmSessionId: sessionId,
          status: 'in_progress',
          answeredAt: call.status === 'ringing' ? new Date() : undefined,
          updatedAt: new Date(),
        })
        .where(eq(calls.id, call.id));
      console.log(`[Transcript] Linked VM session ${sessionId} to call ${call.id}`);
      return call.id;
    }

    // 6. No call exists at all - AUTO-CREATE one for this session
    // This handles the case where VM Bridge starts transcribing before any webhook creates the call
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (tenantId) {
      console.log(`[Transcript] Auto-creating call for VM session ${sessionId}`);
      const [newCall] = await db
        .insert(calls)
        .values({
          tenantId,
          vmSessionId: sessionId,
          fromNumber: 'Unknown',
          toNumber: 'Unknown',
          direction: 'inbound',
          status: 'in_progress',
          transcriptionStatus: 'active',
          startedAt: new Date(),
          answeredAt: new Date(),
        })
        .returning();
      console.log(`[Transcript] Auto-created call ${newCall.id} for session ${sessionId}`);
      return newCall.id;
    }
  }

  console.warn(`[Transcript] Could not resolve session: ${sessionId}`);
  return null;
}

// Push transcript segment to realtime WebSocket server
async function pushToRealtimeServer(event: {
  type: string;
  sessionId: string;
  speaker?: string;
  text?: string;
  confidence?: number;
  timestamp?: string;
  sequenceNumber?: number;
  segmentId?: string;
  isFinal?: boolean;
  sentiment?: 'positive' | 'neutral' | 'negative';
  entities?: Array<{ type: string; value: string; confidence: number }>;
}) {
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
      console.error(`[Transcript] Realtime push failed: ${response.status}`);
    }
  } catch (error) {
    console.error("[Transcript] Failed to push to realtime:", error);
  }
}

// Verify webhook API key (supports both X-Api-Key and Authorization headers)
function verifyWebhookKey(request: NextRequest): boolean {
  const webhookKey = process.env.WEBHOOK_API_KEY?.trim();

  // Check X-Api-Key header (VM Bridge format) - try both cases
  const xApiKey = (request.headers.get("x-api-key") || request.headers.get("X-Api-Key"))?.trim();

  // If no webhook key configured, allow (dev mode)
  if (!webhookKey) {
    console.warn("[Transcript] WEBHOOK_API_KEY not configured, allowing request");
    return true;
  }

  // Allow if key matches
  if (xApiKey === webhookKey) {
    return true;
  }

  // Log mismatch for debugging (show full length to detect whitespace issues)
  console.log("[Transcript] Auth mismatch - received len:", xApiKey?.length, "expected len:", webhookKey?.length);

  // Check Authorization: Bearer header
  const authHeader = request.headers.get("Authorization");
  if (authHeader) {
    const [type, token] = authHeader.split(" ");
    if (type === "Bearer" && token === webhookKey) {
      return true;
    }
  }

  return false;
}

interface SegmentRequest {
  speaker: "agent" | "customer" | "system";
  text: string;
  confidence?: number;
  callId?: string;
  isFinal?: boolean;
  timestamp?: string;
  agentExtension?: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    // Verify webhook authentication
    if (!verifyWebhookKey(request)) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { sessionId } = await params;
    const body: SegmentRequest = await request.json();

    if (!body.text || !body.speaker) {
      return NextResponse.json(
        { error: "Missing required fields: text, speaker" },
        { status: 400 }
      );
    }

    // Resolve session ID to call UUID using proper chain
    const callId = await resolveCallId(sessionId, body.agentExtension);

    if (!callId) {
      console.warn(`[Transcript] Call not found for sessionId: ${sessionId}`);
      return NextResponse.json(
        { error: "Call not found" },
        { status: 404 }
      );
    }

    // Detect entities and sentiment in the transcript text
    const entities = detectEntities(body.text);
    const sentiment = detectSentiment(body.text);

    // Get next sequence number
    const countResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(liveTranscriptSegments)
      .where(eq(liveTranscriptSegments.callId, callId));

    const sequenceNumber = (countResult[0]?.count || 0) + 1;
    const now = new Date();

    // Store segment in database with entities and sentiment
    const [segment] = await db
      .insert(liveTranscriptSegments)
      .values({
        id: nanoid(12),
        callId,
        speaker: body.speaker,
        text: body.text,
        confidence: body.confidence ?? 0.9,
        timestamp: body.timestamp ? new Date(body.timestamp) : now,
        sequenceNumber,
        isFinal: body.isFinal ?? true,
        sentiment,
        entities: entities.length > 0 ? entities : null,
      })
      .returning();

    console.log(`[Transcript] Segment ${sequenceNumber} stored for call ${callId}: "${body.text.substring(0, 50)}..." [${sentiment}]`);

    // Update segment count on the call record for tracking
    await db
      .update(calls)
      .set({
        transcriptionSegmentCount: sequenceNumber,
        transcriptionStatus: "active",
        updatedAt: new Date(),
      })
      .where(eq(calls.id, callId));

    // Push to realtime WebSocket server for live UI updates
    pushToRealtimeServer({
      type: "transcript_segment",
      sessionId: callId,
      speaker: body.speaker,
      text: body.text,
      confidence: body.confidence ?? 0.9,
      timestamp: segment.timestamp.toISOString(),
      sequenceNumber,
      segmentId: segment.id,
      isFinal: body.isFinal ?? true,
      sentiment,
      entities: entities.length > 0 ? entities : undefined,
    });

    // If negative sentiment detected, send alert
    if (sentiment === 'negative') {
      pushToRealtimeServer({
        type: "sentiment_alert",
        sessionId: callId,
        sentiment: 'negative',
        text: body.text.substring(0, 100),
        sequenceNumber,
      });
    }

    // If entities detected, broadcast for UI highlighting
    if (entities.length > 0) {
      pushToRealtimeServer({
        type: "entities_detected",
        sessionId: callId,
        entities,
        sequenceNumber,
      });
    }

    return NextResponse.json({
      success: true,
      segmentId: segment.id,
      sequenceNumber,
      sentiment,
      entitiesDetected: entities.length,
    });
  } catch (error) {
    console.error("[Transcript] Segment error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to store segment" },
      { status: 500 }
    );
  }
}

// GET - Retrieve all segments for a call
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    const { searchParams } = new URL(request.url);
    const afterSeq = parseInt(searchParams.get("after") || "0");

    // Helper to check if string is a valid UUID
    const isValidUUID = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

    // Resolve sessionId to actual call UUID
    let callId = sessionId;

    // If not a valid UUID, look up by various ID types
    if (!isValidUUID(sessionId)) {
      let call = null;

      // 1. Try vmSessionId first (for VM Bridge sessions like sess_xxx)
      if (sessionId.startsWith('sess_')) {
        call = await db
          .select({ id: calls.id })
          .from(calls)
          .where(eq(calls.vmSessionId, sessionId))
          .limit(1)
          .then(r => r[0]);

        if (call) {
          console.log(`[Transcript GET] Resolved vmSessionId ${sessionId} to call ${call.id}`);
        }
      }

      // 2. Try externalCallId (3CX call ID)
      if (!call) {
        call = await db
          .select({ id: calls.id })
          .from(calls)
          .where(eq(calls.externalCallId, sessionId))
          .limit(1)
          .then(r => r[0]);

        if (call) {
          console.log(`[Transcript GET] Resolved externalCallId ${sessionId} to call ${call.id}`);
        }
      }

      if (call) {
        callId = call.id;
      } else {
        console.log(`[Transcript GET] No call found for sessionId: ${sessionId}`);
        return NextResponse.json({
          success: true,
          segments: [],
          total: 0,
        });
      }
    }

    let segments = await db
      .select()
      .from(liveTranscriptSegments)
      .where(eq(liveTranscriptSegments.callId, callId))
      .orderBy(liveTranscriptSegments.sequenceNumber);

    // Fallback: if no segments found, check if this call has an agent/extension
    // and look for a related VM Bridge call with the same extension that has segments.
    // This handles the case where a duplicate call record was created.
    if (segments.length === 0) {
      const [thisCall] = await db
        .select({ agentId: calls.agentId, extension: calls.extension, vmSessionId: calls.vmSessionId })
        .from(calls)
        .where(eq(calls.id, callId))
        .limit(1);

      if (thisCall && !thisCall.vmSessionId) {
        // This call has no VM session - look for another call with vmSessionId
        // that has segments (the VM Bridge auto-created one)
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const relatedCalls = await db
          .select({ id: calls.id, vmSessionId: calls.vmSessionId })
          .from(calls)
          .where(sql`${calls.vmSessionId} IS NOT NULL AND ${calls.startedAt} >= ${today}`)
          .orderBy(sql`${calls.startedAt} DESC`)
          .limit(5);

        for (const related of relatedCalls) {
          const relatedSegments = await db
            .select()
            .from(liveTranscriptSegments)
            .where(eq(liveTranscriptSegments.callId, related.id))
            .orderBy(liveTranscriptSegments.sequenceNumber);

          if (relatedSegments.length > 0) {
            console.log(`[Transcript GET] Fallback: found ${relatedSegments.length} segments on related VM Bridge call ${related.id} (vm=${related.vmSessionId})`);
            segments = relatedSegments;
            break;
          }
        }
      }
    }

    // Filter to only segments after the given sequence number
    const filtered = afterSeq > 0
      ? segments.filter(s => s.sequenceNumber > afterSeq)
      : segments;

    return NextResponse.json({
      success: true,
      segments: filtered.map(s => ({
        id: s.id,
        speaker: s.speaker,
        text: s.text,
        confidence: s.confidence,
        timestamp: s.timestamp,
        sequenceNumber: s.sequenceNumber,
        isFinal: s.isFinal,
        sentiment: s.sentiment,
        entities: s.entities,
      })),
      total: segments.length,
    });
  } catch (error) {
    console.error("[Transcript] Get segments error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to get segments" },
      { status: 500 }
    );
  }
}
