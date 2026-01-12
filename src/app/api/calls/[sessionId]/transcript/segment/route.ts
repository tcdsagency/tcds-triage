// API Route: /api/calls/[sessionId]/transcript/segment
// Webhook endpoint to receive transcript segments from VM Bridge

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { calls, liveTranscriptSegments } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { nanoid } from "nanoid";

// Push transcript segment to realtime WebSocket server
async function pushToRealtimeServer(event: {
  type: string;
  sessionId: string;
  speaker: string;
  text: string;
  confidence: number;
  timestamp: string;
  sequenceNumber: number;
  segmentId: string;
  isFinal: boolean;
}) {
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
      console.error(`[Transcript] Realtime push failed: ${response.status}`);
    }
  } catch (error) {
    console.error("[Transcript] Failed to push to realtime:", error);
  }
}

// Verify webhook API key (supports both X-Api-Key and Authorization headers)
function verifyWebhookKey(request: NextRequest): boolean {
  const webhookKey = process.env.WEBHOOK_API_KEY;

  if (!webhookKey) {
    console.warn("[Transcript] WEBHOOK_API_KEY not configured");
    return true; // Allow if not configured (dev mode)
  }

  // Check X-Api-Key header (VM Bridge format)
  const xApiKey = request.headers.get("X-Api-Key");
  if (xApiKey === webhookKey) {
    return true;
  }

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

    // Helper to check if string is a valid UUID
    const isValidUUID = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

    // Validate call exists (sessionId is the call ID)
    let call = null;

    // Only query by ID if it's a valid UUID (otherwise Postgres throws)
    if (isValidUUID(sessionId)) {
      call = await db
        .select()
        .from(calls)
        .where(eq(calls.id, sessionId))
        .limit(1)
        .then(r => r[0]);
    }

    if (!call) {
      // Try by externalCallId (string field, any format OK)
      call = await db
        .select()
        .from(calls)
        .where(eq(calls.externalCallId, sessionId))
        .limit(1)
        .then(r => r[0]);
    }

    // If sessionId is a drachtio fallback (drachtio-EXT-timestamp), find most recent active call
    if (!call && sessionId.startsWith("drachtio-")) {
      console.log(`[Transcript] Drachtio fallback ID detected: ${sessionId}, finding active call...`);
      // Find the most recent in_progress call
      call = await db
        .select()
        .from(calls)
        .where(eq(calls.status, "in_progress"))
        .orderBy(sql`${calls.startedAt} DESC`)
        .limit(1)
        .then(r => r[0]);

      if (call) {
        console.log(`[Transcript] Mapped drachtio ID to active call: ${call.id}`);
      }
    }

    if (!call) {
      console.warn(`[Transcript] Call not found for sessionId: ${sessionId}`);
      return NextResponse.json(
        { error: "Call not found" },
        { status: 404 }
      );
    }

    const callId = call.id;

    // Get next sequence number
    const countResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(liveTranscriptSegments)
      .where(eq(liveTranscriptSegments.callId, callId));

    const sequenceNumber = (countResult[0]?.count || 0) + 1;
    const now = new Date();

    // Store segment in database
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
      })
      .returning();

    console.log(`[Transcript] Segment ${sequenceNumber} stored for call ${callId}: "${body.text.substring(0, 50)}..."`);

    // Update segment count on the call record for tracking
    await db
      .update(calls)
      .set({
        transcriptionSegmentCount: sequenceNumber,
        transcriptionStatus: "active", // Confirm transcription is active
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
    });

    return NextResponse.json({
      success: true,
      segmentId: segment.id,
      sequenceNumber,
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

    // If not a valid UUID, look up by externalCallId
    if (!isValidUUID(sessionId)) {
      const call = await db
        .select({ id: calls.id })
        .from(calls)
        .where(eq(calls.externalCallId, sessionId))
        .limit(1)
        .then(r => r[0]);

      if (call) {
        callId = call.id;
        console.log(`[Transcript] Resolved externalCallId ${sessionId} to call ${callId}`);
      } else {
        console.log(`[Transcript] No call found for sessionId: ${sessionId}`);
        return NextResponse.json({
          success: true,
          segments: [],
          total: 0,
        });
      }
    }

    const segments = await db
      .select()
      .from(liveTranscriptSegments)
      .where(eq(liveTranscriptSegments.callId, callId))
      .orderBy(liveTranscriptSegments.sequenceNumber);

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
