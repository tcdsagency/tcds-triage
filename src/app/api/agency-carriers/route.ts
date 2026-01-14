// API Route: /api/agency-carriers
// List and create agency carriers

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { agencyCarriers } from "@/db/schema";
import { eq, and, ilike, or, desc } from "drizzle-orm";

// GET - List carriers with filtering
export async function GET(request: NextRequest) {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search");
    const favorites = searchParams.get("favorites") === "true";

    // Build query
    const conditions = [eq(agencyCarriers.tenantId, tenantId)];

    if (favorites) {
      conditions.push(eq(agencyCarriers.isFavorite, true));
    }

    let results;
    if (search) {
      results = await db
        .select()
        .from(agencyCarriers)
        .where(
          and(
            ...conditions,
            or(
              ilike(agencyCarriers.name, `%${search}%`),
              ilike(agencyCarriers.products, `%${search}%`),
              ilike(agencyCarriers.agencyCode, `%${search}%`)
            )
          )
        )
        .orderBy(desc(agencyCarriers.isFavorite), agencyCarriers.name);
    } else {
      results = await db
        .select()
        .from(agencyCarriers)
        .where(and(...conditions))
        .orderBy(desc(agencyCarriers.isFavorite), agencyCarriers.name);
    }

    return NextResponse.json({
      success: true,
      data: results,
      count: results.length,
    });
  } catch (error: unknown) {
    console.error("[Agency Carriers] List error:", error);
    return NextResponse.json(
      { error: "Failed to list carriers", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// POST - Create new carrier
export async function POST(request: NextRequest) {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    const body = await request.json();

    if (!body.name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const [newCarrier] = await db
      .insert(agencyCarriers)
      .values({
        tenantId,
        name: body.name,
        website: body.website || null,
        products: body.products || null,
        newBusinessCommission: body.newBusinessCommission || null,
        renewalCommission: body.renewalCommission || null,
        agencySupportPhone: body.agencySupportPhone || null,
        agencyCode: body.agencyCode || null,
        marketingRepName: body.marketingRepName || null,
        marketingRepEmail: body.marketingRepEmail || null,
        marketingRepPhone: body.marketingRepPhone || null,
        isFavorite: body.isFavorite || false,
      })
      .returning();

    return NextResponse.json({
      success: true,
      data: newCarrier,
    });
  } catch (error: unknown) {
    console.error("[Agency Carriers] Create error:", error);
    return NextResponse.json(
      { error: "Failed to create carrier", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
