import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { reviewRequests } from "@/db/schema";
import { eq, and } from "drizzle-orm";

// =============================================================================
// POST /api/review-requests/[id]/approve - Approve a pending_approval request
// =============================================================================
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const tenantId = process.env.DEFAULT_TENANT_ID || "00000000-0000-0000-0000-000000000001";

    // Verify request exists and is pending_approval
    const [existing] = await db
      .select()
      .from(reviewRequests)
      .where(
        and(
          eq(reviewRequests.tenantId, tenantId),
          eq(reviewRequests.id, id)
        )
      )
      .limit(1);

    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Review request not found" },
        { status: 404 }
      );
    }

    if (existing.status !== "pending_approval") {
      return NextResponse.json(
        { success: false, error: `Cannot approve request with status: ${existing.status}` },
        { status: 400 }
      );
    }

    // Move to pending (approved and ready to be sent)
    const [updated] = await db
      .update(reviewRequests)
      .set({
        status: "pending",
        updatedAt: new Date(),
      })
      .where(eq(reviewRequests.id, id))
      .returning();

    return NextResponse.json({
      success: true,
      request: updated,
    });
  } catch (error) {
    console.error("Error approving review request:", error);
    return NextResponse.json(
      { success: false, error: "Failed to approve review request" },
      { status: 500 }
    );
  }
}

// =============================================================================
// DELETE /api/review-requests/[id]/approve - Reject a pending_approval request
// =============================================================================
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const tenantId = process.env.DEFAULT_TENANT_ID || "00000000-0000-0000-0000-000000000001";

    // Verify request exists
    const [existing] = await db
      .select()
      .from(reviewRequests)
      .where(
        and(
          eq(reviewRequests.tenantId, tenantId),
          eq(reviewRequests.id, id)
        )
      )
      .limit(1);

    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Review request not found" },
        { status: 404 }
      );
    }

    if (existing.status !== "pending_approval") {
      return NextResponse.json(
        { success: false, error: `Cannot reject request with status: ${existing.status}` },
        { status: 400 }
      );
    }

    // Mark as cancelled
    const [updated] = await db
      .update(reviewRequests)
      .set({
        status: "cancelled",
        updatedAt: new Date(),
      })
      .where(eq(reviewRequests.id, id))
      .returning();

    return NextResponse.json({
      success: true,
      request: updated,
    });
  } catch (error) {
    console.error("Error rejecting review request:", error);
    return NextResponse.json(
      { success: false, error: "Failed to reject review request" },
      { status: 500 }
    );
  }
}
