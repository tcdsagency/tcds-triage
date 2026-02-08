// API Route: /api/commissions/transactions/[id]/allocations
// List and replace allocations for a commission transaction

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { commissionTransactions, commissionAllocations, commissionAgents } from "@/db/schema";
import { eq, and } from "drizzle-orm";

// GET - List allocations for a transaction with agent names
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

    const results = await db
      .select({
        id: commissionAllocations.id,
        tenantId: commissionAllocations.tenantId,
        transactionId: commissionAllocations.transactionId,
        agentId: commissionAllocations.agentId,
        splitPercent: commissionAllocations.splitPercent,
        splitAmount: commissionAllocations.splitAmount,
        createdAt: commissionAllocations.createdAt,
        agentFirstName: commissionAgents.firstName,
        agentLastName: commissionAgents.lastName,
      })
      .from(commissionAllocations)
      .leftJoin(commissionAgents, eq(commissionAllocations.agentId, commissionAgents.id))
      .where(and(eq(commissionAllocations.tenantId, tenantId), eq(commissionAllocations.transactionId, id)));

    return NextResponse.json({
      success: true,
      data: results,
      count: results.length,
    });
  } catch (error: unknown) {
    console.error("[Commission Allocations] List error:", error);
    return NextResponse.json(
      { error: "Failed to list allocations", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// PUT - Replace all allocations for a transaction
export async function PUT(
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

    if (!body.allocations || !Array.isArray(body.allocations) || body.allocations.length === 0) {
      return NextResponse.json(
        { error: "allocations array is required and must not be empty" },
        { status: 400 }
      );
    }

    // Fetch the transaction to get commissionAmount
    const [transaction] = await db
      .select()
      .from(commissionTransactions)
      .where(and(eq(commissionTransactions.tenantId, tenantId), eq(commissionTransactions.id, id)))
      .limit(1);

    if (!transaction) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    const commissionAmount = parseFloat(transaction.commissionAmount);

    // Delete existing allocations
    await db
      .delete(commissionAllocations)
      .where(and(eq(commissionAllocations.tenantId, tenantId), eq(commissionAllocations.transactionId, id)));

    // Insert new allocations
    const newAllocations = body.allocations.map((alloc: { agentId: string; splitPercent: number }) => ({
      tenantId,
      transactionId: id,
      agentId: alloc.agentId,
      splitPercent: alloc.splitPercent.toString(),
      splitAmount: ((commissionAmount * alloc.splitPercent) / 100).toFixed(2),
    }));

    const inserted = await db
      .insert(commissionAllocations)
      .values(newAllocations)
      .returning();

    return NextResponse.json({
      success: true,
      data: inserted,
      count: inserted.length,
    });
  } catch (error: unknown) {
    console.error("[Commission Allocations] Replace error:", error);
    return NextResponse.json(
      { error: "Failed to replace allocations", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
