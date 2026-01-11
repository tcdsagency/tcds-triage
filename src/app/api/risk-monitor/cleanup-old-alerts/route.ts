/**
 * API Route: /api/risk-monitor/cleanup-old-alerts
 * Dismisses sold alerts that don't meet the 12-month criteria.
 * These were incorrectly created before the filtering fix.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { riskMonitorAlerts, riskMonitorPolicies } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";

export async function POST(request: NextRequest) {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    const now = new Date();
    const twelveMonthsAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);

    // Find sold alerts that don't meet criteria
    const soldAlerts = await db
      .select({
        alertId: riskMonitorAlerts.id,
        policyId: riskMonitorAlerts.policyId,
        title: riskMonitorAlerts.title,
        salePrice: riskMonitorAlerts.salePrice,
        rawData: riskMonitorAlerts.rawData,
        customerSinceDate: riskMonitorPolicies.customerSinceDate,
        lastSaleDate: riskMonitorPolicies.lastSaleDate,
      })
      .from(riskMonitorAlerts)
      .innerJoin(riskMonitorPolicies, eq(riskMonitorAlerts.policyId, riskMonitorPolicies.id))
      .where(
        and(
          eq(riskMonitorAlerts.tenantId, tenantId),
          eq(riskMonitorAlerts.alertType, "sold"),
          eq(riskMonitorAlerts.status, "new")
        )
      );

    let dismissed = 0;
    let kept = 0;
    const dismissedAlerts: string[] = [];

    for (const alert of soldAlerts) {
      // Extract sale date from raw data or policy
      let saleDate: Date | null = null;
      const rawData = alert.rawData as Record<string, any>;

      // Check MMI data for sale date
      const mmiLastSale = rawData?.mmi?.lastSaleDate;
      const mmiListingSold = rawData?.mmi?.listingHistory?.[0]?.SOLD_DATE;

      if (mmiListingSold) {
        saleDate = new Date(mmiListingSold);
      } else if (mmiLastSale) {
        saleDate = new Date(mmiLastSale);
      } else if (alert.lastSaleDate) {
        saleDate = alert.lastSaleDate;
      }

      // Check if sale is within 12 months
      const saleWithin12Months = saleDate && saleDate > twelveMonthsAgo;

      // Check if customer tenure is 12+ months
      const customerTenure12Plus = alert.customerSinceDate && alert.customerSinceDate < twelveMonthsAgo;

      // Dismiss if doesn't meet BOTH criteria
      if (!saleWithin12Months || !customerTenure12Plus) {
        await db
          .update(riskMonitorAlerts)
          .set({
            status: "dismissed",
            resolution: "Auto-dismissed: Did not meet 12-month criteria",
            resolutionType: "system_cleanup",
            resolvedAt: new Date(),
          })
          .where(eq(riskMonitorAlerts.id, alert.alertId));

        dismissed++;
        dismissedAlerts.push(`${alert.title} (sale: ${saleDate?.toISOString()?.split('T')[0] || 'unknown'}, tenure: ${alert.customerSinceDate ? 'yes' : 'no'})`);
      } else {
        kept++;
      }
    }

    return NextResponse.json({
      success: true,
      stats: {
        totalSoldAlerts: soldAlerts.length,
        dismissed,
        kept,
      },
      dismissedAlerts: dismissedAlerts.slice(0, 20),
    });
  } catch (error: any) {
    console.error("[Cleanup] Error:", error);
    return NextResponse.json(
      { error: "Cleanup failed", details: error.message },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    // Count sold alerts by status
    const stats = await db
      .select({
        status: riskMonitorAlerts.status,
        count: sql<number>`count(*)::int`,
      })
      .from(riskMonitorAlerts)
      .where(
        and(
          eq(riskMonitorAlerts.tenantId, tenantId),
          eq(riskMonitorAlerts.alertType, "sold")
        )
      )
      .groupBy(riskMonitorAlerts.status);

    return NextResponse.json({
      success: true,
      soldAlertsByStatus: stats,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Status check failed", details: error.message },
      { status: 500 }
    );
  }
}
