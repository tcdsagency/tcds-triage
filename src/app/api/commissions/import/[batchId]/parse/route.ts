// API Route: /api/commissions/import/[batchId]/parse
// POST - Return parsed headers from the batch for mapping UI

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { commissionImportBatches } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { requireAdmin } from "@/lib/commissions/auth";

export async function POST(
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

    return NextResponse.json({
      success: true,
      headers: batch.parsedHeaders,
    });
  } catch (error) {
    console.error("[Commissions Import] Parse headers error:", error);
    return NextResponse.json(
      { error: "Failed to get parsed headers" },
      { status: 500 }
    );
  }
}
