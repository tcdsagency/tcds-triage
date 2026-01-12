/**
 * API Route: /api/risk-monitor/cleanup-inactive-policies
 * Deactivates monitored properties where the customer no longer has an active home policy.
 * This ensures the risk monitor only checks properties for customers with active homeowners coverage.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { riskMonitorPolicies, policies, customers } from "@/db/schema";
import { eq, and, sql, inArray } from "drizzle-orm";

export async function POST(request: NextRequest) {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    const body = await request.json().catch(() => ({}));
    const dryRun = body.dryRun === true;

    // Find all customers who have an active home policy
    const customersWithActiveHome = await db
      .selectDistinct({ agencyzoomId: customers.agencyzoomId })
      .from(customers)
      .innerJoin(policies, eq(policies.customerId, customers.id))
      .where(
        and(
          eq(customers.tenantId, tenantId),
          eq(policies.status, "active"),
          sql`${policies.lineOfBusiness} ILIKE '%home%' OR ${policies.lineOfBusiness} ILIKE '%dwelling%' OR ${policies.lineOfBusiness} ILIKE '%property%'`
        )
      );

    const activeAzIds = new Set(
      customersWithActiveHome
        .map((c) => c.agencyzoomId)
        .filter(Boolean) as string[]
    );

    console.log(`[Cleanup] Found ${activeAzIds.size} customers with active home policies`);

    // Get all active monitored policies
    const monitoredPolicies = await db
      .select({
        id: riskMonitorPolicies.id,
        azContactId: riskMonitorPolicies.azContactId,
        contactName: riskMonitorPolicies.contactName,
        addressLine1: riskMonitorPolicies.addressLine1,
        city: riskMonitorPolicies.city,
      })
      .from(riskMonitorPolicies)
      .where(
        and(
          eq(riskMonitorPolicies.tenantId, tenantId),
          eq(riskMonitorPolicies.isActive, true)
        )
      );

    // Find policies to deactivate (not in active home policy list)
    const toDeactivate = monitoredPolicies.filter(
      (p) => !p.azContactId || !activeAzIds.has(p.azContactId)
    );

    console.log(`[Cleanup] Found ${toDeactivate.length} policies to deactivate`);

    if (dryRun) {
      return NextResponse.json({
        success: true,
        dryRun: true,
        stats: {
          totalMonitored: monitoredPolicies.length,
          customersWithActiveHome: activeAzIds.size,
          toDeactivate: toDeactivate.length,
          willKeepActive: monitoredPolicies.length - toDeactivate.length,
        },
        preview: toDeactivate.slice(0, 20).map((p) => ({
          name: p.contactName,
          address: `${p.addressLine1}, ${p.city}`,
          reason: !p.azContactId ? "No AgencyZoom ID" : "No active home policy",
        })),
      });
    }

    // Deactivate policies without active home coverage
    if (toDeactivate.length > 0) {
      const idsToDeactivate = toDeactivate.map((p) => p.id);

      await db
        .update(riskMonitorPolicies)
        .set({
          isActive: false,
          updatedAt: new Date(),
        })
        .where(inArray(riskMonitorPolicies.id, idsToDeactivate));
    }

    return NextResponse.json({
      success: true,
      stats: {
        totalMonitored: monitoredPolicies.length,
        customersWithActiveHome: activeAzIds.size,
        deactivated: toDeactivate.length,
        stillActive: monitoredPolicies.length - toDeactivate.length,
      },
    });
  } catch (error: any) {
    console.error("[Cleanup] Error:", error);
    return NextResponse.json(
      { error: "Cleanup failed", details: error.message },
      { status: 500 }
    );
  }
}

// GET - Preview what would be deactivated
export async function GET(request: NextRequest) {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    // Find all customers who have an active home policy
    const customersWithActiveHome = await db
      .selectDistinct({ agencyzoomId: customers.agencyzoomId })
      .from(customers)
      .innerJoin(policies, eq(policies.customerId, customers.id))
      .where(
        and(
          eq(customers.tenantId, tenantId),
          eq(policies.status, "active"),
          sql`${policies.lineOfBusiness} ILIKE '%home%' OR ${policies.lineOfBusiness} ILIKE '%dwelling%' OR ${policies.lineOfBusiness} ILIKE '%property%'`
        )
      );

    const activeAzIds = new Set(
      customersWithActiveHome
        .map((c) => c.agencyzoomId)
        .filter(Boolean) as string[]
    );

    // Get all active monitored policies
    const monitoredPolicies = await db
      .select({
        id: riskMonitorPolicies.id,
        azContactId: riskMonitorPolicies.azContactId,
        contactName: riskMonitorPolicies.contactName,
        addressLine1: riskMonitorPolicies.addressLine1,
        city: riskMonitorPolicies.city,
      })
      .from(riskMonitorPolicies)
      .where(
        and(
          eq(riskMonitorPolicies.tenantId, tenantId),
          eq(riskMonitorPolicies.isActive, true)
        )
      );

    // Find policies that would be deactivated
    const toDeactivate = monitoredPolicies.filter(
      (p) => !p.azContactId || !activeAzIds.has(p.azContactId)
    );

    return NextResponse.json({
      success: true,
      stats: {
        totalMonitored: monitoredPolicies.length,
        customersWithActiveHome: activeAzIds.size,
        wouldDeactivate: toDeactivate.length,
        wouldKeepActive: monitoredPolicies.length - toDeactivate.length,
      },
      preview: toDeactivate.slice(0, 20).map((p) => ({
        name: p.contactName,
        address: `${p.addressLine1}, ${p.city}`,
        reason: !p.azContactId ? "No AgencyZoom ID" : "No active home policy",
      })),
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Preview failed", details: error.message },
      { status: 500 }
    );
  }
}
