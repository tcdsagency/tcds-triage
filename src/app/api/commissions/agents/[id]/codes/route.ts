// API Route: /api/commissions/agents/[id]/codes
// List and create agent codes

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { commissionAgentCodes } from "@/db/schema";
import { eq, and } from "drizzle-orm";

// GET - List codes for an agent
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

    const codes = await db
      .select()
      .from(commissionAgentCodes)
      .where(and(eq(commissionAgentCodes.tenantId, tenantId), eq(commissionAgentCodes.agentId, id)));

    return NextResponse.json({
      success: true,
      data: codes,
      count: codes.length,
    });
  } catch (error: unknown) {
    console.error("[Commission Agents] Error:", error);
    return NextResponse.json(
      { error: "Failed to list agent codes", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// POST - Create a code for an agent
export async function POST(
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

    if (!body.code) {
      return NextResponse.json(
        { error: "code is required" },
        { status: 400 }
      );
    }

    const [agentCode] = await db
      .insert(commissionAgentCodes)
      .values({
        tenantId,
        agentId: id,
        code: body.code,
        carrierId: body.carrierId || null,
        description: body.description || null,
      })
      .returning();

    return NextResponse.json({
      success: true,
      data: agentCode,
    });
  } catch (error: unknown) {
    console.error("[Commission Agents] Error:", error);
    return NextResponse.json(
      { error: "Failed to create agent code", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
