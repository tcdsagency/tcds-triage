// API Route: /api/commissions/dashboard
// Dashboard stats - commissions, reconciliation, anomalies, agents, imports

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import {
  commissionTransactions,
  commissionCarrierReconciliation,
  commissionAnomalies,
  commissionAgents,
  commissionImportBatches,
} from "@/db/schema";
import { eq, and, sql, desc } from "drizzle-orm";
import { getCommissionUser, getAgentTransactionFilter } from "@/lib/commissions/auth";

// GET - Dashboard stats
export async function GET(request: NextRequest) {
  try {
    const commUser = await getCommissionUser();
    if (!commUser) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    const { tenantId, isAdmin } = commUser;

    // Current month in YYYY-MM format
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    // Previous month
    const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, "0")}`;

    // Agent filter for non-admins
    const agentFilter = !isAdmin ? getAgentTransactionFilter(commUser.agentCodes) : undefined;
    // If non-admin with no agent codes, they have no transactions
    if (!isAdmin && !agentFilter) {
      return NextResponse.json({
        success: true,
        data: {
          totalCommissionsThisMonth: 0,
          totalCommissionsLastMonth: 0,
          monthOverMonthChange: 0,
          currentMonth,
          lastMonth,
          isAdmin: false,
        },
      });
    }

    // Total commissions this month
    const thisMonthConditions = [
      eq(commissionTransactions.tenantId, tenantId),
      eq(commissionTransactions.reportingMonth, currentMonth),
    ];
    if (agentFilter) thisMonthConditions.push(agentFilter);

    const [thisMonthResult] = await db
      .select({
        total: sql<string>`COALESCE(SUM(CAST(${commissionTransactions.commissionAmount} AS DECIMAL(12,2))), 0)`,
      })
      .from(commissionTransactions)
      .where(and(...thisMonthConditions));

    const totalCommissionsThisMonth = parseFloat(thisMonthResult?.total || "0");

    // Total commissions last month
    const lastMonthConditions = [
      eq(commissionTransactions.tenantId, tenantId),
      eq(commissionTransactions.reportingMonth, lastMonth),
    ];
    if (agentFilter) lastMonthConditions.push(agentFilter);

    const [lastMonthResult] = await db
      .select({
        total: sql<string>`COALESCE(SUM(CAST(${commissionTransactions.commissionAmount} AS DECIMAL(12,2))), 0)`,
      })
      .from(commissionTransactions)
      .where(and(...lastMonthConditions));

    const totalCommissionsLastMonth = parseFloat(lastMonthResult?.total || "0");

    // Month over month change
    const monthOverMonthChange =
      totalCommissionsLastMonth !== 0
        ? ((totalCommissionsThisMonth - totalCommissionsLastMonth) / totalCommissionsLastMonth) * 100
        : 0;

    // Admin-only stats
    let pendingReconciliations = 0;
    let unresolvedAnomalies = 0;
    let activeAgents = 0;
    let recentImports: any[] = [];

    if (isAdmin) {
      const [reconResult] = await db
        .select({
          count: sql<number>`COUNT(*)`,
        })
        .from(commissionCarrierReconciliation)
        .where(
          and(
            eq(commissionCarrierReconciliation.tenantId, tenantId),
            sql`${commissionCarrierReconciliation.status} != 'matched'`
          )
        );
      pendingReconciliations = Number(reconResult?.count || 0);

      const [anomalyResult] = await db
        .select({
          count: sql<number>`COUNT(*)`,
        })
        .from(commissionAnomalies)
        .where(
          and(
            eq(commissionAnomalies.tenantId, tenantId),
            eq(commissionAnomalies.isResolved, false)
          )
        );
      unresolvedAnomalies = Number(anomalyResult?.count || 0);

      const [agentResult] = await db
        .select({
          count: sql<number>`COUNT(*)`,
        })
        .from(commissionAgents)
        .where(
          and(
            eq(commissionAgents.tenantId, tenantId),
            eq(commissionAgents.isActive, true)
          )
        );
      activeAgents = Number(agentResult?.count || 0);

      const rawBatches = await db
        .select()
        .from(commissionImportBatches)
        .where(eq(commissionImportBatches.tenantId, tenantId))
        .orderBy(desc(commissionImportBatches.createdAt))
        .limit(5);

      recentImports = rawBatches.map((b) => ({
        id: b.id,
        fileName: b.fileName,
        status: b.status,
        totalRows: b.totalRows || 0,
        importedRows: b.importedRows || 0,
        skippedRows: b.skippedRows || 0,
        errorRows: b.errorRows || 0,
        duplicateRows: b.duplicateRows || 0,
        createdAt: b.createdAt,
      }));
    }

    return NextResponse.json({
      success: true,
      data: {
        totalCommissionsThisMonth,
        totalCommissionsLastMonth,
        monthOverMonthChange: Math.round(monthOverMonthChange * 100) / 100,
        pendingReconciliations,
        unresolvedAnomalies,
        activeAgents,
        recentImports,
        currentMonth,
        lastMonth,
        isAdmin,
      },
    });
  } catch (error: unknown) {
    console.error("[Commission Dashboard] Error:", error);
    return NextResponse.json(
      { error: "Failed to load dashboard", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
