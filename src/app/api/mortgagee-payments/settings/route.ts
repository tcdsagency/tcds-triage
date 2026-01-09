import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { mortgageePaymentSettings } from "@/db/schema";
import { eq } from "drizzle-orm";

/**
 * GET /api/mortgagee-payments/settings
 * Get scheduler settings
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

    const [settings] = await db
      .select()
      .from(mortgageePaymentSettings)
      .where(eq(mortgageePaymentSettings.tenantId, tenantId))
      .limit(1);

    if (!settings) {
      // Return default settings
      return NextResponse.json({
        success: true,
        settings: {
          isPaused: false,
          scheduleStartHour: 22,
          scheduleEndHour: 5,
          dailyCheckBudget: 200,
          recheckDays: 7,
          delayBetweenChecksMs: 30000,
          alertOnLatePayment: true,
          alertOnLapsed: true,
          emailNotificationsEnabled: false,
          emailRecipients: [],
          microserviceUrl: null,
          twoCaptchaBalance: null,
        },
      });
    }

    return NextResponse.json({
      success: true,
      settings: {
        ...settings,
        // Hide sensitive API keys
        microserviceApiKey: settings.microserviceApiKey ? "***configured***" : null,
        twoCaptchaApiKey: settings.twoCaptchaApiKey ? "***configured***" : null,
      },
    });
  } catch (error: any) {
    console.error("[Mortgagee Payments] Settings GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch settings", details: error.message },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/mortgagee-payments/settings
 * Update scheduler settings
 */
export async function PUT(request: NextRequest) {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json(
        { error: "Tenant not configured" },
        { status: 500 }
      );
    }

    const body = await request.json();

    // Check if settings exist
    const [existing] = await db
      .select()
      .from(mortgageePaymentSettings)
      .where(eq(mortgageePaymentSettings.tenantId, tenantId))
      .limit(1);

    // Build update data (only include fields that are provided)
    const updateData: Record<string, any> = {
      updatedAt: new Date(),
    };

    const allowedFields = [
      "isPaused",
      "pauseReason",
      "scheduleStartHour",
      "scheduleEndHour",
      "dailyCheckBudget",
      "recheckDays",
      "delayBetweenChecksMs",
      "microserviceUrl",
      "microserviceApiKey",
      "twoCaptchaApiKey",
      "alertOnLatePayment",
      "alertOnLapsed",
      "emailNotificationsEnabled",
      "emailRecipients",
    ];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    // Handle pause status
    if (body.isPaused !== undefined && body.isPaused !== existing?.isPaused) {
      updateData.pausedAt = body.isPaused ? new Date() : null;
    }

    let settings;
    if (existing) {
      [settings] = await db
        .update(mortgageePaymentSettings)
        .set(updateData)
        .where(eq(mortgageePaymentSettings.id, existing.id))
        .returning();
    } else {
      [settings] = await db
        .insert(mortgageePaymentSettings)
        .values({
          tenantId,
          ...updateData,
        })
        .returning();
    }

    return NextResponse.json({
      success: true,
      settings: {
        ...settings,
        microserviceApiKey: settings.microserviceApiKey ? "***configured***" : null,
        twoCaptchaApiKey: settings.twoCaptchaApiKey ? "***configured***" : null,
      },
    });
  } catch (error: any) {
    console.error("[Mortgagee Payments] Settings PUT error:", error);
    return NextResponse.json(
      { error: "Failed to update settings", details: error.message },
      { status: 500 }
    );
  }
}
