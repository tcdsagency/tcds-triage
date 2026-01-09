// API Route: /api/risk-monitor/settings
// Get and update risk monitor settings

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { riskMonitorSettings } from "@/db/schema";
import { eq } from "drizzle-orm";

// GET - Get settings
export async function GET(request: NextRequest) {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    const [settings] = await db
      .select()
      .from(riskMonitorSettings)
      .where(eq(riskMonitorSettings.tenantId, tenantId))
      .limit(1);

    // Check credential configuration - using token service now
    const credentialStatus = {
      rprConfigured: Boolean(process.env.TOKEN_SERVICE_URL),
      mmiConfigured: Boolean(process.env.TOKEN_SERVICE_URL),
    };

    if (!settings) {
      // Return defaults when no settings exist
      return NextResponse.json({
        success: true,
        settings: {
          schedulerEnabled: true,
          checkIntervalDays: 3,
          windowStartHour: 21,
          windowEndHour: 4,
          maxPropertiesPerRun: 100,
          delayBetweenChecksMs: 5000,
          emailAlertsEnabled: true,
          alertEmailAddresses: [],
          ...credentialStatus,
        },
        isDefault: true,
      });
    }

    // Map from schema column names to API response
    return NextResponse.json({
      success: true,
      settings: {
        id: settings.id,
        schedulerEnabled: !settings.isPaused,
        checkIntervalDays: settings.recheckDays,
        windowStartHour: settings.scheduleStartHour,
        windowEndHour: settings.scheduleEndHour,
        maxPropertiesPerRun: settings.dailyRequestBudget,
        delayBetweenChecksMs: settings.delayBetweenCallsMs,
        emailAlertsEnabled: settings.emailNotificationsEnabled,
        alertEmailAddresses: settings.emailRecipients || [],
        lastRunAt: settings.lastSchedulerRunAt,
        requestsToday: settings.requestsToday,
        ...credentialStatus,
      },
      isDefault: false,
    });
  } catch (error: any) {
    console.error("[Risk Monitor] Error getting settings:", error);
    return NextResponse.json(
      { error: "Failed to get settings", details: error.message },
      { status: 500 }
    );
  }
}

// PUT - Update settings
export async function PUT(request: NextRequest) {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    const body = await request.json();

    // Build update data - map from API names to schema column names
    const updateData: Partial<typeof riskMonitorSettings.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (body.schedulerEnabled !== undefined) {
      updateData.isPaused = !body.schedulerEnabled;
      if (body.schedulerEnabled) {
        updateData.pausedAt = null;
        updateData.pauseReason = null;
      } else {
        updateData.pausedAt = new Date();
      }
    }

    if (body.checkIntervalDays !== undefined) {
      updateData.recheckDays = body.checkIntervalDays;
    }

    if (body.windowStartHour !== undefined) {
      updateData.scheduleStartHour = body.windowStartHour;
    }

    if (body.windowEndHour !== undefined) {
      updateData.scheduleEndHour = body.windowEndHour;
    }

    if (body.maxPropertiesPerRun !== undefined) {
      updateData.dailyRequestBudget = body.maxPropertiesPerRun;
    }

    if (body.delayBetweenChecksMs !== undefined) {
      updateData.delayBetweenCallsMs = body.delayBetweenChecksMs;
    }

    if (body.emailAlertsEnabled !== undefined) {
      updateData.emailNotificationsEnabled = body.emailAlertsEnabled;
    }

    if (body.alertEmailAddresses !== undefined) {
      updateData.emailRecipients = body.alertEmailAddresses;
    }

    // Check if record exists
    const [existing] = await db
      .select()
      .from(riskMonitorSettings)
      .where(eq(riskMonitorSettings.tenantId, tenantId))
      .limit(1);

    let settings;

    if (existing) {
      // Update existing
      [settings] = await db
        .update(riskMonitorSettings)
        .set(updateData)
        .where(eq(riskMonitorSettings.tenantId, tenantId))
        .returning();
    } else {
      // Create new with defaults
      [settings] = await db
        .insert(riskMonitorSettings)
        .values({
          tenantId,
          isPaused: false,
          scheduleStartHour: 21,
          scheduleEndHour: 4,
          recheckDays: 3,
          dailyRequestBudget: 100,
          delayBetweenCallsMs: 5000,
          emailNotificationsEnabled: true,
          ...updateData,
        })
        .returning();
    }

    return NextResponse.json({
      success: true,
      settings: {
        id: settings.id,
        schedulerEnabled: !settings.isPaused,
        checkIntervalDays: settings.recheckDays,
        windowStartHour: settings.scheduleStartHour,
        windowEndHour: settings.scheduleEndHour,
        maxPropertiesPerRun: settings.dailyRequestBudget,
        delayBetweenChecksMs: settings.delayBetweenCallsMs,
        emailAlertsEnabled: settings.emailNotificationsEnabled,
        alertEmailAddresses: settings.emailRecipients || [],
      },
    });
  } catch (error: any) {
    console.error("[Risk Monitor] Error updating settings:", error);
    return NextResponse.json(
      { error: "Failed to update settings", details: error.message },
      { status: 500 }
    );
  }
}
