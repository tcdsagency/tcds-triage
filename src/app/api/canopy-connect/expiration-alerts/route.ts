/**
 * Canopy Policy Expiration Alerts
 * ================================
 * Scans Canopy pull data for policies expiring soon and creates alerts.
 * Can be called via cron or manually.
 *
 * GET  /api/canopy-connect/expiration-alerts - List expiring policies
 * POST /api/canopy-connect/expiration-alerts - Scan and create alerts
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { canopyConnectPulls, policyNotices } from "@/db/schema";
import { eq, and, sql, gte, lte, not, inArray } from "drizzle-orm";

interface ExpiringPolicy {
  pullId: string;
  customerId: string | null;
  customerName: string;
  carrierName: string | null;
  policyNumber: string | null;
  policyType: string | null;
  expiryDate: string;
  daysUntilExpiry: number;
  premium: number;
}

// =============================================================================
// GET - List Expiring Policies
// =============================================================================

export async function GET(request: NextRequest) {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const daysAhead = parseInt(searchParams.get("days") || "30");

    const expiringPolicies = await findExpiringPolicies(tenantId, daysAhead);

    // Group by urgency
    const critical = expiringPolicies.filter(p => p.daysUntilExpiry <= 7);
    const warning = expiringPolicies.filter(p => p.daysUntilExpiry > 7 && p.daysUntilExpiry <= 14);
    const upcoming = expiringPolicies.filter(p => p.daysUntilExpiry > 14);

    return NextResponse.json({
      success: true,
      daysAhead,
      totalCount: expiringPolicies.length,
      counts: {
        critical: critical.length,
        warning: warning.length,
        upcoming: upcoming.length,
      },
      policies: {
        critical,
        warning,
        upcoming,
      },
    });
  } catch (error) {
    console.error("[Canopy Expiration] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to check expirations" },
      { status: 500 }
    );
  }
}

// =============================================================================
// POST - Scan and Create Alerts
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    const body = await request.json().catch(() => ({}));
    const daysAhead = body.daysAhead || 30;

    const expiringPolicies = await findExpiringPolicies(tenantId, daysAhead);

    let alertsCreated = 0;
    let alertsSkipped = 0;

    for (const policy of expiringPolicies) {
      // Check if we already have an alert for this policy (using rawPayload for Canopy-specific data)
      const existingAlert = await db
        .select({ id: policyNotices.id })
        .from(policyNotices)
        .where(and(
          eq(policyNotices.tenantId, tenantId),
          eq(policyNotices.noticeType, "policy"),
          sql`${policyNotices.rawPayload}->>'canopyPullId' = ${policy.pullId}`,
          sql`${policyNotices.rawPayload}->>'source' = 'canopy_expiration'`
        ))
        .limit(1);

      if (existingAlert.length > 0) {
        alertsSkipped++;
        continue;
      }

      // Determine urgency based on days until expiry (uses schema enum: low, medium, high, urgent)
      let urgency: "low" | "medium" | "high" | "urgent" = "low";
      if (policy.daysUntilExpiry <= 7) urgency = "urgent";
      else if (policy.daysUntilExpiry <= 14) urgency = "high";
      else if (policy.daysUntilExpiry <= 21) urgency = "medium";

      // Create the alert using 'policy' notice type
      await db.insert(policyNotices).values({
        tenantId,
        noticeType: "policy", // Use 'policy' type for expirations
        urgency,
        customerId: policy.customerId,
        insuredName: policy.customerName,
        policyNumber: policy.policyNumber,
        carrier: policy.carrierName,
        lineOfBusiness: policy.policyType,
        dueDate: policy.expiryDate, // Use dueDate for expiration date
        title: `Policy Expiring: ${policy.policyType || 'Insurance'} - ${policy.customerName}`,
        description: `${policy.carrierName || 'Policy'} ${policy.policyNumber ? `#${policy.policyNumber}` : ''} expires in ${policy.daysUntilExpiry} days (${new Date(policy.expiryDate).toLocaleDateString()})`,
        rawPayload: {
          source: "canopy_expiration",
          canopyPullId: policy.pullId,
          policyNumber: policy.policyNumber,
          policyType: policy.policyType,
          daysUntilExpiry: policy.daysUntilExpiry,
          premium: policy.premium,
          expiryDate: policy.expiryDate,
        },
      });

      alertsCreated++;
      console.log(`[Canopy Expiration] Created alert for ${policy.customerName} - ${policy.policyType} expiring ${policy.expiryDate}`);
    }

    return NextResponse.json({
      success: true,
      scanned: expiringPolicies.length,
      alertsCreated,
      alertsSkipped,
      message: `Created ${alertsCreated} new expiration alerts, skipped ${alertsSkipped} existing`,
    });
  } catch (error) {
    console.error("[Canopy Expiration] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create alerts" },
      { status: 500 }
    );
  }
}

// =============================================================================
// Helper Functions
// =============================================================================

async function findExpiringPolicies(tenantId: string, daysAhead: number): Promise<ExpiringPolicy[]> {
  const today = new Date();
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + daysAhead);

  // Get all successful pulls with policy data
  const pulls = await db
    .select({
      id: canopyConnectPulls.id,
      pullId: canopyConnectPulls.pullId,
      firstName: canopyConnectPulls.firstName,
      lastName: canopyConnectPulls.lastName,
      carrierFriendlyName: canopyConnectPulls.carrierFriendlyName,
      policies: canopyConnectPulls.policies,
      matchedCustomerId: canopyConnectPulls.matchedCustomerId,
    })
    .from(canopyConnectPulls)
    .where(and(
      eq(canopyConnectPulls.tenantId, tenantId),
      eq(canopyConnectPulls.pullStatus, "SUCCESS"),
      sql`${canopyConnectPulls.policies} IS NOT NULL`,
      sql`jsonb_array_length(${canopyConnectPulls.policies}) > 0`
    ));

  const expiringPolicies: ExpiringPolicy[] = [];

  for (const pull of pulls) {
    const policies = (pull.policies as any[]) || [];
    const customerName = `${pull.firstName || ''} ${pull.lastName || ''}`.trim() || 'Unknown';

    for (const policy of policies) {
      const expiryDateStr = policy.expiry_date || policy.expiryDate || policy.expiration_date;
      if (!expiryDateStr) continue;

      const expiryDate = new Date(expiryDateStr);
      if (isNaN(expiryDate.getTime())) continue;

      // Check if within our date range
      if (expiryDate < today || expiryDate > futureDate) continue;

      const daysUntilExpiry = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      expiringPolicies.push({
        pullId: pull.pullId,
        customerId: pull.matchedCustomerId,
        customerName,
        carrierName: pull.carrierFriendlyName || policy.carrier_name || policy.carrierName,
        policyNumber: policy.carrier_policy_number || policy.policyNumber || policy.policy_number,
        policyType: policy.policy_type || policy.policyType || policy.type,
        expiryDate: expiryDateStr,
        daysUntilExpiry,
        premium: policy.total_premium_cents || policy.premiumCents || policy.premium || 0,
      });
    }
  }

  // Sort by days until expiry (most urgent first)
  expiringPolicies.sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);

  return expiringPolicies;
}
