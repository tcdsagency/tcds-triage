// API Route: /api/commissions/anomalies/[id]
// Resolve an anomaly

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { commissionAnomalies } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { requireAdmin } from "@/lib/commissions/auth";

// PATCH - Resolve anomaly
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const adminResult = await requireAdmin();
    if (adminResult instanceof NextResponse) return adminResult;
    const { tenantId } = adminResult;

    const body = await request.json();

    const updateData: Record<string, unknown> = {};

    if (body.isResolved !== undefined) {
      updateData.isResolved = body.isResolved;
      if (body.isResolved) {
        updateData.resolvedAt = new Date();
      } else {
        updateData.resolvedAt = null;
      }
    }
    if (body.resolutionNotes !== undefined) {
      updateData.resolutionNotes = body.resolutionNotes;
    }

    const [updated] = await db
      .update(commissionAnomalies)
      .set(updateData)
      .where(
        and(
          eq(commissionAnomalies.tenantId, tenantId),
          eq(commissionAnomalies.id, id)
        )
      )
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Anomaly not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: updated,
    });
  } catch (error: unknown) {
    console.error("[Commission Anomalies] Error:", error);
    return NextResponse.json(
      { error: "Failed to update anomaly", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
