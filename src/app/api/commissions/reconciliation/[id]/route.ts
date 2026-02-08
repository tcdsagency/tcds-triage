// API Route: /api/commissions/reconciliation/[id]
// Resolve a reconciliation record

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { commissionCarrierReconciliation } from "@/db/schema";
import { eq, and } from "drizzle-orm";

// PATCH - Resolve a reconciliation record
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    const body = await request.json();

    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (body.status !== undefined) {
      updateData.status = body.status;
    }
    if (body.resolutionNotes !== undefined) {
      updateData.resolutionNotes = body.resolutionNotes;
    }
    if (body.carrierStatementTotal !== undefined) {
      updateData.carrierStatementTotal = body.carrierStatementTotal;
    }

    const [updated] = await db
      .update(commissionCarrierReconciliation)
      .set(updateData)
      .where(
        and(
          eq(commissionCarrierReconciliation.tenantId, tenantId),
          eq(commissionCarrierReconciliation.id, id)
        )
      )
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Reconciliation record not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: updated,
    });
  } catch (error: unknown) {
    console.error("[Commission Reconciliation] Error:", error);
    return NextResponse.json(
      { error: "Failed to update reconciliation record", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
