// API Route: /api/commissions/me
// Get current user's commission context (role, agentId, codes)

import { NextResponse } from "next/server";
import { getCommissionUser } from "@/lib/commissions/auth";

export async function GET() {
  try {
    const commUser = await getCommissionUser();
    if (!commUser) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    return NextResponse.json({
      success: true,
      data: {
        isAdmin: commUser.isAdmin,
        agentId: commUser.agentId,
        agentCodes: commUser.agentCodes,
      },
    });
  } catch (error: unknown) {
    console.error("[Commission Me] Error:", error);
    return NextResponse.json(
      { error: "Failed to get commission user", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
