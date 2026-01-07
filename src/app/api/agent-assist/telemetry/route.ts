// API Route: /api/agent-assist/telemetry
// Track Agent Assist suggestion usage and feedback

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { agentAssistTelemetry } from "@/db/schema";
import { TelemetryRequest, TelemetryResponse } from "@/lib/agent-assist/types";
import { eq, desc, and, gte, sql } from "drizzle-orm";

// =============================================================================
// POST - Record Telemetry Event
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json<TelemetryResponse>({
        success: false,
        error: "Tenant not configured",
      }, { status: 500 });
    }

    const body: TelemetryRequest = await request.json();

    // Validate required fields
    if (!body.suggestionType || !body.action) {
      return NextResponse.json<TelemetryResponse>({
        success: false,
        error: "suggestionType and action are required",
      }, { status: 400 });
    }

    // Validate action enum
    const validActions = ["shown", "used", "dismissed", "expanded", "collapsed"];
    if (!validActions.includes(body.action)) {
      return NextResponse.json<TelemetryResponse>({
        success: false,
        error: `Invalid action. Must be one of: ${validActions.join(", ")}`,
      }, { status: 400 });
    }

    // Validate feedback enum if provided
    if (body.feedback) {
      const validFeedback = ["helpful", "not_helpful", "too_basic", "incorrect"];
      if (!validFeedback.includes(body.feedback)) {
        return NextResponse.json<TelemetryResponse>({
          success: false,
          error: `Invalid feedback. Must be one of: ${validFeedback.join(", ")}`,
        }, { status: 400 });
      }
    }

    // Insert telemetry record
    const [record] = await db
      .insert(agentAssistTelemetry)
      .values({
        tenantId,
        suggestionType: body.suggestionType,
        suggestionId: body.suggestionId || null,
        playbookId: body.playbookId || null,
        action: body.action as any,
        feedback: body.feedback as any || null,
        feedbackNote: body.feedbackNote || null,
        callId: body.callId || null,
        formSection: body.formSection || null,
        content: body.content || null,
        callTranscriptSnippet: body.callTranscriptSnippet?.slice(0, 500) || null, // Limit to 500 chars
      })
      .returning({ id: agentAssistTelemetry.id });

    return NextResponse.json<TelemetryResponse>({
      success: true,
      id: record.id,
    });

  } catch (error: any) {
    console.error("[Agent Assist] Telemetry error:", error);
    return NextResponse.json<TelemetryResponse>({
      success: false,
      error: error.message || "Failed to record telemetry",
    }, { status: 500 });
  }
}

// =============================================================================
// GET - Get Telemetry Stats
// =============================================================================

export async function GET(request: NextRequest) {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({
        success: false,
        error: "Tenant not configured",
      }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get("days") || "7");
    const playbookId = searchParams.get("playbookId");
    const suggestionType = searchParams.get("suggestionType");

    // Calculate date range
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Build base conditions
    const conditions = [
      eq(agentAssistTelemetry.tenantId, tenantId),
      gte(agentAssistTelemetry.createdAt, startDate),
    ];

    if (playbookId) {
      conditions.push(eq(agentAssistTelemetry.playbookId, playbookId));
    }

    if (suggestionType) {
      conditions.push(eq(agentAssistTelemetry.suggestionType, suggestionType));
    }

    // Get all records for the period
    const records = await db
      .select()
      .from(agentAssistTelemetry)
      .where(and(...conditions))
      .orderBy(desc(agentAssistTelemetry.createdAt))
      .limit(1000);

    // Calculate stats
    const stats = {
      total: records.length,
      byAction: {
        shown: 0,
        used: 0,
        dismissed: 0,
        expanded: 0,
        collapsed: 0,
      },
      byFeedback: {
        helpful: 0,
        not_helpful: 0,
        too_basic: 0,
        incorrect: 0,
        none: 0,
      },
      byType: {} as Record<string, number>,
      byPlaybook: {} as Record<string, number>,
      usageRate: 0,
      helpfulRate: 0,
    };

    for (const record of records) {
      // Count by action
      if (record.action && stats.byAction[record.action as keyof typeof stats.byAction] !== undefined) {
        stats.byAction[record.action as keyof typeof stats.byAction]++;
      }

      // Count by feedback
      if (record.feedback && stats.byFeedback[record.feedback as keyof typeof stats.byFeedback] !== undefined) {
        stats.byFeedback[record.feedback as keyof typeof stats.byFeedback]++;
      } else {
        stats.byFeedback.none++;
      }

      // Count by type
      stats.byType[record.suggestionType] = (stats.byType[record.suggestionType] || 0) + 1;

      // Count by playbook
      if (record.playbookId) {
        stats.byPlaybook[record.playbookId] = (stats.byPlaybook[record.playbookId] || 0) + 1;
      }
    }

    // Calculate rates
    if (stats.byAction.shown > 0) {
      stats.usageRate = Math.round((stats.byAction.used / stats.byAction.shown) * 100);
    }

    const feedbackCount = stats.byFeedback.helpful + stats.byFeedback.not_helpful + stats.byFeedback.too_basic + stats.byFeedback.incorrect;
    if (feedbackCount > 0) {
      stats.helpfulRate = Math.round((stats.byFeedback.helpful / feedbackCount) * 100);
    }

    // Get recent records (last 20)
    const recentRecords = records.slice(0, 20).map(r => ({
      id: r.id,
      suggestionType: r.suggestionType,
      playbookId: r.playbookId,
      action: r.action,
      feedback: r.feedback,
      createdAt: r.createdAt,
    }));

    return NextResponse.json({
      success: true,
      period: {
        days,
        startDate: startDate.toISOString(),
        endDate: new Date().toISOString(),
      },
      stats,
      recentRecords,
    });

  } catch (error: any) {
    console.error("[Agent Assist] Get telemetry error:", error);
    return NextResponse.json({
      success: false,
      error: error.message || "Failed to get telemetry",
    }, { status: 500 });
  }
}
