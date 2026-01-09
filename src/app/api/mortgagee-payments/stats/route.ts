import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import {
  mortgagees,
  mortgageePaymentChecks,
  mortgageePaymentActivityLog,
} from "@/db/schema";
import { eq, and, sql, desc, gte } from "drizzle-orm";

/**
 * GET /api/mortgagee-payments/stats
 * Get dashboard statistics
 */
export async function GET(request: NextRequest) {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json(
        { error: "Tenant not configured" },
        { status: 500 }
      );
    }

    // Get counts by payment status
    const statusCounts = await db
      .select({
        status: mortgagees.currentPaymentStatus,
        count: sql<number>`count(*)::int`,
      })
      .from(mortgagees)
      .where(
        and(eq(mortgagees.tenantId, tenantId), eq(mortgagees.isActive, true))
      )
      .groupBy(mortgagees.currentPaymentStatus);

    // Total mortgagees
    const [{ totalMortgagees }] = await db
      .select({ totalMortgagees: sql<number>`count(*)::int` })
      .from(mortgagees)
      .where(
        and(eq(mortgagees.tenantId, tenantId), eq(mortgagees.isActive, true))
      );

    // Checks in last 24 hours
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [{ checksLast24h }] = await db
      .select({ checksLast24h: sql<number>`count(*)::int` })
      .from(mortgageePaymentChecks)
      .where(
        and(
          eq(mortgageePaymentChecks.tenantId, tenantId),
          gte(mortgageePaymentChecks.createdAt, oneDayAgo)
        )
      );

    // Checks in last 7 days
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const [{ checksLast7d }] = await db
      .select({ checksLast7d: sql<number>`count(*)::int` })
      .from(mortgageePaymentChecks)
      .where(
        and(
          eq(mortgageePaymentChecks.tenantId, tenantId),
          gte(mortgageePaymentChecks.createdAt, sevenDaysAgo)
        )
      );

    // Success rate (last 7 days)
    const [successStats] = await db
      .select({
        total: sql<number>`count(*)::int`,
        successful: sql<number>`count(*) filter (where status = 'completed')::int`,
      })
      .from(mortgageePaymentChecks)
      .where(
        and(
          eq(mortgageePaymentChecks.tenantId, tenantId),
          gte(mortgageePaymentChecks.createdAt, sevenDaysAgo)
        )
      );

    const successRate =
      successStats.total > 0
        ? ((successStats.successful / successStats.total) * 100).toFixed(1)
        : "N/A";

    // Last scheduler run
    const [lastRun] = await db
      .select()
      .from(mortgageePaymentActivityLog)
      .where(eq(mortgageePaymentActivityLog.tenantId, tenantId))
      .orderBy(desc(mortgageePaymentActivityLog.startedAt))
      .limit(1);

    // Mortgagees needing check (not checked in recheckDays)
    const recheckDays = 7;
    const recheckCutoff = new Date(
      Date.now() - recheckDays * 24 * 60 * 60 * 1000
    );
    const [{ needsCheck }] = await db
      .select({ needsCheck: sql<number>`count(*)::int` })
      .from(mortgagees)
      .where(
        and(
          eq(mortgagees.tenantId, tenantId),
          eq(mortgagees.isActive, true),
          sql`(${mortgagees.lastPaymentCheckAt} IS NULL OR ${mortgagees.lastPaymentCheckAt} < ${recheckCutoff})`
        )
      );

    return NextResponse.json({
      success: true,
      stats: {
        totalMortgagees,
        byStatus: Object.fromEntries(
          statusCounts.map((r) => [r.status || "unknown", r.count])
        ),
        checksLast24h,
        checksLast7d,
        successRate: `${successRate}%`,
        needsCheck,
        lastRun: lastRun
          ? {
              id: lastRun.id,
              status: lastRun.status,
              startedAt: lastRun.startedAt,
              completedAt: lastRun.completedAt,
              policiesChecked: lastRun.policiesChecked,
              latePaymentsFound: lastRun.latePaymentsFound,
              lapsedFound: lastRun.lapsedFound,
              errorsEncountered: lastRun.errorsEncountered,
            }
          : null,
      },
    });
  } catch (error: any) {
    console.error("[Mortgagee Payments] Stats error:", error);
    return NextResponse.json(
      { error: "Failed to fetch stats", details: error.message },
      { status: 500 }
    );
  }
}
