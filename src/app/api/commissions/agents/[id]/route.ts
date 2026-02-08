// API Route: /api/commissions/agents/[id]
// Get, update, delete individual commission agent

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { commissionAgents, commissionAgentCodes } from "@/db/schema";
import { eq, and } from "drizzle-orm";

// GET - Get single agent with related codes
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

    const [agent] = await db
      .select()
      .from(commissionAgents)
      .where(and(eq(commissionAgents.tenantId, tenantId), eq(commissionAgents.id, id)))
      .limit(1);

    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    const codes = await db
      .select()
      .from(commissionAgentCodes)
      .where(and(eq(commissionAgentCodes.tenantId, tenantId), eq(commissionAgentCodes.agentId, id)));

    return NextResponse.json({
      success: true,
      data: { ...agent, codes },
    });
  } catch (error: unknown) {
    console.error("[Commission Agents] Error:", error);
    return NextResponse.json(
      { error: "Failed to get agent", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// PATCH - Update agent
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
      .update(commissionAgents)
      .set({
        firstName: body.firstName,
        lastName: body.lastName,
        email: body.email,
        role: body.role,
        isActive: body.isActive,
        hasDrawAccount: body.hasDrawAccount,
        monthlyDrawAmount: body.monthlyDrawAmount,
        defaultSplitPercent: body.defaultSplitPercent,
        userId: body.userId,
        notes: body.notes,
        updatedAt: new Date(),
      })
      .where(and(eq(commissionAgents.tenantId, tenantId), eq(commissionAgents.id, id)))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: updated,
    });
  } catch (error: unknown) {
    console.error("[Commission Agents] Error:", error);
    return NextResponse.json(
      { error: "Failed to update agent", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// DELETE - Delete agent
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
      .delete(commissionAgents)
      .where(and(eq(commissionAgents.tenantId, tenantId), eq(commissionAgents.id, id)))
      .returning({ id: commissionAgents.id });

    if (!deleted) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: "Agent deleted",
    });
  } catch (error: unknown) {
    console.error("[Commission Agents] Error:", error);
    return NextResponse.json(
      { error: "Failed to delete agent", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
