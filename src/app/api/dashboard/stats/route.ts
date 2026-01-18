/**
 * API Route: /api/dashboard/stats
 * Get CSR dashboard statistics - calls, messages, pending review
 * Now includes trend comparisons with previous periods
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { calls, messages, wrapupDrafts } from "@/db/schema";
import { eq, and, gte, lt, sql, ne } from "drizzle-orm";

// Helper to calculate percentage change
function calculateTrend(current: number, previous: number): { change: number; direction: 'up' | 'down' | 'same' } {
  if (previous === 0) {
    return { change: current > 0 ? 100 : 0, direction: current > 0 ? 'up' : 'same' };
  }
  const change = Math.round(((current - previous) / previous) * 100);
  return {
    change: Math.abs(change),
    direction: change > 0 ? 'up' : change < 0 ? 'down' : 'same',
  };
}

export async function GET(request: NextRequest) {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const period = searchParams.get("period") || "today";

    // Calculate date ranges for current and previous periods
    const now = new Date();
    let currentStart: Date;
    let previousStart: Date;
    let previousEnd: Date;

    switch (period) {
      case "week":
        currentStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        previousEnd = new Date(currentStart.getTime());
        previousStart = new Date(currentStart.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "month":
        currentStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        previousEnd = new Date(currentStart.getTime());
        previousStart = new Date(currentStart.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default: // today - compare with yesterday
        currentStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        previousEnd = new Date(currentStart.getTime());
        previousStart = new Date(currentStart.getTime() - 24 * 60 * 60 * 1000);
    }

    // Get current period call stats
    const [callStats] = await db
      .select({
        total: sql<number>`count(*)::int`,
        inbound: sql<number>`count(*) filter (where ${calls.directionLive}::text = 'inbound' OR (${calls.directionLive} IS NULL AND ${calls.direction}::text = 'inbound'))::int`,
        outbound: sql<number>`count(*) filter (where ${calls.directionLive}::text = 'outbound' OR (${calls.directionLive} IS NULL AND ${calls.direction}::text = 'outbound'))::int`,
        avgDurationSec: sql<number>`coalesce(avg(extract(epoch from (${calls.endedAt} - ${calls.answeredAt})))::int, 0)`,
        missedCalls: sql<number>`count(*) filter (where ${calls.status}::text = 'missed')::int`,
      })
      .from(calls)
      .where(
        and(
          eq(calls.tenantId, tenantId),
          gte(calls.startedAt, currentStart)
        )
      );

    // Get previous period call stats for comparison
    const [prevCallStats] = await db
      .select({
        total: sql<number>`count(*)::int`,
        inbound: sql<number>`count(*) filter (where ${calls.directionLive}::text = 'inbound' OR (${calls.directionLive} IS NULL AND ${calls.direction}::text = 'inbound'))::int`,
        outbound: sql<number>`count(*) filter (where ${calls.directionLive}::text = 'outbound' OR (${calls.directionLive} IS NULL AND ${calls.direction}::text = 'outbound'))::int`,
      })
      .from(calls)
      .where(
        and(
          eq(calls.tenantId, tenantId),
          gte(calls.startedAt, previousStart),
          lt(calls.startedAt, previousEnd)
        )
      );

    // Get current period message stats
    const [messageStats] = await db
      .select({
        total: sql<number>`count(*)::int`,
        inbound: sql<number>`count(*) filter (where ${messages.direction} = 'inbound')::int`,
        outbound: sql<number>`count(*) filter (where ${messages.direction} = 'outbound')::int`,
      })
      .from(messages)
      .where(
        and(
          eq(messages.tenantId, tenantId),
          gte(messages.createdAt, currentStart)
        )
      );

    // Get previous period message stats
    const [prevMessageStats] = await db
      .select({
        total: sql<number>`count(*)::int`,
      })
      .from(messages)
      .where(
        and(
          eq(messages.tenantId, tenantId),
          gte(messages.createdAt, previousStart),
          lt(messages.createdAt, previousEnd)
        )
      );

    // Get pending review count (wrapup drafts not completed)
    const [pendingStats] = await db
      .select({
        count: sql<number>`count(*)::int`,
      })
      .from(wrapupDrafts)
      .where(
        and(
          eq(wrapupDrafts.tenantId, tenantId),
          ne(wrapupDrafts.status, "completed")
        )
      );

    // Get daily call volume for sparkline (last 7 days)
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const dailyCallVolume = await db
      .select({
        date: sql<string>`date_trunc('day', ${calls.startedAt})::date::text`,
        count: sql<number>`count(*)::int`,
      })
      .from(calls)
      .where(
        and(
          eq(calls.tenantId, tenantId),
          gte(calls.startedAt, sevenDaysAgo)
        )
      )
      .groupBy(sql`date_trunc('day', ${calls.startedAt})`)
      .orderBy(sql`date_trunc('day', ${calls.startedAt})`);

    // Calculate trends
    const callTrend = calculateTrend(callStats?.total || 0, prevCallStats?.total || 0);
    const messageTrend = calculateTrend(messageStats?.total || 0, prevMessageStats?.total || 0);

    // Format average duration
    const avgDurationSec = callStats?.avgDurationSec || 0;
    const avgDurationFormatted = avgDurationSec > 0
      ? `${Math.floor(avgDurationSec / 60)}:${String(avgDurationSec % 60).padStart(2, '0')}`
      : '0:00';

    return NextResponse.json({
      success: true,
      period,
      stats: {
        calls: {
          total: callStats?.total || 0,
          inbound: callStats?.inbound || 0,
          outbound: callStats?.outbound || 0,
          missed: callStats?.missedCalls || 0,
          avgDurationSec,
          avgDurationFormatted,
          trend: callTrend,
        },
        messages: {
          total: messageStats?.total || 0,
          inbound: messageStats?.inbound || 0,
          outbound: messageStats?.outbound || 0,
          trend: messageTrend,
        },
        pendingReview: pendingStats?.count || 0,
        sparkline: {
          calls: dailyCallVolume.map(d => ({ date: d.date, value: d.count })),
        },
      },
    });
  } catch (error: any) {
    console.error("[Dashboard Stats] Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch stats", details: error.message },
      { status: 500 }
    );
  }
}
