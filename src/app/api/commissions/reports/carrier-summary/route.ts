// API Route: /api/commissions/reports/carrier-summary
// Carrier summary report - transactions grouped by carrier name

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { commissionTransactions } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { getCommissionUser, getAgentTransactionFilter } from "@/lib/commissions/auth";

// GET - Carrier summary for a month
export async function GET(request: NextRequest) {
  try {
    const commUser = await getCommissionUser();
    if (!commUser) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    const { tenantId, isAdmin } = commUser;

    const { searchParams } = new URL(request.url);
    const month = searchParams.get("month");

    if (!month) {
      return NextResponse.json(
        { error: "month query parameter is required (YYYY-MM)" },
        { status: 400 }
      );
    }

    // Build conditions
    const conditions = [
      eq(commissionTransactions.tenantId, tenantId),
      eq(commissionTransactions.reportingMonth, month),
    ];

    if (!isAdmin) {
      const agentFilter = getAgentTransactionFilter(commUser.agentCodes);
      if (!agentFilter) {
        return NextResponse.json({ success: true, data: [], count: 0 });
      }
      conditions.push(agentFilter);
    }

    // Group by carrier name directly (carrierId may not be populated)
    const results = await db
      .select({
        carrierName: commissionTransactions.carrierName,
        transactionCount: sql<number>`COUNT(*)::int`,
        totalCommission: sql<string>`COALESCE(SUM(CAST(${commissionTransactions.commissionAmount} AS DECIMAL(12,2))), 0)`,
        totalPremium: sql<string>`COALESCE(SUM(CAST(${commissionTransactions.grossPremium} AS DECIMAL(12,2))), 0)`,
      })
      .from(commissionTransactions)
      .where(and(...conditions))
      .groupBy(commissionTransactions.carrierName)
      .orderBy(sql`COALESCE(SUM(CAST(${commissionTransactions.commissionAmount} AS DECIMAL(12,2))), 0) DESC`);

    // Map to expected shape
    const data = results.map((r) => ({
      carrierId: r.carrierName || "unknown",
      carrierName: r.carrierName || "Unknown Carrier",
      transactionCount: Number(r.transactionCount),
      totalCommission: parseFloat(r.totalCommission),
      totalPremium: parseFloat(r.totalPremium),
    }));

    return NextResponse.json({
      success: true,
      data,
      count: data.length,
    });
  } catch (error: unknown) {
    console.error("[Commission Carrier Summary] Error:", error);
    return NextResponse.json(
      { error: "Failed to generate carrier summary", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
