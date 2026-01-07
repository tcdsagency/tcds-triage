// API Route: /api/risk-monitor/trigger
// Manually trigger a scheduler run

import { NextRequest, NextResponse } from "next/server";
import { createRiskMonitorScheduler } from "@/lib/riskMonitor/scheduler";
import { db } from "@/db";
import { riskMonitorSettings } from "@/db/schema";
import { eq } from "drizzle-orm";

// POST - Manually trigger scheduler run
export async function POST(request: NextRequest) {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    const body = await request.json().catch(() => ({}));
    const { ignoreWindow = false, maxProperties } = body;

    // Create scheduler
    const scheduler = createRiskMonitorScheduler(tenantId);

    // If ignoreWindow is true, we need to temporarily enable the scheduler
    // and adjust the time window to allow immediate execution
    if (ignoreWindow) {
      // Get or create settings
      const [existing] = await db
        .select()
        .from(riskMonitorSettings)
        .where(eq(riskMonitorSettings.tenantId, tenantId))
        .limit(1);

      if (existing) {
        // Temporarily set window to current hour
        const currentHour = new Date().getHours();
        await db
          .update(riskMonitorSettings)
          .set({
            isPaused: false,
            scheduleStartHour: currentHour,
            scheduleEndHour: (currentHour + 1) % 24,
            ...(maxProperties && { dailyRequestBudget: maxProperties }),
          })
          .where(eq(riskMonitorSettings.tenantId, tenantId));
      } else {
        // Create settings that allow immediate run
        const currentHour = new Date().getHours();
        await db.insert(riskMonitorSettings).values({
          tenantId,
          isPaused: false,
          scheduleStartHour: currentHour,
          scheduleEndHour: (currentHour + 1) % 24,
          dailyRequestBudget: maxProperties || 100,
        });
      }
    }

    // Run the scheduler
    const result = await scheduler.run();

    // If we modified settings, restore them
    if (ignoreWindow) {
      await db
        .update(riskMonitorSettings)
        .set({
          scheduleStartHour: 21,
          scheduleEndHour: 4,
        })
        .where(eq(riskMonitorSettings.tenantId, tenantId));
    }

    if (!result.success && result.errors.length > 0) {
      // Check if it's just a non-critical error
      const isNonCritical = result.errors.some(
        (e) =>
          e.includes("disabled") ||
          e.includes("window") ||
          e.includes("already running")
      );

      if (isNonCritical) {
        return NextResponse.json({
          success: false,
          message: result.errors[0],
          result,
        });
      }
    }

    return NextResponse.json({
      success: true,
      result: {
        runId: result.runId,
        propertiesChecked: result.propertiesChecked,
        alertsCreated: result.alertsCreated,
        duration: result.duration,
        errors: result.errors,
      },
    });
  } catch (error: any) {
    console.error("[Risk Monitor] Error triggering scheduler:", error);
    return NextResponse.json(
      { error: "Failed to trigger scheduler", details: error.message },
      { status: 500 }
    );
  }
}
