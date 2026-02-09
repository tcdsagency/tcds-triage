// API Route: /api/commissions/carriers/[id]
// Get, update, delete individual commission carrier

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { commissionCarriers, commissionCarrierAliases } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { requireAdmin } from "@/lib/commissions/auth";

// GET - Get single carrier with aliases
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const adminResult = await requireAdmin();
    if (adminResult instanceof NextResponse) return adminResult;
    const { tenantId } = adminResult;

    const [carrier] = await db
      .select()
      .from(commissionCarriers)
      .where(and(eq(commissionCarriers.tenantId, tenantId), eq(commissionCarriers.id, id)))
      .limit(1);

    if (!carrier) {
      return NextResponse.json({ error: "Carrier not found" }, { status: 404 });
    }

    const aliases = await db
      .select()
      .from(commissionCarrierAliases)
      .where(and(eq(commissionCarrierAliases.tenantId, tenantId), eq(commissionCarrierAliases.carrierId, id)));

    return NextResponse.json({
      success: true,
      data: { ...carrier, aliases },
    });
  } catch (error: unknown) {
    console.error("[Commission Carriers] Error:", error);
    return NextResponse.json(
      { error: "Failed to get carrier", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// PATCH - Update carrier
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const adminResult = await requireAdmin();
    if (adminResult instanceof NextResponse) return adminResult;
    const { tenantId } = adminResult;

    const body = await request.json();

    const [updated] = await db
      .update(commissionCarriers)
      .set({
        name: body.name,
        carrierCode: body.carrierCode,
        defaultNewBusinessRate: body.defaultNewBusinessRate,
        defaultRenewalRate: body.defaultRenewalRate,
        isActive: body.isActive,
        notes: body.notes,
        updatedAt: new Date(),
      })
      .where(and(eq(commissionCarriers.tenantId, tenantId), eq(commissionCarriers.id, id)))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Carrier not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: updated,
    });
  } catch (error: unknown) {
    console.error("[Commission Carriers] Error:", error);
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
    const adminResult = await requireAdmin();
    if (adminResult instanceof NextResponse) return adminResult;
    const { tenantId } = adminResult;

    const [deleted] = await db
      .delete(commissionCarriers)
      .where(and(eq(commissionCarriers.tenantId, tenantId), eq(commissionCarriers.id, id)))
      .returning({ id: commissionCarriers.id });

    if (!deleted) {
      return NextResponse.json({ error: "Carrier not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: "Carrier deleted",
    });
  } catch (error: unknown) {
    console.error("[Commission Carriers] Error:", error);
    return NextResponse.json(
      { error: "Failed to delete carrier", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
