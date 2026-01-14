// API Route: /api/mortgagee-clauses/[id]
// Get, update, delete individual clause

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { mortgageeClauses, lienHolders } from "@/db/schema";
import { eq, and } from "drizzle-orm";

// GET - Get single clause
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

    const [result] = await db
      .select({
        clause: mortgageeClauses,
        lienHolder: {
          id: lienHolders.id,
          name: lienHolders.name,
        },
      })
      .from(mortgageeClauses)
      .leftJoin(lienHolders, eq(mortgageeClauses.lienHolderId, lienHolders.id))
      .where(and(eq(mortgageeClauses.tenantId, tenantId), eq(mortgageeClauses.id, id)))
      .limit(1);

    if (!result) {
      return NextResponse.json({ error: "Clause not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: {
        ...result.clause,
        lienHolder: result.lienHolder,
      },
    });
  } catch (error: unknown) {
    console.error("[Mortgagee Clauses] Get error:", error);
    return NextResponse.json(
      { error: "Failed to get clause", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// PATCH - Update clause
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
      .update(mortgageeClauses)
      .set({
        lienHolderId: body.lienHolderId,
        displayName: body.displayName,
        clauseText: body.clauseText,
        policyTypes: body.policyTypes,
        isActive: body.isActive,
        updatedAt: new Date(),
      })
      .where(and(eq(mortgageeClauses.tenantId, tenantId), eq(mortgageeClauses.id, id)))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Clause not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: updated,
    });
  } catch (error: unknown) {
    console.error("[Mortgagee Clauses] Update error:", error);
    return NextResponse.json(
      { error: "Failed to update clause", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// DELETE - Delete clause
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

    const [deleted] = await db
      .delete(mortgageeClauses)
      .where(and(eq(mortgageeClauses.tenantId, tenantId), eq(mortgageeClauses.id, id)))
      .returning({ id: mortgageeClauses.id });

    if (!deleted) {
      return NextResponse.json({ error: "Clause not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: "Clause deleted",
    });
  } catch (error: unknown) {
    console.error("[Mortgagee Clauses] Delete error:", error);
    return NextResponse.json(
      { error: "Failed to delete clause", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
