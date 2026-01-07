import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { reviewRequests } from "@/db/schema";
import { eq, and } from "drizzle-orm";

// =============================================================================
// POST /api/review-requests/[id]/cancel - Cancel a pending review request
// =============================================================================
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const tenantId = process.env.DEFAULT_TENANT_ID || "00000000-0000-0000-0000-000000000001";

    // Check if request exists and is pending
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

    if (existing.status !== "pending") {
      return NextResponse.json(
        { success: false, error: `Cannot cancel request with status: ${existing.status}` },
        { status: 400 }
      );
    }

    // Update to cancelled
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
    console.error("Error cancelling review request:", error);
    return NextResponse.json(
      { success: false, error: "Failed to cancel request" },
      { status: 500 }
    );
  }
}
