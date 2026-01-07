// API Route: /api/agent-assist/telemetry
// Track agent assist suggestion usage for analytics

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { agentAssistTelemetry } from '@/db/schema';
import type { TelemetryRequest, TelemetryResponse } from '@/lib/agent-assist/types';

export async function POST(request: NextRequest) {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json(
        { success: false, error: 'Tenant not configured', recorded: 0 },
        { status: 500 }
      );
    }

    const body: TelemetryRequest = await request.json();

    if (!body.events || body.events.length === 0) {
      return NextResponse.json({
        success: true,
        recorded: 0,
      });
    }

    // Insert telemetry events
    const records = body.events.map((event) => ({
      tenantId,
      userId: body.userId || null,
      callId: body.callId || event.callId || null,
      suggestionType: event.suggestionType,
      suggestionId: event.suggestionId || null,
      playbookId: event.playbookId || null,
      content: event.content || null,
      action: event.action,
      feedback: event.feedback || null,
      feedbackNote: event.feedbackNote || null,
      callTranscriptSnippet: event.callTranscriptSnippet || null,
      formSection: event.formSection || null,
    }));

    await db.insert(agentAssistTelemetry).values(records);

    return NextResponse.json({
      success: true,
      recorded: records.length,
    } as TelemetryResponse);
  } catch (error: any) {
    console.error('[Agent Assist] Telemetry error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to record telemetry', details: error.message, recorded: 0 },
      { status: 500 }
    );
  }
}

// GET endpoint to retrieve telemetry stats
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '7', 10);
    
    // Return simple stats - full analytics would be a separate dashboard
    return NextResponse.json({
      success: true,
      message: 'Telemetry endpoint active',
      queryParams: { days },
    });
  } catch (error: any) {
    console.error('[Agent Assist] Telemetry GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch telemetry' },
      { status: 500 }
    );
  }
}
