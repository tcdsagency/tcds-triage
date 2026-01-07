import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { tenants } from "@/db/schema";
import { eq } from "drizzle-orm";

// =============================================================================
// GET /api/review-requests/settings - Get review request settings
// =============================================================================
export async function GET(request: NextRequest) {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID || "00000000-0000-0000-0000-000000000001";

    const [tenant] = await db
      .select({
        features: tenants.features,
        integrations: tenants.integrations,
      })
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);

    if (!tenant) {
      return NextResponse.json(
        { success: false, error: "Tenant not found" },
        { status: 404 }
      );
    }

    const features = tenant.features as any || {};
    const integrations = tenant.integrations as any || {};

    return NextResponse.json({
      success: true,
      settings: {
        autoSendEnabled: features.reviewAutoSend !== false, // Default true
        googleReviewLink: integrations.googleReviewLink || "",
      },
    });
  } catch (error) {
    console.error("Error fetching review settings:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch settings" },
      { status: 500 }
    );
  }
}

// =============================================================================
// PUT /api/review-requests/settings - Update review request settings
// =============================================================================
export async function PUT(request: NextRequest) {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID || "00000000-0000-0000-0000-000000000001";
    const body = await request.json();
    const { autoSendEnabled, googleReviewLink } = body;

    // Get current tenant data
    const [tenant] = await db
      .select({
        features: tenants.features,
        integrations: tenants.integrations,
      })
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);

    if (!tenant) {
      return NextResponse.json(
        { success: false, error: "Tenant not found" },
        { status: 404 }
      );
    }

    const currentFeatures = (tenant.features as any) || {};
    const currentIntegrations = (tenant.integrations as any) || {};

    // Update features if autoSendEnabled is provided
    const updatedFeatures = {
      ...currentFeatures,
      ...(autoSendEnabled !== undefined && { reviewAutoSend: autoSendEnabled }),
    };

    // Update integrations if googleReviewLink is provided
    const updatedIntegrations = {
      ...currentIntegrations,
      ...(googleReviewLink !== undefined && { googleReviewLink }),
    };

    // Save updates
    await db
      .update(tenants)
      .set({
        features: updatedFeatures,
        integrations: updatedIntegrations,
        updatedAt: new Date(),
      })
      .where(eq(tenants.id, tenantId));

    return NextResponse.json({
      success: true,
      settings: {
        autoSendEnabled: updatedFeatures.reviewAutoSend !== false,
        googleReviewLink: updatedIntegrations.googleReviewLink || "",
      },
    });
  } catch (error) {
    console.error("Error updating review settings:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update settings" },
      { status: 500 }
    );
  }
}
