// API Route: /api/commissions/carriers/[id]/aliases/[aliasId]
// Delete a specific carrier alias

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { commissionCarrierAliases } from "@/db/schema";
import { eq, and } from "drizzle-orm";

// DELETE - Delete a carrier alias
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; aliasId: string }> }
) {
  try {
    const { id, aliasId } = await params;
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    const [deleted] = await db
      .delete(commissionCarrierAliases)
      .where(
        and(
          eq(commissionCarrierAliases.tenantId, tenantId),
          eq(commissionCarrierAliases.carrierId, id),
          eq(commissionCarrierAliases.id, aliasId)
        )
      )
      .returning({ id: commissionCarrierAliases.id });

    if (!deleted) {
      return NextResponse.json({ error: "Alias not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: "Alias deleted",
    });
  } catch (error: unknown) {
    console.error("[Commission Carriers] Error:", error);
    return NextResponse.json(
      { error: "Failed to delete alias", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
