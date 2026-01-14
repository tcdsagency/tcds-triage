// API Route: /api/agency-carriers/[id]
// Get, update, delete individual carrier

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { agencyCarriers } from "@/db/schema";
import { eq, and } from "drizzle-orm";

// GET - Get single carrier
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

    const [carrier] = await db
      .select()
      .from(agencyCarriers)
      .where(and(eq(agencyCarriers.tenantId, tenantId), eq(agencyCarriers.id, id)))
      .limit(1);

    if (!carrier) {
      return NextResponse.json({ error: "Carrier not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: carrier,
    });
  } catch (error: unknown) {
    console.error("[Agency Carriers] Get error:", error);
    return NextResponse.json(
      { error: "Failed to get carrier", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// PUT - Update carrier
export async function PUT(
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
      .update(agencyCarriers)
      .set({
        name: body.name,
        website: body.website,
        products: body.products,
        newBusinessCommission: body.newBusinessCommission,
        renewalCommission: body.renewalCommission,
        agencySupportPhone: body.agencySupportPhone,
        agencyCode: body.agencyCode,
        marketingRepName: body.marketingRepName,
        marketingRepEmail: body.marketingRepEmail,
        marketingRepPhone: body.marketingRepPhone,
        isFavorite: body.isFavorite,
        updatedAt: new Date(),
      })
      .where(and(eq(agencyCarriers.tenantId, tenantId), eq(agencyCarriers.id, id)))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Carrier not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: updated,
    });
  } catch (error: unknown) {
    console.error("[Agency Carriers] Update error:", error);
    return NextResponse.json(
      { error: "Failed to update carrier", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// DELETE - Delete carrier
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
      .delete(agencyCarriers)
      .where(and(eq(agencyCarriers.tenantId, tenantId), eq(agencyCarriers.id, id)))
      .returning({ id: agencyCarriers.id });

    if (!deleted) {
      return NextResponse.json({ error: "Carrier not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: "Carrier deleted",
    });
  } catch (error: unknown) {
    console.error("[Agency Carriers] Delete error:", error);
    return NextResponse.json(
      { error: "Failed to delete carrier", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
