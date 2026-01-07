import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { googleReviews } from "@/db/schema";
import { eq, desc, isNull, isNotNull, sql } from "drizzle-orm";

// =============================================================================
// GET /api/google-reviews - List imported Google reviews
// =============================================================================
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const matched = searchParams.get("matched"); // 'true', 'false', or null for all
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    const tenantId = process.env.DEFAULT_TENANT_ID || "00000000-0000-0000-0000-000000000001";

    let query = db
      .select()
      .from(googleReviews)
      .where(eq(googleReviews.tenantId, tenantId))
      .orderBy(desc(googleReviews.reviewTimestamp))
      .limit(limit)
      .offset(offset)
      .$dynamic();

    if (matched === "true") {
      query = query.where(isNotNull(googleReviews.matchedCustomerId));
    } else if (matched === "false") {
      query = query.where(isNull(googleReviews.matchedCustomerId));
    }

    const results = await query;

    // Get total count
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(googleReviews)
      .where(eq(googleReviews.tenantId, tenantId));

    return NextResponse.json({
      success: true,
      reviews: results,
      total: Number(count),
      limit,
      offset,
    });
  } catch (error) {
    console.error("Error fetching Google reviews:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch reviews" },
      { status: 500 }
    );
  }
}
