// API Route: /api/commissions/field-mappings
// List and create field mapping templates

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { commissionFieldMappings } from "@/db/schema";
import { eq } from "drizzle-orm";

// GET - List field mappings
export async function GET(request: NextRequest) {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    const results = await db
      .select()
      .from(commissionFieldMappings)
      .where(eq(commissionFieldMappings.tenantId, tenantId));

    return NextResponse.json({
      success: true,
      data: results,
      count: results.length,
    });
  } catch (error: unknown) {
    console.error("[Commission Field Mappings] Error:", error);
    return NextResponse.json(
      { error: "Failed to list field mappings", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// POST - Create new field mapping
export async function POST(request: NextRequest) {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    const body = await request.json();

    if (!body.name || !body.mapping) {
      return NextResponse.json(
        { error: "name and mapping are required" },
        { status: 400 }
      );
    }

    const [mapping] = await db
      .insert(commissionFieldMappings)
      .values({
        tenantId,
        name: body.name,
        mapping: body.mapping,
        carrierId: body.carrierId || null,
        isDefault: body.isDefault ?? false,
      })
      .returning();

    return NextResponse.json({
      success: true,
      data: mapping,
    });
  } catch (error: unknown) {
    console.error("[Commission Field Mappings] Error:", error);
    return NextResponse.json(
      { error: "Failed to create field mapping", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
