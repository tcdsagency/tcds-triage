// API Route: /api/weather-alerts/settings
// Get and update weather alert settings

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { weatherAlertSettings } from "@/db/schema";
import { eq } from "drizzle-orm";

// GET - Get settings
export async function GET() {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    const [settings] = await db
      .select()
      .from(weatherAlertSettings)
      .where(eq(weatherAlertSettings.tenantId, tenantId))
      .limit(1);

    const twilioConfigured = Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN);

    if (!settings) {
      // Return defaults when no settings exist
      return NextResponse.json({
        success: true,
        settings: {
          isEnabled: false,
          pollIntervalMinutes: 15,
          enabledAlertTypes: [],
          minimumSeverity: 'Moderate',
          pdsOnly: false,
          radiusMiles: 25,
          smsEnabled: false,
          smsTemplate: 'WEATHER ALERT: {{event}} for {{location}}. {{headline}}. Stay safe!',
          staffPhoneNumbers: [],
          maxSmsPerDay: 50,
          smsSentToday: 0,
          lastPollAt: null,
          lastPollStatus: null,
          twilioConfigured,
        },
        isDefault: true,
      });
    }

    return NextResponse.json({
      success: true,
      settings: {
        id: settings.id,
        isEnabled: settings.isEnabled,
        pollIntervalMinutes: settings.pollIntervalMinutes,
        enabledAlertTypes: settings.enabledAlertTypes || [],
        minimumSeverity: settings.minimumSeverity,
        pdsOnly: settings.pdsOnly,
        radiusMiles: settings.radiusMiles,
        smsEnabled: settings.smsEnabled,
        smsTemplate: settings.smsTemplate,
        staffPhoneNumbers: settings.staffPhoneNumbers || [],
        maxSmsPerDay: settings.maxSmsPerDay,
        smsSentToday: settings.smsSentToday,
        lastPollAt: settings.lastPollAt,
        lastPollStatus: settings.lastPollStatus,
        lastPollError: settings.lastPollError,
        twilioConfigured,
      },
      isDefault: false,
    });
  } catch (error: any) {
    console.error("[Weather Alerts] Error getting settings:", error);
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

    const updateData: Partial<typeof weatherAlertSettings.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (body.isEnabled !== undefined) updateData.isEnabled = body.isEnabled;
    if (body.pollIntervalMinutes !== undefined) updateData.pollIntervalMinutes = body.pollIntervalMinutes;
    if (body.enabledAlertTypes !== undefined) updateData.enabledAlertTypes = body.enabledAlertTypes;
    if (body.minimumSeverity !== undefined) updateData.minimumSeverity = body.minimumSeverity;
    if (body.pdsOnly !== undefined) updateData.pdsOnly = body.pdsOnly;
    if (body.radiusMiles !== undefined) updateData.radiusMiles = body.radiusMiles;
    if (body.smsEnabled !== undefined) updateData.smsEnabled = body.smsEnabled;
    if (body.smsTemplate !== undefined) updateData.smsTemplate = body.smsTemplate;
    if (body.staffPhoneNumbers !== undefined) updateData.staffPhoneNumbers = body.staffPhoneNumbers;
    if (body.maxSmsPerDay !== undefined) updateData.maxSmsPerDay = body.maxSmsPerDay;

    // Check if record exists
    const [existing] = await db
      .select()
      .from(weatherAlertSettings)
      .where(eq(weatherAlertSettings.tenantId, tenantId))
      .limit(1);

    let settings;

    if (existing) {
      [settings] = await db
        .update(weatherAlertSettings)
        .set(updateData)
        .where(eq(weatherAlertSettings.tenantId, tenantId))
        .returning();
    } else {
      [settings] = await db
        .insert(weatherAlertSettings)
        .values({
          tenantId,
          ...updateData,
        })
        .returning();
    }

    return NextResponse.json({
      success: true,
      settings: {
        id: settings.id,
        isEnabled: settings.isEnabled,
        pollIntervalMinutes: settings.pollIntervalMinutes,
        enabledAlertTypes: settings.enabledAlertTypes || [],
        minimumSeverity: settings.minimumSeverity,
        pdsOnly: settings.pdsOnly,
        radiusMiles: settings.radiusMiles,
        smsEnabled: settings.smsEnabled,
        smsTemplate: settings.smsTemplate,
        staffPhoneNumbers: settings.staffPhoneNumbers || [],
        maxSmsPerDay: settings.maxSmsPerDay,
      },
    });
  } catch (error: any) {
    console.error("[Weather Alerts] Error updating settings:", error);
    return NextResponse.json(
      { error: "Failed to update settings", details: error.message },
      { status: 500 }
    );
  }
}
