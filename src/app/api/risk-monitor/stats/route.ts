// API Route: /api/risk-monitor/stats
// Dashboard statistics for risk monitor

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import {
  riskMonitorPolicies,
  riskMonitorAlerts,
  riskMonitorActivityLog,
  riskMonitorSettings,
} from "@/db/schema";
import { eq, and, desc, sql, gte, or, lt, isNull } from "drizzle-orm";

// GET - Get dashboard statistics
export async function GET(request: NextRequest) {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    // Get policy counts by status
    const policyCounts = await db
      .select({
        status: riskMonitorPolicies.currentStatus,
        count: sql<number>`count(*)::int`,
      })
      .from(riskMonitorPolicies)
      .where(
        and(
          eq(riskMonitorPolicies.tenantId, tenantId),
          eq(riskMonitorPolicies.isActive, true)
        )
      )
      .groupBy(riskMonitorPolicies.currentStatus);

    // Get alert counts by status
    const alertCounts = await db
      .select({
        status: riskMonitorAlerts.status,
        count: sql<number>`count(*)::int`,
      })
      .from(riskMonitorAlerts)
      .where(eq(riskMonitorAlerts.tenantId, tenantId))
      .groupBy(riskMonitorAlerts.status);

    // Get alert counts by type
    const alertTypeCounts = await db
      .select({
        type: riskMonitorAlerts.alertType,
        count: sql<number>`count(*)::int`,
      })
      .from(riskMonitorAlerts)
      .where(eq(riskMonitorAlerts.tenantId, tenantId))
      .groupBy(riskMonitorAlerts.alertType);

    // Get total policies
    const [{ totalPolicies }] = await db
      .select({ totalPolicies: sql<number>`count(*)::int` })
      .from(riskMonitorPolicies)
      .where(
        and(
          eq(riskMonitorPolicies.tenantId, tenantId),
          eq(riskMonitorPolicies.isActive, true)
        )
      );

    // Get unresolved alerts count
    const [{ unresolvedAlerts }] = await db
      .select({ unresolvedAlerts: sql<number>`count(*)::int` })
      .from(riskMonitorAlerts)
      .where(
        and(
          eq(riskMonitorAlerts.tenantId, tenantId),
          sql`${riskMonitorAlerts.status} NOT IN ('resolved', 'dismissed')`
        )
      );

    // Get recent alerts (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentAlerts = await db
      .select()
      .from(riskMonitorAlerts)
      .where(
        and(
          eq(riskMonitorAlerts.tenantId, tenantId),
          gte(riskMonitorAlerts.createdAt, sevenDaysAgo)
        )
      )
      .orderBy(desc(riskMonitorAlerts.createdAt))
      .limit(5);

    // Get last run info
    const [lastRun] = await db
      .select()
      .from(riskMonitorActivityLog)
      .where(eq(riskMonitorActivityLog.tenantId, tenantId))
      .orderBy(desc(riskMonitorActivityLog.startedAt))
      .limit(1);

    // Get settings for next run info
    const [settings] = await db
      .select()
      .from(riskMonitorSettings)
      .where(eq(riskMonitorSettings.tenantId, tenantId))
      .limit(1);

    // Calculate properties needing check
    const checkIntervalDays = settings?.recheckDays ?? 3;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - checkIntervalDays);

    const [{ needsCheck }] = await db
      .select({ needsCheck: sql<number>`count(*)::int` })
      .from(riskMonitorPolicies)
      .where(
        and(
          eq(riskMonitorPolicies.tenantId, tenantId),
          eq(riskMonitorPolicies.isActive, true),
          or(
            isNull(riskMonitorPolicies.lastCheckedAt),
            lt(riskMonitorPolicies.lastCheckedAt, cutoffDate)
          )
        )
      );

    return NextResponse.json({
      success: true,
      stats: {
        policies: {
          total: totalPolicies,
          byStatus: policyCounts.reduce(
            (acc, r) => {
              if (r.status) acc[r.status] = r.count;
              return acc;
            },
            {} as Record<string, number>
          ),
          needsCheck,
        },
        alerts: {
          unresolved: unresolvedAlerts,
          byStatus: alertCounts.reduce(
            (acc, r) => {
              acc[r.status] = r.count;
              return acc;
            },
            {} as Record<string, number>
          ),
          byType: alertTypeCounts.reduce(
            (acc, r) => {
              acc[r.type] = r.count;
              return acc;
            },
            {} as Record<string, number>
          ),
          recent: recentAlerts,
        },
        scheduler: {
          enabled: settings ? !settings.isPaused : false,
          lastRunAt: settings?.lastSchedulerRunAt ?? null,
          lastRunStatus: lastRun?.status ?? null,
          lastRunPropertiesChecked: lastRun?.policiesChecked ?? 0,
          lastRunAlertsCreated: lastRun?.alertsCreated ?? 0,
        },
        budget: {
          dailyBudget: settings?.dailyRequestBudget ?? 100,
          requestsToday: settings?.requestsToday ?? 0,
        },
      },
    });
  } catch (error: any) {
    console.error("[Risk Monitor] Error getting stats:", error);
    return NextResponse.json(
      { error: "Failed to get stats", details: error.message },
      { status: 500 }
    );
  }
}
