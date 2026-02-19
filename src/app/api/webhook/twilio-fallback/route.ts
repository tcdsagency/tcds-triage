// =============================================================================
// Twilio/Zapier Fallback Webhook
// =============================================================================
// Handles calls that bypass 3CX (forwarded to cell, after-hours answering service).
// Creates a call record and wrapup with source='twilio_fallback' for manual review.
// No transcript available — appears in unified queue for manual action.
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { calls, wrapupDrafts } from "@/db/schema";

const TENANT_ID = process.env.DEFAULT_TENANT_ID!;

// =============================================================================
// Types
// =============================================================================

interface TwilioFallbackPayload {
  // Zapier/Twilio fields
  callSid?: string;
  from?: string;
  to?: string;
  direction?: string;
  duration?: number;
  recordingUrl?: string;
  callerName?: string;
  agentExtension?: string;
  // Zapier-enriched fields
  timestamp?: string;
  notes?: string;
}

// =============================================================================
// POST handler
// =============================================================================

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as TwilioFallbackPayload;

    const fromNumber = normalizePhone(body.from) || 'Unknown';
    const toNumber = normalizePhone(body.to) || 'Unknown';
    const direction = (body.direction || 'inbound').toLowerCase().includes('outbound')
      ? 'outbound' as const
      : 'inbound' as const;
    const durationSeconds = body.duration || 0;
    const startedAt = body.timestamp ? new Date(body.timestamp) : new Date();

    // Create call record
    const [newCall] = await db.insert(calls).values({
      tenantId: TENANT_ID,
      direction,
      directionFinal: direction,
      status: 'completed',
      fromNumber,
      toNumber,
      externalCallId: body.callSid || null,
      extension: body.agentExtension || null,
      externalNumber: direction === 'inbound' ? fromNumber : toNumber,
      startedAt,
      endedAt: new Date(startedAt.getTime() + durationSeconds * 1000),
      durationSeconds,
      recordingUrl: body.recordingUrl || null,
      transcriptionStatus: 'completed',
    }).returning({ id: calls.id });

    // Create wrapup for manual review
    await db.insert(wrapupDrafts).values({
      tenantId: TENANT_ID,
      callId: newCall.id,
      direction: direction === 'inbound' ? 'Inbound' : 'Outbound',
      agentExtension: body.agentExtension,
      status: 'pending_review',
      customerName: body.callerName || null,
      customerPhone: fromNumber !== 'Unknown' ? fromNumber : null,
      summary: body.notes || 'Call forwarded outside 3CX — no transcript available. Manual review required.',
      aiProcessingStatus: 'not_available',
      matchStatus: 'unprocessed',
      source: 'twilio_fallback',
    });

    return NextResponse.json({
      success: true,
      callId: newCall.id,
      message: 'Twilio fallback call recorded for manual review',
    });
  } catch (error) {
    console.error('[twilio-fallback] Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

// Health check
export async function GET() {
  return NextResponse.json({ status: 'ok', source: 'twilio_fallback' });
}

// =============================================================================
// Helpers
// =============================================================================

function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 7) return null;
  // Return last 10 digits with formatting
  const last10 = digits.slice(-10);
  return last10;
}
