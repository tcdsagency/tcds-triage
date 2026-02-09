// API Route: /api/commissions/agents/[id]/codes/[codeId]
// Delete individual agent code

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { commissionAgentCodes } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { requireAdmin } from "@/lib/commissions/auth";

// DELETE - Delete a specific agent code
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; codeId: string }> }
) {
  try {
    const { id, codeId } = await params;
    const adminResult = await requireAdmin();
    if (adminResult instanceof NextResponse) return adminResult;
    const { tenantId } = adminResult;

    const [deleted] = await db
      .delete(commissionAgentCodes)
      .where(
        and(
          eq(commissionAgentCodes.tenantId, tenantId),
          eq(commissionAgentCodes.agentId, id),
          eq(commissionAgentCodes.id, codeId)
        )
      )
      .returning({ id: commissionAgentCodes.id });

    if (!deleted) {
      return NextResponse.json({ error: "Agent code not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: "Agent code deleted",
    });
  } catch (error: unknown) {
    console.error("[Commission Agents] Error:", error);
    return NextResponse.json(
      { error: "Failed to delete agent code", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
