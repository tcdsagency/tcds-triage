// API Route: /api/commissions/carriers/[id]/aliases/[aliasId]
// Delete a specific carrier alias

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { commissionCarrierAliases } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { requireAdmin } from "@/lib/commissions/auth";

// DELETE - Delete a carrier alias
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; aliasId: string }> }
) {
  try {
    const { id, aliasId } = await params;
    const adminResult = await requireAdmin();
    if (adminResult instanceof NextResponse) return adminResult;
    const { tenantId } = adminResult;

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
