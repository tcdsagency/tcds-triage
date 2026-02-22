// API Route: /api/twilio-logs
// Returns Twilio webhook log entries for debugging/visibility

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { twilioWebhookLogs } from "@/db/schema";
import { desc, eq, and, gte, lte, ilike, or, sql } from "drizzle-orm";

export async function GET(request: NextRequest) {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const dateRange = searchParams.get("dateRange") || "today";
    const status = searchParams.get("status");
    const result = searchParams.get("result");
    const search = searchParams.get("search");
    const limit = Math.min(parseInt(searchParams.get("limit") || "100"), 500);
    const offset = parseInt(searchParams.get("offset") || "0");

    // Build date filter
    let startDate: Date | undefined;
    let endDate = new Date();

    switch (dateRange) {
      case "today":
        startDate = new Date();
        startDate.setHours(0, 0, 0, 0);
        break;
      case "yesterday":
        startDate = new Date();
        startDate.setDate(startDate.getDate() - 1);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date();
        endDate.setDate(endDate.getDate() - 1);
        endDate.setHours(23, 59, 59, 999);
        break;
      case "7d":
        startDate = new Date();
        startDate.setDate(startDate.getDate() - 7);
        break;
      case "30d":
        startDate = new Date();
        startDate.setDate(startDate.getDate() - 30);
        break;
    }

    const conditions = [
      eq(twilioWebhookLogs.tenantId, tenantId),
      startDate ? gte(twilioWebhookLogs.receivedAt, startDate) : undefined,
      endDate ? lte(twilioWebhookLogs.receivedAt, endDate) : undefined,
      status && status !== "all" ? eq(twilioWebhookLogs.callStatus, status) : undefined,
      result && result !== "all" ? eq(twilioWebhookLogs.processingResult, result) : undefined,
      search
        ? or(
            ilike(twilioWebhookLogs.callSid, `%${search}%`),
            ilike(twilioWebhookLogs.fromNumber, `%${search}%`),
            ilike(twilioWebhookLogs.toNumber, `%${search}%`),
            ilike(twilioWebhookLogs.callerName, `%${search}%`)
          )
        : undefined,
    ].filter(Boolean);

    // Get entries
    const entries = await db
      .select()
      .from(twilioWebhookLogs)
      .where(and(...conditions))
      .orderBy(desc(twilioWebhookLogs.receivedAt))
      .limit(limit)
      .offset(offset);

    // Get stats (counts by processingResult and callStatus)
    const allForStats = await db
      .select({
        processingResult: twilioWebhookLogs.processingResult,
        callStatus: twilioWebhookLogs.callStatus,
        count: sql<number>`count(*)::int`,
      })
      .from(twilioWebhookLogs)
      .where(
        and(
          eq(twilioWebhookLogs.tenantId, tenantId),
          startDate ? gte(twilioWebhookLogs.receivedAt, startDate) : undefined,
          endDate ? lte(twilioWebhookLogs.receivedAt, endDate) : undefined
        )
      )
      .groupBy(twilioWebhookLogs.processingResult, twilioWebhookLogs.callStatus);

    const resultCounts: Record<string, number> = {};
    const statusCounts: Record<string, number> = {};
    let total = 0;

    for (const row of allForStats) {
      total += row.count;
      resultCounts[row.processingResult] = (resultCounts[row.processingResult] || 0) + row.count;
      statusCounts[row.callStatus] = (statusCounts[row.callStatus] || 0) + row.count;
    }

    return NextResponse.json({
      success: true,
      entries: entries.map((e) => ({
        ...e,
        receivedAt: e.receivedAt.toISOString(),
      })),
      stats: { total, byResult: resultCounts, byStatus: statusCounts },
      total,
    });
  } catch (error: any) {
    console.error("[Twilio Logs API] Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch twilio logs", details: error.message },
      { status: 500 }
    );
  }
}
