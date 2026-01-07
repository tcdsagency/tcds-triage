import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { googleReviews, reviewRequests } from "@/db/schema";
import { eq, and } from "drizzle-orm";

// =============================================================================
// POST /api/google-reviews/[id]/match - Manually match review to customer
// =============================================================================
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { customerId, customerName, customerPhone } = body;

    if (!customerId) {
      return NextResponse.json(
        { success: false, error: "Customer ID is required" },
        { status: 400 }
      );
    }

    const tenantId = process.env.DEFAULT_TENANT_ID || "00000000-0000-0000-0000-000000000001";

    // Check if review exists
    const [existing] = await db
      .select()
      .from(googleReviews)
      .where(
        and(
          eq(googleReviews.tenantId, tenantId),
          eq(googleReviews.id, id)
        )
      )
      .limit(1);

    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Review not found" },
        { status: 404 }
      );
    }

    // Update review with match
    const [updated] = await db
      .update(googleReviews)
      .set({
        matchedCustomerId: customerId,
        matchedCustomerName: customerName || null,
        matchedCustomerPhone: customerPhone || null,
        matchConfidence: "manual",
        matchedAt: new Date(),
      })
      .where(eq(googleReviews.id, id))
      .returning();

    // If customer phone is provided, suppress any pending review requests for this customer
    if (customerPhone) {
      await db
        .update(reviewRequests)
        .set({
          status: "suppressed",
          suppressed: true,
          suppressionReason: "existing_review",
          googleReviewId: id,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(reviewRequests.tenantId, tenantId),
            eq(reviewRequests.customerPhone, customerPhone),
            eq(reviewRequests.status, "pending")
          )
        );
    }

    return NextResponse.json({
      success: true,
      review: updated,
    });
  } catch (error) {
    console.error("Error matching review:", error);
    return NextResponse.json(
      { success: false, error: "Failed to match review" },
      { status: 500 }
    );
  }
}

// =============================================================================
// DELETE /api/google-reviews/[id]/match - Unmatch review from customer
// =============================================================================
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const tenantId = process.env.DEFAULT_TENANT_ID || "00000000-0000-0000-0000-000000000001";

    const [updated] = await db
      .update(googleReviews)
      .set({
        matchedCustomerId: null,
        matchedCustomerName: null,
        matchedCustomerPhone: null,
        matchConfidence: null,
        matchedAt: null,
        matchedBy: null,
      })
      .where(
        and(
          eq(googleReviews.tenantId, tenantId),
          eq(googleReviews.id, id)
        )
      )
      .returning();

    if (!updated) {
      return NextResponse.json(
        { success: false, error: "Review not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      review: updated,
    });
  } catch (error) {
    console.error("Error unmatching review:", error);
    return NextResponse.json(
      { success: false, error: "Failed to unmatch review" },
      { status: 500 }
    );
  }
}
