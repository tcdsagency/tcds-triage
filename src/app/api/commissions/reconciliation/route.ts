// API Route: /api/commissions/reconciliation
// List reconciliation records for a month

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { commissionCarrierReconciliation, commissionCarriers } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { requireAdmin } from "@/lib/commissions/auth";

// GET - List reconciliation records for a month
export async function GET(request: NextRequest) {
  try {
    const adminResult = await requireAdmin();
    if (adminResult instanceof NextResponse) return adminResult;
    const { tenantId } = adminResult;

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
        id: commissionCarrierReconciliation.id,
        tenantId: commissionCarrierReconciliation.tenantId,
        carrierId: commissionCarrierReconciliation.carrierId,
        carrierName: commissionCarriers.name,
        reportingMonth: commissionCarrierReconciliation.reportingMonth,
        carrierStatementTotal: commissionCarrierReconciliation.carrierStatementTotal,
        bankDepositTotal: commissionCarrierReconciliation.bankDepositTotal,
        systemTransactionTotal: commissionCarrierReconciliation.systemTransactionTotal,
        statementVsDeposit: commissionCarrierReconciliation.statementVsDeposit,
        statementVsSystem: commissionCarrierReconciliation.statementVsSystem,
        depositVsSystem: commissionCarrierReconciliation.depositVsSystem,
        status: commissionCarrierReconciliation.status,
        resolutionNotes: commissionCarrierReconciliation.resolutionNotes,
        createdAt: commissionCarrierReconciliation.createdAt,
        updatedAt: commissionCarrierReconciliation.updatedAt,
      })
      .from(commissionCarrierReconciliation)
      .innerJoin(
        commissionCarriers,
        eq(commissionCarrierReconciliation.carrierId, commissionCarriers.id)
      )
      .where(
        and(
          eq(commissionCarrierReconciliation.tenantId, tenantId),
          eq(commissionCarrierReconciliation.reportingMonth, month)
        )
      );

    return NextResponse.json({
      success: true,
      data: results,
      count: results.length,
    });
  } catch (error: unknown) {
    console.error("[Commission Reconciliation] Error:", error);
    return NextResponse.json(
      { error: "Failed to list reconciliation records", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
