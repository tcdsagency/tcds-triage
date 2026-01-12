/**
 * Canopy Connect Sync
 * ====================
 * Sync pulls from Canopy Connect API to local database.
 * Useful for initial sync, recovery, or catching missed webhooks.
 *
 * POST /api/canopy-connect/sync
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { canopyConnectPulls, customers } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { getCanopyClient } from "@/lib/api/canopy";

export async function POST(request: NextRequest) {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    const body = await request.json().catch(() => ({}));
    const limit = Math.min(body.limit || 100, 500); // Max 500 at a time
    const status = body.status || "SUCCESS"; // SUCCESS, PENDING, FAILED

    // Get Canopy client
    let client;
    try {
      client = getCanopyClient();
    } catch (error) {
      return NextResponse.json(
        { error: "Canopy Connect not configured" },
        { status: 500 }
      );
    }

    // Fetch pulls from Canopy
    let pullsData;
    try {
      pullsData = await client.listPulls({ status, limit });
      console.log(`[Canopy Sync] Fetched ${pullsData.pulls?.length || 0} pulls from Canopy`);
    } catch (error) {
      console.error("[Canopy Sync] Failed to fetch pulls:", error);
      return NextResponse.json(
        { error: `Failed to fetch pulls: ${error instanceof Error ? error.message : "Unknown error"}` },
        { status: 500 }
      );
    }

    const pulls = pullsData.pulls || [];
    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const pullData of pulls) {
      const pullId = pullData.pull_id;

      // Check if we already have this pull
      const [existing] = await db
        .select({ id: canopyConnectPulls.id, pullStatus: canopyConnectPulls.pullStatus })
        .from(canopyConnectPulls)
        .where(eq(canopyConnectPulls.pullId, pullId))
        .limit(1);

      // Extract common fields
      const firstName = pullData.first_name || "";
      const lastName = pullData.last_name || "";
      const email = pullData.email || "";
      const phone = pullData.phone || "";
      const dateOfBirth = pullData.date_of_birth || null;
      const address = pullData.primary_address || null;
      const carrierName = pullData.insurance_provider_name || null;
      const carrierFriendlyName = pullData.insurance_provider_friendly_name || carrierName;
      const policies = pullData.policies || [];
      const vehicles: any[] = [];
      const drivers: any[] = [];
      const dwellings: any[] = [];
      const coverages: any[] = [];
      const documents: any[] = [];

      // Aggregate from policies
      for (const policy of policies) {
        if (policy.vehicles) vehicles.push(...policy.vehicles);
        if (policy.drivers) drivers.push(...policy.drivers);
        if (policy.dwellings) dwellings.push(...policy.dwellings);
        if (policy.coverages) coverages.push(...policy.coverages);
        if (policy.documents) documents.push(...policy.documents);
      }

      const totalPremiumCents = policies.reduce((sum: number, p: any) => {
        return sum + (p.total_premium_cents || 0);
      }, 0);

      // Try to auto-match by phone/email
      let matchedCustomerId = null;
      let matchedAgencyzoomId = null;
      let matchStatus: "pending" | "matched" | "needs_review" = "needs_review";

      if (phone || email) {
        const match = await findMatchingCustomer(tenantId, phone, email);
        if (match) {
          matchedCustomerId = match.customerId;
          matchedAgencyzoomId = match.agencyzoomId;
          matchStatus = "matched";
        }
      }

      if (existing) {
        // Only update if status changed or we have more data
        if (existing.pullStatus !== pullData.status || policies.length > 0) {
          await db
            .update(canopyConnectPulls)
            .set({
              pullStatus: pullData.status,
              firstName: firstName || undefined,
              lastName: lastName || undefined,
              email: email || undefined,
              phone: phone || undefined,
              dateOfBirth,
              address,
              carrierName,
              carrierFriendlyName,
              policies: policies.length > 0 ? policies : undefined,
              vehicles: vehicles.length > 0 ? vehicles : undefined,
              drivers: drivers.length > 0 ? drivers : undefined,
              dwellings: dwellings.length > 0 ? dwellings : undefined,
              coverages: coverages.length > 0 ? coverages : undefined,
              documents: documents.length > 0 ? documents : undefined,
              totalPremiumCents: totalPremiumCents > 0 ? totalPremiumCents : undefined,
              policyCount: policies.length || undefined,
              vehicleCount: vehicles.length || undefined,
              driverCount: drivers.length || undefined,
              matchedCustomerId: matchedCustomerId || undefined,
              matchedAgencyzoomId: matchedAgencyzoomId || undefined,
              matchStatus: matchedCustomerId ? matchStatus : undefined,
              updatedAt: new Date(),
            })
            .where(eq(canopyConnectPulls.id, existing.id));

          updated++;
        } else {
          skipped++;
        }
      } else {
        await db.insert(canopyConnectPulls).values({
          tenantId,
          pullId,
          pullStatus: pullData.status,
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
          documents,
          totalPremiumCents,
          policyCount: policies.length,
          vehicleCount: vehicles.length,
          driverCount: drivers.length,
          matchStatus,
          matchedCustomerId,
          matchedAgencyzoomId,
          pulledAt: pullData.completed_at ? new Date(pullData.completed_at) : null,
        });

        created++;
      }
    }

    console.log(`[Canopy Sync] Sync complete: ${created} created, ${updated} updated, ${skipped} skipped`);

    return NextResponse.json({
      success: true,
      total: pulls.length,
      created,
      updated,
      skipped,
    });
  } catch (error) {
    console.error("[Canopy Sync] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Sync failed" },
      { status: 500 }
    );
  }
}

// Helper to find matching customer
async function findMatchingCustomer(
  tenantId: string,
  phone: string | null,
  email: string | null
): Promise<{ customerId: string; agencyzoomId: string | null } | null> {
  if (!phone && !email) return null;

  const normalizedPhone = phone?.replace(/\D/g, "").slice(-10) || "";

  if (normalizedPhone) {
    const [byPhone] = await db
      .select({
        id: customers.id,
        agencyzoomId: customers.agencyzoomId,
      })
      .from(customers)
      .where(sql`
        ${customers.tenantId} = ${tenantId}
        AND REPLACE(REPLACE(REPLACE(REPLACE(${customers.phone}, '-', ''), '(', ''), ')', ''), ' ', '') LIKE ${'%' + normalizedPhone}
      `)
      .limit(1);

    if (byPhone) {
      return { customerId: byPhone.id, agencyzoomId: byPhone.agencyzoomId };
    }
  }

  if (email) {
    const [byEmail] = await db
      .select({
        id: customers.id,
        agencyzoomId: customers.agencyzoomId,
      })
      .from(customers)
      .where(sql`
        ${customers.tenantId} = ${tenantId}
        AND LOWER(${customers.email}) = ${email.toLowerCase()}
      `)
      .limit(1);

    if (byEmail) {
      return { customerId: byEmail.id, agencyzoomId: byEmail.agencyzoomId };
    }
  }

  return null;
}
