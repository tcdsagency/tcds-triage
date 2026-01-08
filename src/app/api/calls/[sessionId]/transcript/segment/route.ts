// API Route: /api/calls/[sessionId]/transcript/segment
// Webhook endpoint to receive transcript segments from VM Bridge

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { calls, liveTranscriptSegments } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { nanoid } from "nanoid";

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

    // Validate call exists (sessionId is the call ID)
    const [call] = await db
      .select()
      .from(calls)
      .where(eq(calls.id, sessionId))
      .limit(1);

    if (!call) {
      // Try by externalCallId
      const [callByExternal] = await db
        .select()
        .from(calls)
        .where(eq(calls.externalCallId, sessionId))
        .limit(1);

      if (!callByExternal) {
        return NextResponse.json(
          { error: "Call not found" },
          { status: 404 }
        );
      }
    }

    const callId = call?.id || sessionId;

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

    const segments = await db
      .select()
      .from(liveTranscriptSegments)
      .where(eq(liveTranscriptSegments.callId, sessionId))
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
