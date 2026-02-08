// API Route: /api/commissions/transactions/[id]
// Get, update, delete individual commission transaction

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { commissionTransactions, commissionAllocations } from "@/db/schema";
import { eq, and } from "drizzle-orm";

// GET - Get single transaction
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    const [transaction] = await db
      .select()
      .from(commissionTransactions)
      .where(and(eq(commissionTransactions.tenantId, tenantId), eq(commissionTransactions.id, id)))
      .limit(1);

    if (!transaction) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: transaction,
    });
  } catch (error: unknown) {
    console.error("[Commission Transactions] Get error:", error);
    return NextResponse.json(
      { error: "Failed to get transaction", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// PATCH - Update transaction fields
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

    const [updated] = await db
      .update(commissionTransactions)
      .set({
        ...body,
        updatedAt: new Date(),
      })
      .where(and(eq(commissionTransactions.tenantId, tenantId), eq(commissionTransactions.id, id)))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: updated,
    });
  } catch (error: unknown) {
    console.error("[Commission Transactions] Update error:", error);
    return NextResponse.json(
      { error: "Failed to update transaction", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// DELETE - Delete transaction and related allocations
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    // Explicitly delete related allocations for safety (FK cascade also handles this)
    await db
      .delete(commissionAllocations)
      .where(and(eq(commissionAllocations.tenantId, tenantId), eq(commissionAllocations.transactionId, id)));

    const [deleted] = await db
      .delete(commissionTransactions)
      .where(and(eq(commissionTransactions.tenantId, tenantId), eq(commissionTransactions.id, id)))
      .returning({ id: commissionTransactions.id });

    if (!deleted) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: "Transaction deleted",
    });
  } catch (error: unknown) {
    console.error("[Commission Transactions] Delete error:", error);
    return NextResponse.json(
      { error: "Failed to delete transaction", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
