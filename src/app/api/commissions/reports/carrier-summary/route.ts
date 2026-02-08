// API Route: /api/commissions/reports/carrier-summary
// Carrier summary report - transactions grouped by carrier

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { commissionTransactions, commissionCarriers } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";

// GET - Carrier summary for a month
export async function GET(request: NextRequest) {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const month = searchParams.get("month");

    if (!month) {
      return NextResponse.json(
        { error: "month query parameter is required (YYYY-MM)" },
        { status: 400 }
      );
    }

    const results = await db
      .select({
        carrierId: commissionTransactions.carrierId,
        carrierName: commissionCarriers.name,
        transactionType: commissionTransactions.transactionType,
        transactionCount: sql<number>`COUNT(*)`,
        totalCommission: sql<string>`COALESCE(SUM(CAST(${commissionTransactions.commissionAmount} AS DECIMAL(12,2))), 0)`,
        totalPremium: sql<string>`COALESCE(SUM(CAST(${commissionTransactions.grossPremium} AS DECIMAL(12,2))), 0)`,
      })
      .from(commissionTransactions)
      .leftJoin(
        commissionCarriers,
        eq(commissionTransactions.carrierId, commissionCarriers.id)
      )
      .where(
        and(
          eq(commissionTransactions.tenantId, tenantId),
          eq(commissionTransactions.reportingMonth, month)
        )
      )
      .groupBy(
        commissionTransactions.carrierId,
        commissionCarriers.name,
        commissionTransactions.transactionType
      );

    return NextResponse.json({
      success: true,
      data: results,
      count: results.length,
    });
  } catch (error: unknown) {
    console.error("[Commission Carrier Summary] Error:", error);
    return NextResponse.json(
      { error: "Failed to generate carrier summary", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
