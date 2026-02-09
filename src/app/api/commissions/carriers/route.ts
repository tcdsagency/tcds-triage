// API Route: /api/commissions/carriers
// List and create commission carriers

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { commissionCarriers } from "@/db/schema";
import { eq, and, ilike, or } from "drizzle-orm";
import { requireAdmin } from "@/lib/commissions/auth";

// GET - List carriers with optional search and active filter
export async function GET(request: NextRequest) {
  try {
    const adminResult = await requireAdmin();
    if (adminResult instanceof NextResponse) return adminResult;
    const { tenantId } = adminResult;

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search");
    const active = searchParams.get("active");

    const conditions = [eq(commissionCarriers.tenantId, tenantId)];

    if (active === "true") {
      conditions.push(eq(commissionCarriers.isActive, true));
    }

    let results;
    if (search) {
      results = await db
        .select()
        .from(commissionCarriers)
        .where(
          and(
            ...conditions,
            or(
              ilike(commissionCarriers.name, `%${search}%`),
              ilike(commissionCarriers.carrierCode, `%${search}%`)
            )
          )
        )
        .orderBy(commissionCarriers.name);
    } else {
      results = await db
        .select()
        .from(commissionCarriers)
        .where(and(...conditions))
        .orderBy(commissionCarriers.name);
    }

    return NextResponse.json({
      success: true,
      data: results,
      count: results.length,
    });
  } catch (error: unknown) {
    console.error("[Commission Carriers] Error:", error);
    return NextResponse.json(
      { error: "Failed to list carriers", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// POST - Create new carrier
export async function POST(request: NextRequest) {
  try {
    const adminResult = await requireAdmin();
    if (adminResult instanceof NextResponse) return adminResult;
    const { tenantId } = adminResult;

    const body = await request.json();

    if (!body.name) {
      return NextResponse.json(
        { error: "Name is required" },
        { status: 400 }
      );
    }

    const [carrier] = await db
      .insert(commissionCarriers)
      .values({
        tenantId,
        name: body.name,
        carrierCode: body.carrierCode || null,
        defaultNewBusinessRate: body.defaultNewBusinessRate || null,
        defaultRenewalRate: body.defaultRenewalRate || null,
        isActive: body.isActive ?? true,
        notes: body.notes || null,
      })
      .returning();

    return NextResponse.json({
      success: true,
      data: carrier,
    });
  } catch (error: unknown) {
    console.error("[Commission Carriers] Error:", error);
    return NextResponse.json(
      { error: "Failed to create carrier", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
