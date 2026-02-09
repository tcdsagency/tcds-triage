// API Route: /api/commissions/draw
// Get draw balances with optional recalculation

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { commissionDrawBalances, commissionAgents } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { calculateAllDrawBalances } from "@/lib/commissions/draw-calculator";
import { getCommissionUser } from "@/lib/commissions/auth";

// GET - Get draw balances for a month
export async function GET(request: NextRequest) {
  try {
    const commUser = await getCommissionUser();
    if (!commUser) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    const { tenantId, isAdmin } = commUser;

    const { searchParams } = new URL(request.url);
    const month = searchParams.get("month");
    const recalculate = searchParams.get("recalculate");

    if (!month) {
      return NextResponse.json(
        { error: "month query parameter is required (YYYY-MM)" },
        { status: 400 }
      );
    }

    // Recalculate is admin-only
    if (recalculate === "true") {
      if (!isAdmin) {
        return NextResponse.json({ error: "Admin access required" }, { status: 403 });
      }
      const calcResults = await calculateAllDrawBalances(tenantId, month);
      return NextResponse.json({
        success: true,
        data: calcResults,
        count: calcResults.length,
        recalculated: true,
      });
    }

    // Build conditions - non-admins only see their own draw balance
    const conditions = [
      eq(commissionDrawBalances.tenantId, tenantId),
      eq(commissionDrawBalances.reportingMonth, month),
    ];
    if (!isAdmin) {
      if (!commUser.agentId) {
        return NextResponse.json({ success: true, data: [], count: 0 });
      }
      conditions.push(eq(commissionDrawBalances.agentId, commUser.agentId));
    }

    // Return stored balances with agent info
    const results = await db
      .select({
        id: commissionDrawBalances.id,
        tenantId: commissionDrawBalances.tenantId,
        agentId: commissionDrawBalances.agentId,
        agentFirstName: commissionAgents.firstName,
        agentLastName: commissionAgents.lastName,
        reportingMonth: commissionDrawBalances.reportingMonth,
        balanceForward: commissionDrawBalances.balanceForward,
        totalCommissionsEarned: commissionDrawBalances.totalCommissionsEarned,
        totalDrawPayments: commissionDrawBalances.totalDrawPayments,
        endingBalance: commissionDrawBalances.endingBalance,
        createdAt: commissionDrawBalances.createdAt,
        updatedAt: commissionDrawBalances.updatedAt,
      })
      .from(commissionDrawBalances)
      .innerJoin(
        commissionAgents,
        eq(commissionDrawBalances.agentId, commissionAgents.id)
      )
      .where(and(...conditions));

    return NextResponse.json({
      success: true,
      data: results,
      count: results.length,
    });
  } catch (error: unknown) {
    console.error("[Commission Draw] Error:", error);
    return NextResponse.json(
      { error: "Failed to get draw balances", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
