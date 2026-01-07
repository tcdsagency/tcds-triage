import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { googleReviews } from "@/db/schema";
import { eq, isNull, isNotNull, sql, avg } from "drizzle-orm";

// =============================================================================
// GET /api/google-reviews/stats - Get review statistics
// =============================================================================
export async function GET(request: NextRequest) {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID || "00000000-0000-0000-0000-000000000001";

    // Get total, matched, unmatched counts and average rating
    const [stats] = await db
      .select({
        total: sql<number>`count(*)`,
        matched: sql<number>`count(*) filter (where matched_customer_id is not null)`,
        unmatched: sql<number>`count(*) filter (where matched_customer_id is null)`,
        avgRating: sql<number>`avg(rating)`,
        fiveStars: sql<number>`count(*) filter (where rating = 5)`,
        fourStars: sql<number>`count(*) filter (where rating = 4)`,
        threeStars: sql<number>`count(*) filter (where rating = 3)`,
        twoStars: sql<number>`count(*) filter (where rating = 2)`,
        oneStar: sql<number>`count(*) filter (where rating = 1)`,
      })
      .from(googleReviews)
      .where(eq(googleReviews.tenantId, tenantId));

    // Get recent reviews (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [recentStats] = await db
      .select({
        count: sql<number>`count(*)`,
        avgRating: sql<number>`avg(rating)`,
      })
      .from(googleReviews)
      .where(
        sql`${googleReviews.tenantId} = ${tenantId} AND ${googleReviews.reviewTimestamp} >= ${thirtyDaysAgo}`
      );

    return NextResponse.json({
      success: true,
      stats: {
        total: Number(stats?.total || 0),
        matched: Number(stats?.matched || 0),
        unmatched: Number(stats?.unmatched || 0),
        avgRating: stats?.avgRating ? parseFloat(Number(stats.avgRating).toFixed(1)) : 0,
        ratingBreakdown: {
          5: Number(stats?.fiveStars || 0),
          4: Number(stats?.fourStars || 0),
          3: Number(stats?.threeStars || 0),
          2: Number(stats?.twoStars || 0),
          1: Number(stats?.oneStar || 0),
        },
        last30Days: {
          count: Number(recentStats?.count || 0),
          avgRating: recentStats?.avgRating
            ? parseFloat(Number(recentStats.avgRating).toFixed(1))
            : 0,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching Google review stats:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch stats" },
      { status: 500 }
    );
  }
}
