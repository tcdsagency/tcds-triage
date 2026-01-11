/**
 * API Route: /api/risk-monitor/cleanup-false-positives
 * Dismisses alerts where MMI shows off_market/sold but RPR mock data triggered an alert.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { riskMonitorAlerts } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export async function POST(request: NextRequest) {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    // Find alerts where MMI shows off_market or sold but alert was triggered
    const alerts = await db
      .select()
      .from(riskMonitorAlerts)
      .where(
        and(
          eq(riskMonitorAlerts.tenantId, tenantId),
          eq(riskMonitorAlerts.status, "new")
        )
      );

    let dismissed = 0;
    let kept = 0;
    const dismissedAlerts: string[] = [];

    for (const alert of alerts) {
      const rawData = alert.rawData as Record<string, any>;
      const mmiStatus = rawData?.mmi?.currentStatus?.toLowerCase();
      const rprStatus = rawData?.rpr?.currentStatus?.toLowerCase();

      // Check if this is a false positive:
      // - MMI shows off_market or sold (real data)
      // - RPR shows active or pending (likely mock data)
      // - No MMI listing history to support the alert
      const mmiListingHistory = rawData?.mmi?.listingHistory;
      const hasMMIListingHistory = mmiListingHistory && mmiListingHistory.length > 0;

      const isFalsePositive =
        (mmiStatus === "off_market" || mmiStatus === "sold" || mmiStatus === "off-market") &&
        (rprStatus === "active" || rprStatus === "pending") &&
        !hasMMIListingHistory;

      if (isFalsePositive) {
        await db
          .update(riskMonitorAlerts)
          .set({
            status: "dismissed",
            resolution: `False positive - MMI shows ${mmiStatus} but RPR mock data showed ${rprStatus}`,
            resolutionType: "false_positive",
            resolvedAt: new Date(),
          })
          .where(eq(riskMonitorAlerts.id, alert.id));

        dismissed++;
        dismissedAlerts.push(`${alert.title} (MMI: ${mmiStatus}, RPR: ${rprStatus})`);
      } else {
        kept++;
      }
    }

    return NextResponse.json({
      success: true,
      stats: {
        totalNewAlerts: alerts.length,
        dismissed,
        kept,
      },
      dismissedAlerts,
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

    const alerts = await db
      .select()
      .from(riskMonitorAlerts)
      .where(
        and(
          eq(riskMonitorAlerts.tenantId, tenantId),
          eq(riskMonitorAlerts.status, "new")
        )
      );

    let falsePositives = 0;
    let legitimate = 0;
    const preview: Array<{ title: string; mmiStatus: string; rprStatus: string; hasHistory: boolean }> = [];

    for (const alert of alerts) {
      const rawData = alert.rawData as Record<string, any>;
      const mmiStatus = rawData?.mmi?.currentStatus?.toLowerCase() || "unknown";
      const rprStatus = rawData?.rpr?.currentStatus?.toLowerCase() || "unknown";
      const hasMMIListingHistory = rawData?.mmi?.listingHistory?.length > 0;

      const isFalsePositive =
        (mmiStatus === "off_market" || mmiStatus === "sold" || mmiStatus === "off-market") &&
        (rprStatus === "active" || rprStatus === "pending") &&
        !hasMMIListingHistory;

      if (isFalsePositive) {
        falsePositives++;
        preview.push({ title: alert.title, mmiStatus, rprStatus, hasHistory: hasMMIListingHistory });
      } else {
        legitimate++;
      }
    }

    return NextResponse.json({
      success: true,
      stats: {
        totalNewAlerts: alerts.length,
        falsePositives,
        legitimate,
      },
      preview: preview.slice(0, 10),
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Status check failed", details: error.message },
      { status: 500 }
    );
  }
}
