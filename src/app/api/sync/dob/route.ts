/**
 * DOB Sync API
 * ============
 * Syncs date of birth data from HawkSoft (primary) and AgencyZoom (fallback).
 *
 * POST /api/sync/dob - Run full DOB sync
 * GET /api/sync/dob - Get sync status/stats
 *
 * Uses dobSyncAttemptedAt to avoid retrying the same customers every night.
 * Customers where no DOB was found get stamped so the sync progresses through
 * the full customer list rather than getting stuck on the same batch.
 * Re-attempts customers after 30 days in case upstream data has been updated.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { customers } from "@/db/schema";
import { eq, and, isNull, isNotNull, or, sql, lt } from "drizzle-orm";
import { getHawkSoftClient } from "@/lib/api/hawksoft";
import { getAgencyZoomClient } from "@/lib/api/agencyzoom";

const RETRY_AFTER_DAYS = 30;

// =============================================================================
// GET - Sync Stats
// =============================================================================

export async function GET() {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    // Count customers
    const allCustomers = await db
      .select({
        id: customers.id,
        firstName: customers.firstName,
        lastName: customers.lastName,
        dateOfBirth: customers.dateOfBirth,
        dobSyncAttemptedAt: customers.dobSyncAttemptedAt,
        hawksoftClientCode: customers.hawksoftClientCode,
        agencyzoomId: customers.agencyzoomId,
        isLead: customers.isLead,
      })
      .from(customers)
      .where(and(
        eq(customers.tenantId, tenantId),
        or(eq(customers.isLead, false), isNull(customers.isLead))
      ));

    const withDob = allCustomers.filter((c) => c.dateOfBirth !== null);
    const withHawksoft = allCustomers.filter((c) => c.hawksoftClientCode !== null);
    const withAgencyzoom = allCustomers.filter((c) => c.agencyzoomId !== null);
    const needsDob = allCustomers.filter(
      (c) => c.dateOfBirth === null && (c.hawksoftClientCode || c.agencyzoomId)
    );
    const attemptedNoResult = allCustomers.filter(
      (c) => c.dateOfBirth === null && c.dobSyncAttemptedAt !== null
    );

    return NextResponse.json({
      success: true,
      stats: {
        totalCustomers: allCustomers.length,
        withDateOfBirth: withDob.length,
        withoutDateOfBirth: allCustomers.length - withDob.length,
        withHawksoftId: withHawksoft.length,
        withAgencyzoomId: withAgencyzoom.length,
        eligibleForSync: needsDob.length,
        attemptedNoResult: attemptedNoResult.length,
      },
    });
  } catch (error) {
    console.error("[DOB Sync] Stats error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get stats" },
      { status: 500 }
    );
  }
}

// =============================================================================
// POST - Run DOB Sync
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    const body = await request.json().catch(() => ({}));
    const limit = body.limit || 500; // Process in batches
    const dryRun = body.dryRun || false;

    console.log(`[DOB Sync] Starting sync (limit: ${limit}, dryRun: ${dryRun})`);

    // Calculate retry cutoff (re-attempt after RETRY_AFTER_DAYS days)
    const retryCutoff = new Date();
    retryCutoff.setDate(retryCutoff.getDate() - RETRY_AFTER_DAYS);

    // Get customers without DOB who have external IDs
    // Skip customers that were already attempted recently (dobSyncAttemptedAt within last 30 days)
    const customersToSync = await db
      .select({
        id: customers.id,
        firstName: customers.firstName,
        lastName: customers.lastName,
        hawksoftClientCode: customers.hawksoftClientCode,
        agencyzoomId: customers.agencyzoomId,
      })
      .from(customers)
      .where(
        and(
          eq(customers.tenantId, tenantId),
          or(eq(customers.isLead, false), isNull(customers.isLead)),
          isNull(customers.dateOfBirth),
          or(isNotNull(customers.hawksoftClientCode), isNotNull(customers.agencyzoomId)),
          // Only pick customers never attempted, or attempted more than 30 days ago
          or(
            isNull(customers.dobSyncAttemptedAt),
            lt(customers.dobSyncAttemptedAt, retryCutoff)
          )
        )
      )
      .limit(limit);

    console.log(`[DOB Sync] Found ${customersToSync.length} customers to sync`);

    if (customersToSync.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No customers need DOB sync",
        results: { total: 0, synced: 0, failed: 0 },
      });
    }

    // Initialize API clients
    let hawksoftClient: ReturnType<typeof getHawkSoftClient> | null = null;
    let agencyzoomClient: ReturnType<typeof getAgencyZoomClient> | null = null;

    try {
      hawksoftClient = getHawkSoftClient();
    } catch (e) {
      console.warn("[DOB Sync] HawkSoft client not available:", e);
    }

    try {
      agencyzoomClient = getAgencyZoomClient();
    } catch (e) {
      console.warn("[DOB Sync] AgencyZoom client not available:", e);
    }

    if (!hawksoftClient && !agencyzoomClient) {
      return NextResponse.json(
        { error: "No API clients available (HawkSoft or AgencyZoom)" },
        { status: 500 }
      );
    }

    // Process customers
    const results = {
      total: customersToSync.length,
      synced: 0,
      fromHawksoft: 0,
      fromAgencyzoom: 0,
      failed: 0,
      skipped: 0,
      details: [] as Array<{
        id: string;
        name: string;
        source: string;
        dob: string | null;
        error?: string;
      }>,
    };

    // Batch HawkSoft lookups for efficiency
    const hawksoftCustomers = customersToSync.filter((c) => c.hawksoftClientCode);
    const hawksoftClientCodes = hawksoftCustomers.map((c) => parseInt(c.hawksoftClientCode!));

    const hawksoftData: Map<number, string | null> = new Map();

    if (hawksoftClient && hawksoftClientCodes.length > 0) {
      console.log(`[DOB Sync] Fetching ${hawksoftClientCodes.length} customers from HawkSoft...`);

      try {
        // Batch fetch in groups of 50
        const batchSize = 50;
        for (let i = 0; i < hawksoftClientCodes.length; i += batchSize) {
          const batch = hawksoftClientCodes.slice(i, i + batchSize);
          const clients = await hawksoftClient.getClients(batch, ["details", "people"]);

          for (const client of clients) {
            hawksoftData.set(client.clientNumber, client.dateOfBirth || null);
          }

          // Small delay between batches
          if (i + batchSize < hawksoftClientCodes.length) {
            await new Promise((r) => setTimeout(r, 500));
          }
        }

        console.log(`[DOB Sync] Retrieved ${hawksoftData.size} HawkSoft records`);
      } catch (e) {
        console.error("[DOB Sync] HawkSoft batch fetch error:", e);
      }
    }

    const now = new Date();

    // Process each customer
    for (const customer of customersToSync) {
      let dob: string | null = null;
      let source = "none";

      try {
        // 1. Try HawkSoft first
        if (customer.hawksoftClientCode) {
          const hawksoftDob = hawksoftData.get(parseInt(customer.hawksoftClientCode));
          if (hawksoftDob) {
            dob = hawksoftDob;
            source = "hawksoft";
          }
        }

        // 2. Fallback to AgencyZoom
        if (!dob && customer.agencyzoomId && agencyzoomClient) {
          try {
            const azCustomer = await agencyzoomClient.getCustomer(parseInt(customer.agencyzoomId));
            if (azCustomer?.dateOfBirth) {
              dob = azCustomer.dateOfBirth;
              source = "agencyzoom";
            }
            // Small delay for AgencyZoom rate limiting
            await new Promise((r) => setTimeout(r, 200));
          } catch (e) {
            console.warn(`[DOB Sync] AgencyZoom lookup failed for ${customer.id}:`, e);
          }
        }

        // 3. Update customer
        if (dob && !dryRun) {
          // Parse DOB string to Date
          const dobDate = new Date(dob);
          if (!isNaN(dobDate.getTime())) {
            await db
              .update(customers)
              .set({ dateOfBirth: dobDate, dobSyncAttemptedAt: now, updatedAt: now })
              .where(eq(customers.id, customer.id));

            results.synced++;
            if (source === "hawksoft") results.fromHawksoft++;
            if (source === "agencyzoom") results.fromAgencyzoom++;
          } else {
            // Invalid date format — stamp as attempted so we don't retry immediately
            if (!dryRun) {
              await db
                .update(customers)
                .set({ dobSyncAttemptedAt: now })
                .where(eq(customers.id, customer.id));
            }
            results.skipped++;
          }
        } else if (dob && dryRun) {
          results.synced++;
          if (source === "hawksoft") results.fromHawksoft++;
          if (source === "agencyzoom") results.fromAgencyzoom++;
        } else {
          // No DOB found from any source — stamp as attempted
          if (!dryRun) {
            await db
              .update(customers)
              .set({ dobSyncAttemptedAt: now })
              .where(eq(customers.id, customer.id));
          }
          results.skipped++;
        }

        results.details.push({
          id: customer.id,
          name: `${customer.firstName} ${customer.lastName}`,
          source,
          dob,
        });
      } catch (e) {
        results.failed++;
        results.details.push({
          id: customer.id,
          name: `${customer.firstName} ${customer.lastName}`,
          source: "error",
          dob: null,
          error: e instanceof Error ? e.message : "Unknown error",
        });
      }
    }

    console.log(`[DOB Sync] Complete: ${results.synced} synced, ${results.skipped} skipped (no DOB found), ${results.failed} failed`);

    return NextResponse.json({
      success: true,
      dryRun,
      results: {
        total: results.total,
        synced: results.synced,
        fromHawksoft: results.fromHawksoft,
        fromAgencyzoom: results.fromAgencyzoom,
        failed: results.failed,
        skipped: results.skipped,
      },
      // Only include details in dry run or small batches
      details: dryRun || results.total <= 50 ? results.details : undefined,
    });
  } catch (error) {
    console.error("[DOB Sync] Sync error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Sync failed" },
      { status: 500 }
    );
  }
}
