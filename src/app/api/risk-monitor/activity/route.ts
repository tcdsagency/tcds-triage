// API Route: /api/risk-monitor/activity
// Get activity logs and events

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { riskMonitorActivityLog, riskMonitorActivityEvents } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

// GET - List activity logs
export async function GET(request: NextRequest) {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const logId = searchParams.get("logId"); // Get events for specific log
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = parseInt(searchParams.get("offset") || "0");

    // If logId provided, get events for that log
    if (logId) {
      const events = await db
        .select()
        .from(riskMonitorActivityEvents)
        .where(eq(riskMonitorActivityEvents.runId, logId))
        .orderBy(desc(riskMonitorActivityEvents.createdAt))
        .limit(100);

      return NextResponse.json({
        success: true,
        events,
      });
    }

    // Otherwise, get activity logs
    const logs = await db
      .select()
      .from(riskMonitorActivityLog)
      .where(eq(riskMonitorActivityLog.tenantId, tenantId))
      .orderBy(desc(riskMonitorActivityLog.startedAt))
      .limit(limit)
      .offset(offset);

    return NextResponse.json({
      success: true,
      logs,
      pagination: { limit, offset },
    });
  } catch (error: any) {
    console.error("[Risk Monitor] Error getting activity:", error);
    return NextResponse.json(
      { error: "Failed to get activity", details: error.message },
      { status: 500 }
    );
  }
}
