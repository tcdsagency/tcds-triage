// API Route: /api/commissions/import/[batchId]
// GET - Get batch status with error count

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { commissionImportBatches, commissionImportErrors } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { requireAdmin } from "@/lib/commissions/auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ batchId: string }> }
) {
  try {
    const adminResult = await requireAdmin();
    if (adminResult instanceof NextResponse) return adminResult;
    const { tenantId } = adminResult;

    const { batchId } = await params;

    // Get the batch
    const [batch] = await db
      .select()
      .from(commissionImportBatches)
      .where(
        and(
          eq(commissionImportBatches.id, batchId),
          eq(commissionImportBatches.tenantId, tenantId)
        )
      )
      .limit(1);

    if (!batch) {
      return NextResponse.json(
        { error: "Import batch not found" },
        { status: 404 }
      );
    }

    // Count errors for this batch
    const [errorResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(commissionImportErrors)
      .where(eq(commissionImportErrors.batchId, batchId));

    const errorCount = errorResult?.count || 0;

    return NextResponse.json({
      success: true,
      data: { ...batch, errorCount },
    });
  } catch (error) {
    console.error("[Commissions Import] Get batch error:", error);
    return NextResponse.json(
      { error: "Failed to get import batch" },
      { status: 500 }
    );
  }
}
