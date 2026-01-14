// API Route: /api/lien-holders
// List and create lien holders

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { lienHolders } from "@/db/schema";
import { eq, and, ilike, or, desc } from "drizzle-orm";

// GET - List lien holders with filtering
export async function GET(request: NextRequest) {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search");
    const type = searchParams.get("type");
    const favorites = searchParams.get("favorites") === "true";

    const conditions = [eq(lienHolders.tenantId, tenantId)];

    if (favorites) {
      conditions.push(eq(lienHolders.isFavorite, true));
    }

    if (type) {
      conditions.push(eq(lienHolders.type, type));
    }

    let results;
    if (search) {
      results = await db
        .select()
        .from(lienHolders)
        .where(
          and(
            ...conditions,
            or(
              ilike(lienHolders.name, `%${search}%`),
              ilike(lienHolders.city, `%${search}%`),
              ilike(lienHolders.state, `%${search}%`)
            )
          )
        )
        .orderBy(desc(lienHolders.isFavorite), desc(lienHolders.lastUsedAt), lienHolders.name);
    } else {
      results = await db
        .select()
        .from(lienHolders)
        .where(and(...conditions))
        .orderBy(desc(lienHolders.isFavorite), desc(lienHolders.lastUsedAt), lienHolders.name);
    }

    return NextResponse.json({
      success: true,
      data: results,
      count: results.length,
    });
  } catch (error: unknown) {
    console.error("[Lien Holders] List error:", error);
    return NextResponse.json(
      { error: "Failed to list lien holders", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// POST - Create new lien holder
export async function POST(request: NextRequest) {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    const body = await request.json();

    if (!body.name || !body.address1 || !body.city || !body.state || !body.zipCode) {
      return NextResponse.json(
        { error: "Name, address1, city, state, and zipCode are required" },
        { status: 400 }
      );
    }

    const [newLienHolder] = await db
      .insert(lienHolders)
      .values({
        tenantId,
        name: body.name,
        type: body.type || null,
        address1: body.address1,
        address2: body.address2 || null,
        city: body.city,
        state: body.state,
        zipCode: body.zipCode,
        phone: body.phone || null,
        fax: body.fax || null,
        email: body.email || null,
        notes: body.notes || null,
        isFavorite: body.isFavorite || false,
      })
      .returning();

    return NextResponse.json({
      success: true,
      data: newLienHolder,
    });
  } catch (error: unknown) {
    console.error("[Lien Holders] Create error:", error);
    return NextResponse.json(
      { error: "Failed to create lien holder", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
