/**
 * API Route: /api/reports/stats
 * Get aggregated report statistics
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { calls, customers, users, quotes } from "@/db/schema";
import { eq, and, gte, lte, count, sum, sql, desc } from "drizzle-orm";

// =============================================================================
// GET /api/reports/stats - Get report statistics
// =============================================================================
export async function GET(request: NextRequest) {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const period = searchParams.get("period") || "30d";

    // Calculate date range
    const now = new Date();
    let startDate: Date;
    let previousStart: Date;
    let previousEnd: Date;

    switch (period) {
      case "today":
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        previousStart = new Date(startDate.getTime() - 24 * 60 * 60 * 1000);
        previousEnd = startDate;
        break;
      case "7d":
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        previousStart = new Date(startDate.getTime() - 7 * 24 * 60 * 60 * 1000);
        previousEnd = startDate;
        break;
      case "90d":
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        previousStart = new Date(startDate.getTime() - 90 * 24 * 60 * 60 * 1000);
        previousEnd = startDate;
        break;
      case "ytd":
        startDate = new Date(now.getFullYear(), 0, 1);
        previousStart = new Date(now.getFullYear() - 1, 0, 1);
        previousEnd = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
        break;
      default: // 30d
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        previousStart = new Date(startDate.getTime() - 30 * 24 * 60 * 60 * 1000);
        previousEnd = startDate;
    }

    // Fetch current period stats
    const [callStats] = await db
      .select({
        totalCalls: count(),
        avgDuration: sql<number>`AVG(${calls.durationSeconds})`,
      })
      .from(calls)
      .where(
        and(
          eq(calls.tenantId, tenantId),
          gte(calls.startedAt, startDate)
        )
      );

    // Fetch previous period stats for comparison
    const [prevCallStats] = await db
      .select({
        totalCalls: count(),
      })
      .from(calls)
      .where(
        and(
          eq(calls.tenantId, tenantId),
          gte(calls.startedAt, previousStart),
          lte(calls.startedAt, previousEnd)
        )
      );

    // Fetch customer stats
    const [customerStats] = await db
      .select({
        totalCustomers: count(),
        totalLeads: sql<number>`COUNT(*) FILTER (WHERE ${customers.isLead} = true)`,
      })
      .from(customers)
      .where(eq(customers.tenantId, tenantId));

    // Fetch quote stats
    const [quoteStats] = await db
      .select({
        totalQuotes: count(),
        boundQuotes: sql<number>`COUNT(*) FILTER (WHERE ${quotes.status} = 'bound')`,
      })
      .from(quotes)
      .where(
        and(
          eq(quotes.tenantId, tenantId),
          gte(quotes.createdAt, startDate)
        )
      );

    // Agent performance (top 5 by calls)
    const agentPerformance = await db
      .select({
        agentId: calls.agentId,
        firstName: users.firstName,
        lastName: users.lastName,
        callCount: count(),
        avgDuration: sql<number>`AVG(${calls.durationSeconds})`,
      })
      .from(calls)
      .leftJoin(users, eq(calls.agentId, users.id))
      .where(
        and(
          eq(calls.tenantId, tenantId),
          gte(calls.startedAt, startDate)
        )
      )
      .groupBy(calls.agentId, users.firstName, users.lastName)
      .orderBy(desc(count()))
      .limit(5);

    // Calculate changes
    const callsChange = prevCallStats?.totalCalls
      ? ((Number(callStats?.totalCalls || 0) - Number(prevCallStats.totalCalls)) / Number(prevCallStats.totalCalls)) * 100
      : 0;

    const conversionRate = quoteStats?.totalQuotes
      ? (Number(quoteStats.boundQuotes || 0) / Number(quoteStats.totalQuotes)) * 100
      : 0;

    // Format avg handle time
    const avgSeconds = callStats?.avgDuration || 0;
    const avgMinutes = Math.floor(avgSeconds / 60);
    const avgSecondsRemainder = Math.round(avgSeconds % 60);
    const avgHandleTime = `${avgMinutes}:${avgSecondsRemainder.toString().padStart(2, "0")}`;

    return NextResponse.json({
      success: true,
      period,
      metrics: {
        totalCalls: Number(callStats?.totalCalls || 0),
        callsChange: Math.round(callsChange * 10) / 10,
        totalQuotes: Number(quoteStats?.totalQuotes || 0),
        boundQuotes: Number(quoteStats?.boundQuotes || 0),
        conversionRate: Math.round(conversionRate * 10) / 10,
        avgHandleTime,
        totalCustomers: Number(customerStats?.totalCustomers || 0),
        totalLeads: Number(customerStats?.totalLeads || 0),
      },
      agentPerformance: agentPerformance.map((a) => ({
        id: a.agentId || "unknown",
        name: a.firstName && a.lastName ? `${a.firstName} ${a.lastName}` : "Unknown Agent",
        calls: Number(a.callCount),
        avgCallTime: formatDuration(Number(a.avgDuration || 0)),
      })),
    });
  } catch (error: any) {
    console.error("[Reports Stats] Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch report stats", details: error.message },
      { status: 500 }
    );
  }
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}
