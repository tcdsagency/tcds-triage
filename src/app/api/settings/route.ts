// API Route: /api/settings
// Agency Settings Management

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { tenants } from "@/db/schema";
import { eq } from "drizzle-orm";

// =============================================================================
// TYPES
// =============================================================================

interface AfterHoursSettings {
  enabled: boolean;
  timezone: string;
  businessHours: Record<string, { open: string; close: string; closed: boolean }>;
  autoReplyMessage: string;
  cooldownHours: number;
  holidaysEnabled: boolean;
}

interface SettingsUpdate {
  agency?: {
    name?: string;
    phone?: string;
    email?: string;
    website?: string;
    address?: {
      street: string;
      city: string;
      state: string;
      zip: string;
    };
  };
  afterHours?: AfterHoursSettings;
}

// =============================================================================
// GET - Fetch Current Settings
// =============================================================================

export async function GET() {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID;

    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    const [tenant] = await db
      .select({
        id: tenants.id,
        name: tenants.name,
        phone: tenants.phone,
        email: tenants.email,
        website: tenants.website,
        address: tenants.address,
        timezone: tenants.timezone,
        businessHours: tenants.businessHours,
        features: tenants.features,
        integrations: tenants.integrations,
      })
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    // Parse and return settings
    return NextResponse.json({
      success: true,
      settings: {
        agency: {
          name: tenant.name,
          phone: tenant.phone,
          email: tenant.email,
          website: tenant.website,
          address: tenant.address,
        },
        afterHours: {
          enabled: (tenant.features as any)?.afterHoursAutoReply ?? true,
          timezone: tenant.timezone || "America/Chicago",
          businessHours: tenant.businessHours || {
            monday: { open: "08:00", close: "17:00", closed: false },
            tuesday: { open: "08:00", close: "17:00", closed: false },
            wednesday: { open: "08:00", close: "17:00", closed: false },
            thursday: { open: "08:00", close: "17:00", closed: false },
            friday: { open: "08:00", close: "17:00", closed: false },
            saturday: { open: "", close: "", closed: true },
            sunday: { open: "", close: "", closed: true },
          },
          autoReplyMessage: (tenant.features as any)?.afterHoursMessage ||
            "Thank you for contacting us. We're currently closed but will return your call during business hours.",
          cooldownHours: (tenant.features as any)?.afterHoursCooldown ?? 4,
          holidaysEnabled: (tenant.features as any)?.afterHoursHolidays ?? true,
        },
      },
    });
  } catch (error) {
    console.error("Settings fetch error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Fetch failed" },
      { status: 500 }
    );
  }
}

// =============================================================================
// PUT - Update Settings
// =============================================================================

export async function PUT(request: NextRequest) {
  try {
    const body: SettingsUpdate = await request.json();
    const tenantId = process.env.DEFAULT_TENANT_ID;

    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    // Get current tenant data
    const [currentTenant] = await db
      .select({
        features: tenants.features,
      })
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);

    if (!currentTenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    // Build update object
    const updateData: Record<string, any> = {
      updatedAt: new Date(),
    };

    // Update agency info if provided
    if (body.agency) {
      if (body.agency.name) updateData.name = body.agency.name;
      if (body.agency.phone) updateData.phone = body.agency.phone;
      if (body.agency.email) updateData.email = body.agency.email;
      if (body.agency.website) updateData.website = body.agency.website;
      if (body.agency.address) updateData.address = body.agency.address;
    }

    // Update after-hours settings if provided
    if (body.afterHours) {
      updateData.timezone = body.afterHours.timezone;
      updateData.businessHours = body.afterHours.businessHours;

      // Merge with existing features
      const existingFeatures = (currentTenant.features as Record<string, any>) || {};
      updateData.features = {
        ...existingFeatures,
        afterHoursAutoReply: body.afterHours.enabled,
        afterHoursMessage: body.afterHours.autoReplyMessage,
        afterHoursCooldown: body.afterHours.cooldownHours,
        afterHoursHolidays: body.afterHours.holidaysEnabled,
      };
    }

    // Update tenant
    await db
      .update(tenants)
      .set(updateData)
      .where(eq(tenants.id, tenantId));

    return NextResponse.json({
      success: true,
      message: "Settings updated successfully",
    });
  } catch (error) {
    console.error("Settings update error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Update failed" },
      { status: 500 }
    );
  }
}
