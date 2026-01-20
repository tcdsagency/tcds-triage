/**
 * DOB Sync API
 * ============
 * Syncs date of birth data from HawkSoft (primary) and AgencyZoom (fallback).
 *
 * POST /api/sync/dob - Run full DOB sync
 * GET /api/sync/dob - Get sync status/stats
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { customers } from "@/db/schema";
import { eq, and, isNull, isNotNull, or } from "drizzle-orm";
import { getHawkSoftClient } from "@/lib/api/hawksoft";
import { getAgencyZoomClient } from "@/lib/api/agencyzoom";

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

    return NextResponse.json({
      success: true,
      stats: {
        totalCustomers: allCustomers.length,
        withDateOfBirth: withDob.length,
        withoutDateOfBirth: allCustomers.length - withDob.length,
        withHawksoftId: withHawksoft.length,
        withAgencyzoomId: withAgencyzoom.length,
        eligibleForSync: needsDob.length,
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

    // Get customers without DOB who have external IDs
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
          or(isNotNull(customers.hawksoftClientCode), isNotNull(customers.agencyzoomId))
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

    let hawksoftData: Map<number, string | null> = new Map();

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

        // 3. Update customer if DOB found
        if (dob && !dryRun) {
          // Parse DOB string to Date
          const dobDate = new Date(dob);
          if (!isNaN(dobDate.getTime())) {
            await db
              .update(customers)
              .set({ dateOfBirth: dobDate, updatedAt: new Date() })
              .where(eq(customers.id, customer.id));

            results.synced++;
            if (source === "hawksoft") results.fromHawksoft++;
            if (source === "agencyzoom") results.fromAgencyzoom++;
          } else {
            results.skipped++;
          }
        } else if (dob && dryRun) {
          results.synced++;
          if (source === "hawksoft") results.fromHawksoft++;
          if (source === "agencyzoom") results.fromAgencyzoom++;
        } else {
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

    console.log(`[DOB Sync] Complete: ${results.synced} synced, ${results.failed} failed`);

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
