// API Route: /api/es-brokers
// List and create E&S brokers

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { esBrokers } from "@/db/schema";
import { eq, and, ilike, or, desc } from "drizzle-orm";

// GET - List brokers with filtering
export async function GET(request: NextRequest) {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search");
    const favorites = searchParams.get("favorites") === "true";

    const conditions = [eq(esBrokers.tenantId, tenantId)];

    if (favorites) {
      conditions.push(eq(esBrokers.isFavorite, true));
    }

    let results;
    if (search) {
      results = await db
        .select()
        .from(esBrokers)
        .where(
          and(
            ...conditions,
            or(
              ilike(esBrokers.name, `%${search}%`),
              ilike(esBrokers.contactName, `%${search}%`)
            )
          )
        )
        .orderBy(desc(esBrokers.isFavorite), esBrokers.name);
    } else {
      results = await db
        .select()
        .from(esBrokers)
        .where(and(...conditions))
        .orderBy(desc(esBrokers.isFavorite), esBrokers.name);
    }

    return NextResponse.json({
      success: true,
      data: results,
      count: results.length,
    });
  } catch (error: unknown) {
    console.error("[E&S Brokers] List error:", error);
    return NextResponse.json(
      { error: "Failed to list brokers", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// POST - Create new broker
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

    const [newBroker] = await db
      .insert(esBrokers)
      .values({
        tenantId,
        name: body.name,
        contactName: body.contactName || null,
        email: body.email || null,
        phone: body.phone || null,
        website: body.website || null,
        notes: body.notes || null,
        isFavorite: body.isFavorite || false,
      })
      .returning();

    return NextResponse.json({
      success: true,
      data: newBroker,
    });
  } catch (error: unknown) {
    console.error("[E&S Brokers] Create error:", error);
    return NextResponse.json(
      { error: "Failed to create broker", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
