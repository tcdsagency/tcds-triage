import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { commissionFieldMappings } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { requireAdmin } from "@/lib/commissions/auth";

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
      .update(commissionFieldMappings)
      .set({
        name: body.name,
        carrierId: body.carrierId ?? undefined,
        mapping: body.mapping ?? undefined,
        isDefault: body.isDefault ?? undefined,
        updatedAt: new Date(),
      })
      .where(and(eq(commissionFieldMappings.tenantId, tenantId), eq(commissionFieldMappings.id, id)))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Field mapping not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: updated });
  } catch (error: unknown) {
    console.error("[Commission Field Mappings] Update error:", error);
    return NextResponse.json(
      { error: "Failed to update field mapping", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

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
      .delete(commissionFieldMappings)
      .where(and(eq(commissionFieldMappings.tenantId, tenantId), eq(commissionFieldMappings.id, id)))
      .returning({ id: commissionFieldMappings.id });

    if (!deleted) {
      return NextResponse.json({ error: "Field mapping not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: "Field mapping deleted" });
  } catch (error: unknown) {
    console.error("[Commission Field Mappings] Delete error:", error);
    return NextResponse.json(
      { error: "Failed to delete field mapping", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
