/**
 * Canopy Connect Webhook Endpoint
 * ================================
 * Receives webhook notifications when customers complete policy imports.
 *
 * POST /api/webhooks/canopy-connect
 *
 * Canopy sends notification events (DATA_UPDATED, INITIAL_DATA_PULLED, etc.)
 * that contain only a pull_id — the actual policy data must be fetched
 * from the Canopy API via GET /pulls/{pullId}.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { canopyConnectPulls, customers } from "@/db/schema";
import { eq, or } from "drizzle-orm";
import { getCanopyClient, CanopyClient } from "@/lib/api/canopy";

// =============================================================================
// POST - Receive Webhook
// =============================================================================

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      console.error("[Canopy Webhook] Tenant not configured");
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    // Get raw body for signature verification
    const rawBody = await request.text();
    const signature = request.headers.get("x-canopy-signature") || "";

    // Verify webhook signature
    let client: ReturnType<typeof getCanopyClient>;
    try {
      client = getCanopyClient();
    } catch (error) {
      console.error("[Canopy Webhook] Canopy not configured:", error);
      return NextResponse.json({ error: "Canopy not configured" }, { status: 500 });
    }

    const isValid = client.verifyWebhookSignature(rawBody, signature);
    if (!isValid) {
      console.warn("[Canopy Webhook] Invalid signature");
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    // Parse payload — Canopy sends notification events, not full data
    const payload = JSON.parse(rawBody);
    const pullId = payload.pull_id;
    const eventType = payload.event_type || payload.status;
    console.log(`[Canopy Webhook] Received event: ${eventType}, pull_id: ${pullId}`);

    if (!pullId) {
      console.warn("[Canopy Webhook] No pull_id in payload");
      return NextResponse.json({ success: true, skipped: true });
    }

    // Fetch the full pull data from the Canopy API
    const pullData = await client.getPull(pullId);
    console.log(`[Canopy Webhook] Fetched pull ${pullId}: status=${pullData.status}, policies=${pullData.policies?.length || 0}`);

    // Extract normalized data from the full pull
    const extractedData = CanopyClient.extractPullData(pullData);

    // Store/update based on pull status
    if (pullData.status === "SUCCESS") {
      await handlePullCompleted(tenantId, extractedData, payload);
    } else if (pullData.status === "FAILED") {
      await handlePullFailed(tenantId, extractedData, payload);
    } else if (pullData.status === "EXPIRED") {
      await handlePullExpired(tenantId, extractedData, payload);
    } else {
      // PENDING or unknown — store what we have
      console.log(`[Canopy Webhook] Pull ${pullId} status=${pullData.status}, storing as pending`);
      await handlePullCompleted(tenantId, extractedData, payload);
    }

    const duration = Date.now() - startTime;
    console.log(`[Canopy Webhook] Processed in ${duration}ms`);

    return NextResponse.json({
      success: true,
      pull_id: pullId,
      event: eventType,
    });
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
  data: ReturnType<typeof CanopyClient.extractPullData>,
  rawPayload: Record<string, unknown>
) {
  // Check if we already have this pull
  const [existing] = await db
    .select({ id: canopyConnectPulls.id })
    .from(canopyConnectPulls)
    .where(eq(canopyConnectPulls.pullId, data.pullId))
    .limit(1);

  if (existing) {
    console.log(`[Canopy Webhook] Pull ${data.pullId} already exists, updating`);
    await db
      .update(canopyConnectPulls)
      .set({
        pullStatus: data.pullStatus,
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phone: normalizePhone(data.phone),
        dateOfBirth: data.dateOfBirth,
        address: data.address,
        secondaryInsured: data.secondaryInsured,
        carrierName: data.carrierName,
        carrierFriendlyName: data.carrierFriendlyName,
        policies: data.policies,
        vehicles: data.vehicles,
        drivers: data.drivers,
        dwellings: data.dwellings,
        coverages: data.coverages,
        claims: data.claims,
        documents: data.documents,
        canopyLinkUsed: data.canopyLinkUsed,
        totalPremiumCents: data.totalPremiumCents,
        policyCount: data.policies.length,
        vehicleCount: data.vehicles.length,
        driverCount: data.drivers.length,
        rawPayload: rawPayload,
        pulledAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(canopyConnectPulls.id, existing.id));
    return;
  }

  // Try to auto-match by phone number
  let matchedCustomer = null;
  const normalizedPhone = normalizePhone(data.phone);

  if (normalizedPhone) {
    const phoneVariants = [
      normalizedPhone,
      normalizedPhone.replace(/\D/g, ""),
      `+1${normalizedPhone.replace(/\D/g, "")}`,
    ];

    const [customer] = await db
      .select({
        id: customers.id,
        agencyzoomId: customers.agencyzoomId,
      })
      .from(customers)
      .where(
        or(
          ...phoneVariants.map(p => eq(customers.phone, p)),
          ...phoneVariants.map(p => eq(customers.phoneAlt, p))
        )!
      )
      .limit(1);

    if (customer) {
      matchedCustomer = customer;
      console.log(`[Canopy Webhook] Auto-matched to customer ${customer.id} by phone`);
    }
  }

  // Insert new pull record
  await db.insert(canopyConnectPulls).values({
    tenantId,
    pullId: data.pullId,
    pullStatus: data.pullStatus,
    firstName: data.firstName,
    lastName: data.lastName,
    email: data.email,
    phone: normalizedPhone,
    dateOfBirth: data.dateOfBirth,
    address: data.address,
    secondaryInsured: data.secondaryInsured,
    carrierName: data.carrierName,
    carrierFriendlyName: data.carrierFriendlyName,
    policies: data.policies,
    vehicles: data.vehicles,
    drivers: data.drivers,
    dwellings: data.dwellings,
    coverages: data.coverages,
    claims: data.claims,
    documents: data.documents,
    canopyLinkUsed: data.canopyLinkUsed,
    totalPremiumCents: data.totalPremiumCents,
    policyCount: data.policies.length,
    vehicleCount: data.vehicles.length,
    driverCount: data.drivers.length,
    matchStatus: matchedCustomer ? "matched" : "pending",
    matchedCustomerId: matchedCustomer?.id,
    matchedAgencyzoomId: matchedCustomer?.agencyzoomId,
    matchedAt: matchedCustomer ? new Date() : null,
    rawPayload: rawPayload,
    pulledAt: new Date(),
  });

  console.log(`[Canopy Webhook] Stored pull ${data.pullId} with ${data.policies.length} policies, ${data.vehicles.length} vehicles`);
}

async function handlePullFailed(
  tenantId: string,
  data: ReturnType<typeof CanopyClient.extractPullData>,
  rawPayload: Record<string, unknown>
) {
  // Check if we already have this pull
  const [existing] = await db
    .select({ id: canopyConnectPulls.id })
    .from(canopyConnectPulls)
    .where(eq(canopyConnectPulls.pullId, data.pullId))
    .limit(1);

  if (existing) {
    await db
      .update(canopyConnectPulls)
      .set({
        pullStatus: "FAILED",
        rawPayload: rawPayload,
        updatedAt: new Date(),
      })
      .where(eq(canopyConnectPulls.id, existing.id));
  } else {
    await db.insert(canopyConnectPulls).values({
      tenantId,
      pullId: data.pullId,
      pullStatus: "FAILED",
      firstName: data.firstName,
      lastName: data.lastName,
      phone: normalizePhone(data.phone),
      matchStatus: "needs_review",
      rawPayload: rawPayload,
    });
  }

  console.log(`[Canopy Webhook] Pull ${data.pullId} failed`);
}

async function handlePullExpired(
  tenantId: string,
  data: ReturnType<typeof CanopyClient.extractPullData>,
  rawPayload: Record<string, unknown>
) {
  // Check if we already have this pull
  const [existing] = await db
    .select({ id: canopyConnectPulls.id })
    .from(canopyConnectPulls)
    .where(eq(canopyConnectPulls.pullId, data.pullId))
    .limit(1);

  if (existing) {
    await db
      .update(canopyConnectPulls)
      .set({
        pullStatus: "EXPIRED",
        rawPayload: rawPayload,
        updatedAt: new Date(),
      })
      .where(eq(canopyConnectPulls.id, existing.id));
  } else {
    await db.insert(canopyConnectPulls).values({
      tenantId,
      pullId: data.pullId,
      pullStatus: "EXPIRED",
      matchStatus: "ignored",
      rawPayload: rawPayload,
    });
  }

  console.log(`[Canopy Webhook] Pull ${data.pullId} expired`);
}

// =============================================================================
// Helpers
// =============================================================================

function normalizePhone(phone: string | undefined | null): string | undefined {
  if (!phone) return undefined;

  // Remove all non-digits
  const digits = phone.replace(/\D/g, "");

  // Format as (XXX) XXX-XXXX for US numbers
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11 && digits.startsWith("1")) {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }

  return phone; // Return original if can't normalize
}
