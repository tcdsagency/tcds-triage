// API Route: /api/commissions/deposits/[id]
// Update and delete individual deposits

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { commissionBankDeposits } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { requireAdmin } from "@/lib/commissions/auth";

// PATCH - Update deposit
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

    const [updated] = await db
      .update(commissionBankDeposits)
      .set({
        depositDate: body.depositDate,
        amount: body.amount,
        carrierId: body.carrierId,
        carrierName: body.carrierName,
        referenceNumber: body.referenceNumber,
        reportingMonth: body.reportingMonth,
        notes: body.notes,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(commissionBankDeposits.tenantId, tenantId),
          eq(commissionBankDeposits.id, id)
        )
      )
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Deposit not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: updated,
    });
  } catch (error: unknown) {
    console.error("[Commission Deposits] Error:", error);
    return NextResponse.json(
      { error: "Failed to update deposit", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// DELETE - Delete deposit
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const adminResult = await requireAdmin();
    if (adminResult instanceof NextResponse) return adminResult;
    const { tenantId } = adminResult;

    const [deleted] = await db
      .delete(commissionBankDeposits)
      .where(
        and(
          eq(commissionBankDeposits.tenantId, tenantId),
          eq(commissionBankDeposits.id, id)
        )
      )
      .returning({ id: commissionBankDeposits.id });

    if (!deleted) {
      return NextResponse.json({ error: "Deposit not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: "Deposit deleted",
    });
  } catch (error: unknown) {
    console.error("[Commission Deposits] Error:", error);
    return NextResponse.json(
      { error: "Failed to delete deposit", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
