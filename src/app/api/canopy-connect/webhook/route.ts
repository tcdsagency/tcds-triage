/**
 * Canopy Connect Webhook
 * ======================
 * Receives completed pull notifications from Canopy Connect.
 *
 * Configure this webhook URL in Canopy Connect dashboard:
 * https://tcds-triage.vercel.app/api/canopy-connect/webhook
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { canopyConnectPulls } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getCanopyClient } from "@/lib/api/canopy";

// =============================================================================
// POST - Webhook Handler
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      console.error("[Canopy Webhook] No tenant configured");
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    // Parse webhook payload
    const body = await request.json();
    console.log("[Canopy Webhook] Received:", JSON.stringify(body).substring(0, 500));

    // Canopy sends different event types
    const eventType = body.event_type || body.type || "pull.completed";
    const pullId = body.pull_id || body.pullId || body.data?.pull_id;

    if (!pullId) {
      console.error("[Canopy Webhook] No pull_id in payload");
      return NextResponse.json({ error: "Missing pull_id" }, { status: 400 });
    }

    console.log(`[Canopy Webhook] Event: ${eventType}, Pull ID: ${pullId}`);

    // Check if we already have this pull
    const [existing] = await db
      .select()
      .from(canopyConnectPulls)
      .where(eq(canopyConnectPulls.pullId, pullId))
      .limit(1);

    // Fetch full pull data from Canopy API
    let client;
    let pullData;
    try {
      client = getCanopyClient();
      pullData = await client.getPull(pullId);
      console.log(`[Canopy Webhook] Fetched pull data for ${pullId}`);
    } catch (error) {
      console.error("[Canopy Webhook] Failed to fetch pull data:", error);
      // Continue with webhook data if API fetch fails
      pullData = body.data || body;
    }

    // Extract data from pull
    const firstName = pullData.first_name || pullData.firstName || body.first_name || "";
    const lastName = pullData.last_name || pullData.lastName || body.last_name || "";
    const email = pullData.email || body.email || "";
    const phone = pullData.phone || body.phone || "";
    const dateOfBirth = pullData.date_of_birth || pullData.dateOfBirth || null;
    const address = pullData.address || null;
    const pullStatus = pullData.status || "COMPLETED";
    const carrierName = pullData.carrier?.name || pullData.carrier_name || null;
    const carrierFriendlyName = pullData.carrier?.friendly_name || pullData.carrier_friendly_name || carrierName;

    // Extract policies, vehicles, drivers
    const policies = pullData.policies || [];
    const vehicles = pullData.vehicles || [];
    const drivers = pullData.drivers || [];
    const dwellings = pullData.dwellings || [];
    const coverages = pullData.coverages || [];
    const claims = pullData.claims || [];
    const documents = pullData.documents || [];

    // Calculate totals
    const totalPremiumCents = policies.reduce((sum: number, p: any) => {
      return sum + (p.premium_cents || p.premiumCents || 0);
    }, 0);

    if (existing) {
      // Update existing record
      await db
        .update(canopyConnectPulls)
        .set({
          pullStatus,
          firstName: firstName || existing.firstName,
          lastName: lastName || existing.lastName,
          email: email || existing.email,
          phone: phone || existing.phone,
          dateOfBirth,
          address,
          carrierName,
          carrierFriendlyName,
          policies,
          vehicles,
          drivers,
          dwellings,
          coverages,
          claims,
          documents,
          totalPremiumCents,
          policyCount: policies.length,
          vehicleCount: vehicles.length,
          driverCount: drivers.length,
          rawPayload: body,
          pulledAt: new Date(),
          matchStatus: existing.matchStatus === "pending" ? "needs_review" : existing.matchStatus,
          updatedAt: new Date(),
        })
        .where(eq(canopyConnectPulls.id, existing.id));

      console.log(`[Canopy Webhook] Updated existing pull ${pullId}`);
    } else {
      // Create new record
      await db.insert(canopyConnectPulls).values({
        tenantId,
        pullId,
        pullStatus,
        firstName,
        lastName,
        email,
        phone,
        dateOfBirth,
        address,
        carrierName,
        carrierFriendlyName,
        policies,
        vehicles,
        drivers,
        dwellings,
        coverages,
        claims,
        documents,
        totalPremiumCents,
        policyCount: policies.length,
        vehicleCount: vehicles.length,
        driverCount: drivers.length,
        rawPayload: body,
        pulledAt: new Date(),
        matchStatus: "needs_review",
      });

      console.log(`[Canopy Webhook] Created new pull ${pullId}`);
    }

    return NextResponse.json({
      success: true,
      pullId,
      message: existing ? "Pull updated" : "Pull created",
    });
  } catch (error) {
    console.error("[Canopy Webhook] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Webhook processing failed" },
      { status: 500 }
    );
  }
}

// Also handle GET for webhook verification (some services send a GET first)
export async function GET(request: NextRequest) {
  return NextResponse.json({
    status: "ok",
    webhook: "canopy-connect",
    message: "Webhook endpoint is active. Configure this URL in Canopy Connect dashboard.",
  });
}
