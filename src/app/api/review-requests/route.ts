import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { reviewRequests, googleReviews, tenants } from "@/db/schema";
import { eq, and, desc, gte, lte, sql } from "drizzle-orm";

// =============================================================================
// GET /api/review-requests - List review requests with filters
// =============================================================================
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    const tenantId = process.env.DEFAULT_TENANT_ID || "00000000-0000-0000-0000-000000000001";

    let query = db
      .select()
      .from(reviewRequests)
      .where(eq(reviewRequests.tenantId, tenantId))
      .orderBy(desc(reviewRequests.createdAt))
      .limit(limit)
      .offset(offset)
      .$dynamic();

    if (status && status !== "all") {
      query = query.where(eq(reviewRequests.status, status as any));
    }

    const results = await query;

    // Get total count
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(reviewRequests)
      .where(eq(reviewRequests.tenantId, tenantId));

    return NextResponse.json({
      success: true,
      requests: results,
      total: Number(count),
      limit,
      offset,
    });
  } catch (error) {
    console.error("Error fetching review requests:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch review requests" },
      { status: 500 }
    );
  }
}

// =============================================================================
// POST /api/review-requests - Create new review request (manual or from call)
// =============================================================================
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      customerName,
      customerPhone,
      customerId,
      callSessionId,
      callId,
      sentiment = "positive",
      scheduledFor,
    } = body;

    if (!customerName || !customerPhone) {
      return NextResponse.json(
        { success: false, error: "Customer name and phone are required" },
        { status: 400 }
      );
    }

    const tenantId = process.env.DEFAULT_TENANT_ID || "00000000-0000-0000-0000-000000000001";

    // Get tenant settings to check if auto-send is enabled
    const [tenant] = await db
      .select({ features: tenants.features })
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);

    const features = (tenant?.features as any) || {};
    const autoSendEnabled = features.reviewAutoSend !== false; // Default true

    // Check for suppression - has customer already left a review?
    const existingReview = await db
      .select()
      .from(googleReviews)
      .where(
        and(
          eq(googleReviews.tenantId, tenantId),
          eq(googleReviews.matchedCustomerPhone, customerPhone)
        )
      )
      .limit(1);

    const shouldSuppress = existingReview.length > 0;

    // Calculate scheduled time (default: 2 hours from now during business hours)
    const scheduleTime = scheduledFor
      ? new Date(scheduledFor)
      : getNextBusinessHour(new Date(Date.now() + 2 * 60 * 60 * 1000));

    // Determine initial status
    // - suppressed: customer already left a review
    // - pending_approval: auto-send is OFF, needs manual approval
    // - pending: auto-send is ON, ready to be sent
    let initialStatus: "suppressed" | "pending_approval" | "pending" = "pending";
    if (shouldSuppress) {
      initialStatus = "suppressed";
    } else if (!autoSendEnabled) {
      initialStatus = "pending_approval";
    }

    const [newRequest] = await db
      .insert(reviewRequests)
      .values({
        tenantId,
        customerName,
        customerPhone,
        customerId: customerId || null,
        callSessionId: callSessionId || null,
        callId: callId || null,
        sentiment,
        scheduledFor: scheduleTime,
        status: initialStatus,
        suppressed: shouldSuppress,
        suppressionReason: shouldSuppress ? "existing_review" : null,
        googleReviewId: shouldSuppress ? existingReview[0].id : null,
      })
      .returning();

    return NextResponse.json({
      success: true,
      request: newRequest,
      suppressed: shouldSuppress,
      needsApproval: initialStatus === "pending_approval",
    });
  } catch (error) {
    console.error("Error creating review request:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create review request" },
      { status: 500 }
    );
  }
}

// Helper: Get next valid business hour (Mon-Fri, 9am-6pm CST)
function getNextBusinessHour(date: Date): Date {
  const result = new Date(date);

  // Convert to CST (approximate - use proper timezone lib in production)
  const cstOffset = -6; // CST is UTC-6
  const utcHours = result.getUTCHours();
  const cstHours = utcHours + cstOffset;

  const dayOfWeek = result.getDay();

  // If weekend, move to Monday
  if (dayOfWeek === 0) {
    result.setDate(result.getDate() + 1);
    result.setHours(9, 0, 0, 0);
  } else if (dayOfWeek === 6) {
    result.setDate(result.getDate() + 2);
    result.setHours(9, 0, 0, 0);
  }

  // If before 9am, set to 9am
  if (cstHours < 9) {
    result.setHours(9 - cstOffset, 0, 0, 0);
  }

  // If after 6pm, move to next day 9am
  if (cstHours >= 18) {
    result.setDate(result.getDate() + 1);
    result.setHours(9 - cstOffset, 0, 0, 0);

    // Check if next day is weekend
    const nextDay = result.getDay();
    if (nextDay === 0) {
      result.setDate(result.getDate() + 1);
    } else if (nextDay === 6) {
      result.setDate(result.getDate() + 2);
    }
  }

  return result;
}
