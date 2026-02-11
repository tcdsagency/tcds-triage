// API Route: /api/risk-monitor/sync
// Sync customer addresses from the database to risk monitor

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { customers, riskMonitorPolicies, policies } from "@/db/schema";
import { eq, and, or, isNotNull, isNull, sql } from "drizzle-orm";

// POST - Sync all customer addresses to risk monitor
export async function POST(request: NextRequest) {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    const body = await request.json().catch(() => ({}));
    const dryRun = body.dryRun === true;
    const onlyWithPolicies = body.onlyWithPolicies !== false; // Default TRUE - only import customers with active home policies
    const excludeLeads = body.excludeLeads !== false; // Default true - exclude leads

    // Get all customers with addresses
    let customersWithAddresses;

    if (onlyWithPolicies) {
      // Only get customers who have at least one active homeowners policy in local DB
      customersWithAddresses = await db
        .selectDistinctOn([customers.id], {
          id: customers.id,
          firstName: customers.firstName,
          lastName: customers.lastName,
          email: customers.email,
          phone: customers.phone,
          address: customers.address,
          agencyzoomId: customers.agencyzoomId,
          policyNumber: policies.policyNumber,
          carrier: policies.carrier,
          expirationDate: policies.expirationDate,
          customerSinceDate: sql<Date>`(SELECT min(${policies.effectiveDate}) FROM ${policies} WHERE ${policies.customerId} = ${customers.id})`.as('customer_since_date'),
        })
        .from(customers)
        .innerJoin(policies, eq(policies.customerId, customers.id))
        .where(
          and(
            eq(customers.tenantId, tenantId),
            eq(customers.isArchived, false),
            isNotNull(customers.address),
            eq(policies.status, "active"),
            sql`${policies.lineOfBusiness} ILIKE '%home%' OR ${policies.lineOfBusiness} ILIKE '%dwelling%' OR ${policies.lineOfBusiness} ILIKE '%property%'`
          )
        );
    } else {
      // Get all customers with addresses (default behavior)
      // These are customers synced from AgencyZoom who have street addresses
      customersWithAddresses = await db
        .select({
          id: customers.id,
          firstName: customers.firstName,
          lastName: customers.lastName,
          email: customers.email,
          phone: customers.phone,
          address: customers.address,
          agencyzoomId: customers.agencyzoomId,
          customerSinceDate: sql<Date>`(SELECT min(${policies.effectiveDate}) FROM ${policies} WHERE ${policies.customerId} = ${customers.id})`.as('customer_since_date'),
        })
        .from(customers)
        .where(
          and(
            eq(customers.tenantId, tenantId),
            eq(customers.isArchived, false),
            isNotNull(customers.address),
            // Optionally exclude leads (they don't have policies)
            excludeLeads ? eq(customers.isLead, false) : undefined
          )
        );
    }

    // Get existing monitored addresses
    const existingPolicies = await db
      .select({
        addressLine1: riskMonitorPolicies.addressLine1,
        city: riskMonitorPolicies.city,
        state: riskMonitorPolicies.state,
      })
      .from(riskMonitorPolicies)
      .where(eq(riskMonitorPolicies.tenantId, tenantId));

    // Create a Set of existing addresses for fast lookup
    const existingAddressSet = new Set(
      existingPolicies.map(
        (p) => `${p.addressLine1?.toLowerCase()}|${p.city?.toLowerCase()}|${p.state?.toLowerCase()}`
      )
    );

    // Filter to only new addresses
    const newCustomers = customersWithAddresses.filter((c) => {
      if (!c.address?.street || !c.address?.city || !c.address?.state) {
        return false;
      }
      const key = `${c.address.street.toLowerCase()}|${c.address.city.toLowerCase()}|${c.address.state.toLowerCase()}`;
      return !existingAddressSet.has(key);
    });

    if (dryRun) {
      return NextResponse.json({
        success: true,
        dryRun: true,
        stats: {
          totalCustomers: customersWithAddresses.length,
          existingMonitored: existingPolicies.length,
          newToImport: newCustomers.length,
        },
        preview: newCustomers.slice(0, 10).map((c) => ({
          name: `${c.firstName} ${c.lastName}`,
          address: c.address,
          policyNumber: (c as any).policyNumber,
        })),
      });
    }

    // Import new customers
    let imported = 0;
    const errors: string[] = [];

    for (const customer of newCustomers) {
      try {
        await db.insert(riskMonitorPolicies).values({
          tenantId,
          policyNumber: (customer as any).policyNumber || null,
          azContactId: customer.agencyzoomId || null,
          contactName: `${customer.firstName} ${customer.lastName}`,
          contactEmail: customer.email || null,
          contactPhone: customer.phone || null,
          addressLine1: customer.address!.street,
          city: customer.address!.city,
          state: customer.address!.state,
          zipCode: customer.address!.zip || "",
          carrier: (customer as any).carrier || null,
          policyType: "homeowners",
          expirationDate: (customer as any).expirationDate || null,
          customerSinceDate: (customer as any).customerSinceDate || null, // When they became a customer
          currentStatus: "off_market",
          isActive: true,
        });
        imported++;
      } catch (error: any) {
        errors.push(`${customer.firstName} ${customer.lastName}: ${error.message}`);
      }
    }

    // Backfill existing records missing policy data (fixes N/A in emails)
    let backfilled = 0;
    try {
      const existingWithMissingData = await db
        .select({
          rmId: riskMonitorPolicies.id,
          azContactId: riskMonitorPolicies.azContactId,
        })
        .from(riskMonitorPolicies)
        .where(
          and(
            eq(riskMonitorPolicies.tenantId, tenantId),
            or(
              isNull(riskMonitorPolicies.policyNumber),
              isNull(riskMonitorPolicies.carrier)
            )
          )
        );

      for (const rm of existingWithMissingData) {
        if (!rm.azContactId) continue;
        try {
          const match = await db
            .select({
              policyNumber: policies.policyNumber,
              carrier: policies.carrier,
              expirationDate: policies.expirationDate,
            })
            .from(policies)
            .innerJoin(customers, eq(policies.customerId, customers.id))
            .where(
              and(
                eq(customers.tenantId, tenantId),
                eq(customers.agencyzoomId, rm.azContactId),
                eq(policies.status, "active"),
                sql`${policies.lineOfBusiness} ILIKE '%home%' OR ${policies.lineOfBusiness} ILIKE '%dwelling%'`
              )
            )
            .limit(1);

          if (match.length > 0 && (match[0].policyNumber || match[0].carrier)) {
            // Safely coerce expirationDate to a Date (may be string or null)
            let expDate: Date | null = null;
            if (match[0].expirationDate) {
              const d = match[0].expirationDate instanceof Date
                ? match[0].expirationDate
                : new Date(match[0].expirationDate);
              if (!isNaN(d.getTime())) expDate = d;
            }

            await db
              .update(riskMonitorPolicies)
              .set({
                policyNumber: match[0].policyNumber,
                carrier: match[0].carrier,
                expirationDate: expDate,
                updatedAt: new Date(),
              })
              .where(eq(riskMonitorPolicies.id, rm.rmId));
            backfilled++;
          }
        } catch {
          // Skip individual backfill errors
        }
      }
    } catch (err: any) {
      console.error("[Risk Monitor] Backfill error:", err.message);
    }

    return NextResponse.json({
      success: true,
      stats: {
        totalCustomers: customersWithAddresses.length,
        existingMonitored: existingPolicies.length,
        newImported: imported,
        backfilled,
        errors: errors.length,
      },
      errors: errors.slice(0, 10), // Only show first 10 errors
    });
  } catch (error: any) {
    console.error("[Risk Monitor] Sync error:", error);
    return NextResponse.json(
      { error: "Failed to sync", details: error.message },
      { status: 500 }
    );
  }
}

// GET - Check sync status
export async function GET(request: NextRequest) {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    // Count customers with addresses (excluding leads)
    const [{ customersWithAddresses }] = await db
      .select({
        customersWithAddresses: sql<number>`count(*)::int`,
      })
      .from(customers)
      .where(
        and(
          eq(customers.tenantId, tenantId),
          eq(customers.isArchived, false),
          eq(customers.isLead, false),
          isNotNull(customers.address)
        )
      );

    // Count monitored policies
    const [{ monitoredPolicies }] = await db
      .select({
        monitoredPolicies: sql<number>`count(*)::int`,
      })
      .from(riskMonitorPolicies)
      .where(eq(riskMonitorPolicies.tenantId, tenantId));

    return NextResponse.json({
      success: true,
      stats: {
        customersWithAddresses,
        monitoredPolicies,
        needsSync: customersWithAddresses - monitoredPolicies,
      },
    });
  } catch (error: any) {
    console.error("[Risk Monitor] Sync status error:", error);
    return NextResponse.json(
      { error: "Failed to get sync status", details: error.message },
      { status: 500 }
    );
  }
}
