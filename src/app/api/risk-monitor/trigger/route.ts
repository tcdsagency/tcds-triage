// API Route: /api/risk-monitor/trigger
// Manually trigger a scheduler run
// GET - Called by Vercel cron (every 5 minutes)
// POST - Manual trigger with options

import { NextRequest, NextResponse } from "next/server";
import { createRiskMonitorScheduler } from "@/lib/riskMonitor/scheduler";
import { db } from "@/db";
import { riskMonitorSettings } from "@/db/schema";
import { eq } from "drizzle-orm";

export const maxDuration = 300; // 5 minute timeout for cron

// GET - Vercel cron trigger (runs within time window)
export async function GET(request: NextRequest) {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    // Create scheduler and run (respects time window)
    const scheduler = createRiskMonitorScheduler(tenantId);
    const result = await scheduler.run(false); // false = scheduled run

    // Log the result
    console.log(`[Risk Monitor Cron] Run complete:`, {
      success: result.success,
      propertiesChecked: result.propertiesChecked,
      alertsCreated: result.alertsCreated,
      errors: result.errors,
    });

    return NextResponse.json({
      success: result.success,
      result: {
        runId: result.runId,
        propertiesChecked: result.propertiesChecked,
        alertsCreated: result.alertsCreated,
        duration: result.duration,
        errors: result.errors,
      },
    });
  } catch (error: any) {
    console.error("[Risk Monitor Cron] Error:", error);
    return NextResponse.json(
      { error: "Cron trigger failed", details: error.message },
      { status: 500 }
    );
  }
}

// POST - Manually trigger scheduler run (with options)
export async function POST(request: NextRequest) {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    const body = await request.json().catch(() => ({}));
    const { ignoreWindow = false, maxProperties, forceRecheck = false } = body;

    // Create scheduler
    const scheduler = createRiskMonitorScheduler(tenantId);

    // If ignoreWindow is true, we need to temporarily enable the scheduler
    // and adjust the time window to allow immediate execution
    if (ignoreWindow) {
      // Get current hour in CST (scheduler uses CST)
      const now = new Date();
      const cstOffset = -6; // CST is UTC-6
      const utcHour = now.getUTCHours();
      const cstHour = (utcHour + cstOffset + 24) % 24;

      // Get or create settings
      const [existing] = await db
        .select()
        .from(riskMonitorSettings)
        .where(eq(riskMonitorSettings.tenantId, tenantId))
        .limit(1);

      if (existing) {
        // Temporarily set window to current CST hour
        await db
          .update(riskMonitorSettings)
          .set({
            isPaused: false,
            scheduleStartHour: cstHour,
            scheduleEndHour: (cstHour + 1) % 24,
            ...(maxProperties && { dailyRequestBudget: maxProperties }),
            ...(forceRecheck && { recheckDays: 0 }),
          })
          .where(eq(riskMonitorSettings.tenantId, tenantId));
      } else {
        // Create settings that allow immediate run
        await db.insert(riskMonitorSettings).values({
          tenantId,
          isPaused: false,
          scheduleStartHour: cstHour,
          scheduleEndHour: (cstHour + 1) % 24,
          dailyRequestBudget: maxProperties || 100,
          ...(forceRecheck && { recheckDays: 0 }),
        });
      }
    }

    // Run the scheduler (mark as manual trigger)
    const result = await scheduler.run(true);

    // If we modified settings, restore them
    if (ignoreWindow || forceRecheck) {
      await db
        .update(riskMonitorSettings)
        .set({
          scheduleStartHour: 21,
          scheduleEndHour: 4,
          ...(forceRecheck && { recheckDays: 7 }),
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
