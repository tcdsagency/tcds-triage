import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { reviewRequests } from "@/db/schema";
import { eq, sql } from "drizzle-orm";

// =============================================================================
// GET /api/review-requests/stats - Get review request statistics
// =============================================================================
export async function GET(request: NextRequest) {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID || "00000000-0000-0000-0000-000000000001";

    // Get counts by status
    const stats = await db
      .select({
        status: reviewRequests.status,
        count: sql<number>`count(*)`,
      })
      .from(reviewRequests)
      .where(eq(reviewRequests.tenantId, tenantId))
      .groupBy(reviewRequests.status);

    // Build stats object
    const statusCounts: Record<string, number> = {
      pending_approval: 0,
      pending: 0,
      sent: 0,
      failed: 0,
      cancelled: 0,
      opted_out: 0,
      suppressed: 0,
    };

    let total = 0;
    for (const stat of stats) {
      statusCounts[stat.status] = Number(stat.count);
      total += Number(stat.count);
    }

    // Get today's stats
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayIso = today.toISOString();

    const [todayStats] = await db
      .select({
        sent: sql<number>`count(*) filter (where status = 'sent' and sent_at >= ${todayIso}::timestamp)`,
        scheduled: sql<number>`count(*) filter (where status = 'pending' and scheduled_for >= ${todayIso}::timestamp)`,
      })
      .from(reviewRequests)
      .where(eq(reviewRequests.tenantId, tenantId));

    return NextResponse.json({
      success: true,
      stats: {
        total,
        ...statusCounts,
        today: {
          sent: Number(todayStats?.sent || 0),
          scheduled: Number(todayStats?.scheduled || 0),
        },
      },
    });
  } catch (error: any) {
    console.error("Error fetching review request stats:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch stats", details: error.message },
      { status: 500 }
    );
  }
}
