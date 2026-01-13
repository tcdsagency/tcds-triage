/**
 * API Route: /api/dashboard/stats
 * Get CSR dashboard statistics - calls, messages, pending review
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { calls, messages, wrapupDrafts } from "@/db/schema";
import { eq, and, gte, sql, or, ne } from "drizzle-orm";

export async function GET(request: NextRequest) {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const period = searchParams.get("period") || "today";

    // Calculate date range
    const now = new Date();
    let startDate: Date;

    switch (period) {
      case "week":
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "month":
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default: // today
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    }

    // Get call stats - use directionLive for accurate direction
    // Note: direction values are lowercase in the database (inbound/outbound)
    // Can't use LOWER() on enum types, so comparing directly
    const [callStats] = await db
      .select({
        total: sql<number>`count(*)::int`,
        inbound: sql<number>`count(*) filter (where ${calls.directionLive}::text = 'inbound' OR (${calls.directionLive} IS NULL AND ${calls.direction}::text = 'inbound'))::int`,
        outbound: sql<number>`count(*) filter (where ${calls.directionLive}::text = 'outbound' OR (${calls.directionLive} IS NULL AND ${calls.direction}::text = 'outbound'))::int`,
      })
      .from(calls)
      .where(
        and(
          eq(calls.tenantId, tenantId),
          gte(calls.startedAt, startDate)
        )
      );

    // Get message stats
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
          gte(messages.createdAt, startDate)
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

    return NextResponse.json({
      success: true,
      period,
      stats: {
        calls: {
          total: callStats?.total || 0,
          inbound: callStats?.inbound || 0,
          outbound: callStats?.outbound || 0,
        },
        messages: {
          total: messageStats?.total || 0,
          inbound: messageStats?.inbound || 0,
          outbound: messageStats?.outbound || 0,
        },
        pendingReview: pendingStats?.count || 0,
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
