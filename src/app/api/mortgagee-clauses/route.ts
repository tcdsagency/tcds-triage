// API Route: /api/mortgagee-clauses
// List and create mortgagee clauses

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { mortgageeClauses, lienHolders } from "@/db/schema";
import { eq, and, ilike, or, desc } from "drizzle-orm";

// GET - List clauses with filtering
export async function GET(request: NextRequest) {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search");
    const lienHolderId = searchParams.get("lienHolderId");

    const conditions = [eq(mortgageeClauses.tenantId, tenantId)];

    if (lienHolderId) {
      conditions.push(eq(mortgageeClauses.lienHolderId, lienHolderId));
    }

    let results;
    if (search) {
      results = await db
        .select({
          clause: mortgageeClauses,
          lienHolder: {
            id: lienHolders.id,
            name: lienHolders.name,
          },
        })
        .from(mortgageeClauses)
        .leftJoin(lienHolders, eq(mortgageeClauses.lienHolderId, lienHolders.id))
        .where(
          and(
            ...conditions,
            or(
              ilike(mortgageeClauses.displayName, `%${search}%`),
              ilike(mortgageeClauses.clauseText, `%${search}%`)
            )
          )
        )
        .orderBy(desc(mortgageeClauses.isActive), mortgageeClauses.displayName);
    } else {
      results = await db
        .select({
          clause: mortgageeClauses,
          lienHolder: {
            id: lienHolders.id,
            name: lienHolders.name,
          },
        })
        .from(mortgageeClauses)
        .leftJoin(lienHolders, eq(mortgageeClauses.lienHolderId, lienHolders.id))
        .where(and(...conditions))
        .orderBy(desc(mortgageeClauses.isActive), mortgageeClauses.displayName);
    }

    // Flatten the results
    const formattedResults = results.map((r) => ({
      ...r.clause,
      lienHolder: r.lienHolder,
    }));

    return NextResponse.json({
      success: true,
      data: formattedResults,
      count: formattedResults.length,
    });
  } catch (error: unknown) {
    console.error("[Mortgagee Clauses] List error:", error);
    return NextResponse.json(
      { error: "Failed to list clauses", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// POST - Create new clause
export async function POST(request: NextRequest) {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    const body = await request.json();

    if (!body.displayName || !body.clauseText) {
      return NextResponse.json(
        { error: "displayName and clauseText are required" },
        { status: 400 }
      );
    }

    const [newClause] = await db
      .insert(mortgageeClauses)
      .values({
        tenantId,
        lienHolderId: body.lienHolderId || null,
        displayName: body.displayName,
        clauseText: body.clauseText,
        policyTypes: body.policyTypes || null,
        isActive: body.isActive !== false,
      })
      .returning();

    return NextResponse.json({
      success: true,
      data: newClause,
    });
  } catch (error: unknown) {
    console.error("[Mortgagee Clauses] Create error:", error);
    return NextResponse.json(
      { error: "Failed to create clause", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
