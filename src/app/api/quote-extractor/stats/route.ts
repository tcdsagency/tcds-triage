// API Route: /api/quote-extractor/stats
// Get document counts by status

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { quoteDocuments } from "@/db/schema";
import { eq, sql } from "drizzle-orm";

// GET - Get stats/counts
export async function GET(request: NextRequest) {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    // Get counts by status
    const statusCounts = await db
      .select({
        status: quoteDocuments.status,
        count: sql<number>`count(*)::int`,
      })
      .from(quoteDocuments)
      .where(eq(quoteDocuments.tenantId, tenantId))
      .groupBy(quoteDocuments.status);

    // Build stats object
    const stats = {
      total: 0,
      uploaded: 0,
      extracting: 0,
      extracted: 0,
      posted: 0,
      error: 0,
    };

    for (const row of statusCounts) {
      const status = row.status as keyof typeof stats;
      if (status in stats) {
        stats[status] = row.count;
      }
      stats.total += row.count;
    }

    // Get recent activity (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentCount = await db
      .select({
        count: sql<number>`count(*)::int`,
      })
      .from(quoteDocuments)
      .where(
        sql`${quoteDocuments.tenantId} = ${tenantId} AND ${quoteDocuments.createdAt} >= ${sevenDaysAgo}`
      );

    // Get top carriers
    const topCarriers = await db
      .select({
        carrier: quoteDocuments.carrierName,
        count: sql<number>`count(*)::int`,
      })
      .from(quoteDocuments)
      .where(
        sql`${quoteDocuments.tenantId} = ${tenantId} AND ${quoteDocuments.carrierName} IS NOT NULL`
      )
      .groupBy(quoteDocuments.carrierName)
      .orderBy(sql`count(*) DESC`)
      .limit(5);

    return NextResponse.json({
      success: true,
      stats,
      recentCount: recentCount[0]?.count || 0,
      topCarriers: topCarriers.map((c) => ({
        name: c.carrier,
        count: c.count,
      })),
    });
  } catch (error: any) {
    console.error("[Quote Extractor] Stats error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to get stats", details: error.message },
      { status: 500 }
    );
  }
}
