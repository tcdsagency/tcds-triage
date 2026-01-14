// API Route: /api/lien-holders/[id]
// Get, update, delete individual lien holder

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { lienHolders } from "@/db/schema";
import { eq, and } from "drizzle-orm";

// GET - Get single lien holder
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

    const [lienHolder] = await db
      .select()
      .from(lienHolders)
      .where(and(eq(lienHolders.tenantId, tenantId), eq(lienHolders.id, id)))
      .limit(1);

    if (!lienHolder) {
      return NextResponse.json({ error: "Lien holder not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: lienHolder,
    });
  } catch (error: unknown) {
    console.error("[Lien Holders] Get error:", error);
    return NextResponse.json(
      { error: "Failed to get lien holder", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// PATCH - Update lien holder
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
      .update(lienHolders)
      .set({
        name: body.name,
        type: body.type,
        address1: body.address1,
        address2: body.address2,
        city: body.city,
        state: body.state,
        zipCode: body.zipCode,
        phone: body.phone,
        fax: body.fax,
        email: body.email,
        notes: body.notes,
        isFavorite: body.isFavorite,
        updatedAt: new Date(),
      })
      .where(and(eq(lienHolders.tenantId, tenantId), eq(lienHolders.id, id)))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Lien holder not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: updated,
    });
  } catch (error: unknown) {
    console.error("[Lien Holders] Update error:", error);
    return NextResponse.json(
      { error: "Failed to update lien holder", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// DELETE - Delete lien holder
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
      .delete(lienHolders)
      .where(and(eq(lienHolders.tenantId, tenantId), eq(lienHolders.id, id)))
      .returning({ id: lienHolders.id });

    if (!deleted) {
      return NextResponse.json({ error: "Lien holder not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: "Lien holder deleted",
    });
  } catch (error: unknown) {
    console.error("[Lien Holders] Delete error:", error);
    return NextResponse.json(
      { error: "Failed to delete lien holder", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
