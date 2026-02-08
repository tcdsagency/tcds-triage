// API Route: /api/commissions/agents
// List and create commission agents

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { commissionAgents } from "@/db/schema";
import { eq, and, ilike, or } from "drizzle-orm";

// GET - List agents with optional search and active filtering
export async function GET(request: NextRequest) {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search");
    const active = searchParams.get("active");

    const conditions = [eq(commissionAgents.tenantId, tenantId)];

    if (active === "true") {
      conditions.push(eq(commissionAgents.isActive, true));
    }

    let results;
    if (search) {
      results = await db
        .select()
        .from(commissionAgents)
        .where(
          and(
            ...conditions,
            or(
              ilike(commissionAgents.firstName, `%${search}%`),
              ilike(commissionAgents.lastName, `%${search}%`),
              ilike(commissionAgents.email, `%${search}%`)
            )
          )
        )
        .orderBy(commissionAgents.lastName, commissionAgents.firstName);
    } else {
      results = await db
        .select()
        .from(commissionAgents)
        .where(and(...conditions))
        .orderBy(commissionAgents.lastName, commissionAgents.firstName);
    }

    return NextResponse.json({
      success: true,
      data: results,
      count: results.length,
    });
  } catch (error: unknown) {
    console.error("[Commission Agents] Error:", error);
    return NextResponse.json(
      { error: "Failed to list agents", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// POST - Create new commission agent
export async function POST(request: NextRequest) {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    const body = await request.json();

    if (!body.firstName || !body.lastName) {
      return NextResponse.json(
        { error: "firstName and lastName are required" },
        { status: 400 }
      );
    }

    const [agent] = await db
      .insert(commissionAgents)
      .values({
        tenantId,
        firstName: body.firstName,
        lastName: body.lastName,
        email: body.email || null,
        role: body.role || 'producer',
        isActive: body.isActive ?? true,
        hasDrawAccount: body.hasDrawAccount ?? false,
        monthlyDrawAmount: body.monthlyDrawAmount || null,
        defaultSplitPercent: body.defaultSplitPercent || '100',
        userId: body.userId || null,
        notes: body.notes || null,
      })
      .returning();

    return NextResponse.json({
      success: true,
      data: agent,
    });
  } catch (error: unknown) {
    console.error("[Commission Agents] Error:", error);
    return NextResponse.json(
      { error: "Failed to create agent", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
