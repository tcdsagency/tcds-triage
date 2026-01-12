/**
 * Canopy Connect Webhook
 * ======================
 * Receives pull notifications from Canopy Connect.
 * Handles: pull.completed, pull.failed, pull.expired
 * Auto-matches to existing customers by phone/email.
 *
 * Configure this webhook URL in Canopy Connect dashboard:
 * https://tcds-triage.vercel.app/api/canopy-connect/webhook
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { canopyConnectPulls, customers } from "@/db/schema";
import { eq, or, ilike, sql } from "drizzle-orm";
import { getCanopyClient } from "@/lib/api/canopy";

// =============================================================================
// Auto-Match Customer
// =============================================================================

async function findMatchingCustomer(
  tenantId: string,
  phone: string | null,
  email: string | null,
  firstName: string | null,
  lastName: string | null
): Promise<{ customerId: string; agencyzoomId: string | null; confidence: "high" | "medium" | "low" } | null> {
  if (!phone && !email) return null;

  // Normalize phone for matching (strip formatting)
  const normalizedPhone = phone?.replace(/\D/g, "") || "";
  const phoneVariants = normalizedPhone ? [
    normalizedPhone,
    normalizedPhone.slice(-10), // Last 10 digits
    `+1${normalizedPhone.slice(-10)}`, // With +1
  ] : [];

  // Try to find by phone first (highest confidence)
  if (phoneVariants.length > 0) {
    const phoneConditions = phoneVariants.map(p =>
      sql`REPLACE(REPLACE(REPLACE(REPLACE(${customers.phone}, '-', ''), '(', ''), ')', ''), ' ', '') LIKE ${'%' + p.slice(-10)}`
    );

    const [byPhone] = await db
      .select({
        id: customers.id,
        agencyzoomId: customers.agencyzoomId,
        firstName: customers.firstName,
        lastName: customers.lastName,
      })
      .from(customers)
      .where(sql`${customers.tenantId} = ${tenantId} AND (${sql.join(phoneConditions, sql` OR `)})`)
      .limit(1);

    if (byPhone) {
      // Check if name matches for high confidence
      const nameMatch =
        (firstName && byPhone.firstName?.toLowerCase().includes(firstName.toLowerCase())) ||
        (lastName && byPhone.lastName?.toLowerCase().includes(lastName.toLowerCase()));

      return {
        customerId: byPhone.id,
        agencyzoomId: byPhone.agencyzoomId,
        confidence: nameMatch ? "high" : "medium",
      };
    }
  }

  // Try by email (medium confidence)
  if (email) {
    const [byEmail] = await db
      .select({
        id: customers.id,
        agencyzoomId: customers.agencyzoomId,
      })
      .from(customers)
      .where(sql`${customers.tenantId} = ${tenantId} AND LOWER(${customers.email}) = ${email.toLowerCase()}`)
      .limit(1);

    if (byEmail) {
      return {
        customerId: byEmail.id,
        agencyzoomId: byEmail.agencyzoomId,
        confidence: "medium",
      };
    }
  }

  // Try by name (low confidence - needs review)
  if (firstName && lastName) {
    const [byName] = await db
      .select({
        id: customers.id,
        agencyzoomId: customers.agencyzoomId,
      })
      .from(customers)
      .where(sql`
        ${customers.tenantId} = ${tenantId}
        AND LOWER(${customers.firstName}) = ${firstName.toLowerCase()}
        AND LOWER(${customers.lastName}) = ${lastName.toLowerCase()}
      `)
      .limit(1);

    if (byName) {
      return {
        customerId: byName.id,
        agencyzoomId: byName.agencyzoomId,
        confidence: "low",
      };
    }
  }

  return null;
}

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

    // Handle different event types
    if (eventType === "pull.failed") {
      return await handlePullFailed(tenantId, pullId, body, existing);
    }

    if (eventType === "pull.expired") {
      return await handlePullExpired(tenantId, pullId, body, existing);
    }

    // Default: pull.completed
    return await handlePullCompleted(tenantId, pullId, body, existing);
  } catch (error) {
    console.error("[Canopy Webhook] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Webhook processing failed" },
      { status: 500 }
    );
  }
}

// =============================================================================
// Event Handlers
// =============================================================================

async function handlePullCompleted(
  tenantId: string,
  pullId: string,
  body: any,
  existing: any
) {
  // Fetch full pull data from Canopy API
  let pullData;
  try {
    const client = getCanopyClient();
    pullData = await client.getPull(pullId);
    console.log(`[Canopy Webhook] Fetched pull data for ${pullId}`);
  } catch (error) {
    console.error("[Canopy Webhook] Failed to fetch pull data:", error);
    pullData = body.data || body;
  }

  // Extract data from pull
  const firstName = pullData.first_name || pullData.firstName || body.first_name || "";
  const lastName = pullData.last_name || pullData.lastName || body.last_name || "";
  const email = pullData.email || body.email || "";
  const phone = pullData.phone || body.phone || "";
  const dateOfBirth = pullData.date_of_birth || pullData.dateOfBirth || null;
  const address = pullData.address || null;
  const carrierName = pullData.carrier?.name || pullData.carrier_name || pullData.insurance_provider_name || null;
  const carrierFriendlyName = pullData.carrier?.friendly_name || pullData.carrier_friendly_name || pullData.insurance_provider_friendly_name || carrierName;

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
    return sum + (p.premium_cents || p.premiumCents || p.total_premium_cents || 0);
  }, 0);

  // Auto-match to customer if not already matched
  let matchStatus = existing?.matchStatus || "needs_review";
  let matchedCustomerId = existing?.matchedCustomerId || null;
  let matchedAgencyzoomId = existing?.matchedAgencyzoomId || null;
  let matchConfidence = existing?.matchConfidence || null;

  if (!matchedCustomerId && (phone || email)) {
    const match = await findMatchingCustomer(tenantId, phone, email, firstName, lastName);
    if (match) {
      matchedCustomerId = match.customerId;
      matchedAgencyzoomId = match.agencyzoomId;
      matchConfidence = match.confidence;
      matchStatus = match.confidence === "high" ? "matched" : "needs_review";
      console.log(`[Canopy Webhook] Auto-matched to customer ${matchedCustomerId} (${match.confidence} confidence)`);
    }
  }

  if (existing) {
    await db
      .update(canopyConnectPulls)
      .set({
        pullStatus: "SUCCESS",
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
        matchStatus,
        matchedCustomerId,
        matchedAgencyzoomId,
        updatedAt: new Date(),
      })
      .where(eq(canopyConnectPulls.id, existing.id));

    console.log(`[Canopy Webhook] Updated existing pull ${pullId}`);
  } else {
    await db.insert(canopyConnectPulls).values({
      tenantId,
      pullId,
      pullStatus: "SUCCESS",
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
      matchStatus,
      matchedCustomerId,
      matchedAgencyzoomId,
    });

    console.log(`[Canopy Webhook] Created new pull ${pullId}`);
  }

  return NextResponse.json({
    success: true,
    pullId,
    event: "pull.completed",
    matched: !!matchedCustomerId,
    matchConfidence,
    message: existing ? "Pull updated" : "Pull created",
  });
}

async function handlePullFailed(
  tenantId: string,
  pullId: string,
  body: any,
  existing: any
) {
  const failureReason = body.failure_reason || body.error || body.message || "Unknown failure";

  if (existing) {
    await db
      .update(canopyConnectPulls)
      .set({
        pullStatus: "FAILED",
        rawPayload: body,
        updatedAt: new Date(),
      })
      .where(eq(canopyConnectPulls.id, existing.id));

    console.log(`[Canopy Webhook] Pull ${pullId} failed: ${failureReason}`);
  } else {
    // Create record for failed pull
    await db.insert(canopyConnectPulls).values({
      tenantId,
      pullId,
      pullStatus: "FAILED",
      rawPayload: body,
      matchStatus: "ignored",
    });

    console.log(`[Canopy Webhook] Created failed pull record ${pullId}`);
  }

  return NextResponse.json({
    success: true,
    pullId,
    event: "pull.failed",
    reason: failureReason,
  });
}

async function handlePullExpired(
  tenantId: string,
  pullId: string,
  body: any,
  existing: any
) {
  if (existing) {
    await db
      .update(canopyConnectPulls)
      .set({
        pullStatus: "EXPIRED",
        rawPayload: body,
        updatedAt: new Date(),
      })
      .where(eq(canopyConnectPulls.id, existing.id));

    console.log(`[Canopy Webhook] Pull ${pullId} expired`);
  } else {
    await db.insert(canopyConnectPulls).values({
      tenantId,
      pullId,
      pullStatus: "EXPIRED",
      rawPayload: body,
      matchStatus: "ignored",
    });

    console.log(`[Canopy Webhook] Created expired pull record ${pullId}`);
  }

  return NextResponse.json({
    success: true,
    pullId,
    event: "pull.expired",
  });
}

// Also handle GET for webhook verification (some services send a GET first)
export async function GET(request: NextRequest) {
  return NextResponse.json({
    status: "ok",
    webhook: "canopy-connect",
    message: "Webhook endpoint is active. Configure this URL in Canopy Connect dashboard.",
  });
}
