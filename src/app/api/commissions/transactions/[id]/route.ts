// API Route: /api/commissions/transactions/[id]
// Get, update, delete individual commission transaction

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { commissionTransactions, commissionAllocations } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getCommissionUser, getAgentTransactionFilter } from "@/lib/commissions/auth";

/**
 * For non-admin users, verify a transaction belongs to them (notes contains their agent code).
 */
function canAccessTransaction(transaction: { notes: string | null }, agentCodes: string[]): boolean {
  if (!transaction.notes) return false;
  return agentCodes.some((code) => transaction.notes!.includes(`Agent 1: ${code} `));
}

// GET - Get single transaction
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const commUser = await getCommissionUser();
    if (!commUser) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    const { tenantId, isAdmin } = commUser;

    const [transaction] = await db
      .select()
      .from(commissionTransactions)
      .where(and(eq(commissionTransactions.tenantId, tenantId), eq(commissionTransactions.id, id)))
      .limit(1);

    if (!transaction) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    if (!isAdmin && !canAccessTransaction(transaction, commUser.agentCodes)) {
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

// PATCH - Update transaction fields (admin-only)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const commUser = await getCommissionUser();
    if (!commUser) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    if (!commUser.isAdmin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }
    const { tenantId } = commUser;

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

// DELETE - Delete transaction and related allocations (admin-only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const commUser = await getCommissionUser();
    if (!commUser) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    if (!commUser.isAdmin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }
    const { tenantId } = commUser;

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
