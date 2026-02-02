/**
 * API Route: /api/risk-monitor/cleanup-unmonitorable
 *
 * Cleans up properties that can't be monitored:
 * 1. Deactivates PO Box addresses (not physical properties)
 * 2. Fixes malformed addresses (commas in line1, double spaces)
 * 3. Resets lastCheckedAt for unknown-status policies so they get re-scanned
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { riskMonitorPolicies } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";

/**
 * Find PO Box policies that should be deactivated
 */
async function findPOBoxPolicies(tenantId: string) {
  return db
    .select({
      id: riskMonitorPolicies.id,
      addressLine1: riskMonitorPolicies.addressLine1,
      city: riskMonitorPolicies.city,
      state: riskMonitorPolicies.state,
      contactName: riskMonitorPolicies.contactName,
      policyNumber: riskMonitorPolicies.policyNumber,
    })
    .from(riskMonitorPolicies)
    .where(
      and(
        eq(riskMonitorPolicies.tenantId, tenantId),
        eq(riskMonitorPolicies.isActive, true),
        sql`(
          ${riskMonitorPolicies.addressLine1} ILIKE '%PO BOX%'
          OR ${riskMonitorPolicies.addressLine1} ILIKE '%P.O. BOX%'
          OR ${riskMonitorPolicies.addressLine1} ILIKE '%P O BOX%'
          OR ${riskMonitorPolicies.addressLine1} ILIKE '%P.O.BOX%'
        )`
      )
    );
}

/**
 * Find addresses with malformed formatting (commas, double spaces)
 */
async function findMalformedAddresses(tenantId: string) {
  return db
    .select({
      id: riskMonitorPolicies.id,
      addressLine1: riskMonitorPolicies.addressLine1,
      city: riskMonitorPolicies.city,
      state: riskMonitorPolicies.state,
      contactName: riskMonitorPolicies.contactName,
    })
    .from(riskMonitorPolicies)
    .where(
      and(
        eq(riskMonitorPolicies.tenantId, tenantId),
        eq(riskMonitorPolicies.isActive, true),
        sql`(
          ${riskMonitorPolicies.addressLine1} LIKE '%,%'
          OR ${riskMonitorPolicies.addressLine1} LIKE '%  %'
        )`
      )
    );
}

/**
 * Fix a malformed address line: remove commas, collapse double spaces
 */
function fixAddressLine(line: string): string {
  return line
    .replace(/,/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * GET - Preview what would be cleaned up
 */
export async function GET() {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    const poBoxPolicies = await findPOBoxPolicies(tenantId);
    const malformedPolicies = await findMalformedAddresses(tenantId);

    // Count unknown-status policies
    const [unknownCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(riskMonitorPolicies)
      .where(
        and(
          eq(riskMonitorPolicies.tenantId, tenantId),
          eq(riskMonitorPolicies.isActive, true),
          eq(riskMonitorPolicies.currentStatus, "unknown")
        )
      );

    return NextResponse.json({
      success: true,
      preview: {
        poBoxPolicies: {
          count: poBoxPolicies.length,
          items: poBoxPolicies.map((p) => ({
            id: p.id,
            address: p.addressLine1,
            city: p.city,
            state: p.state,
            contact: p.contactName,
            policy: p.policyNumber,
          })),
        },
        malformedAddresses: {
          count: malformedPolicies.length,
          items: malformedPolicies.map((p) => ({
            id: p.id,
            current: p.addressLine1,
            fixed: fixAddressLine(p.addressLine1),
            city: p.city,
            contact: p.contactName,
          })),
        },
        unknownStatusPolicies: {
          count: unknownCount?.count || 0,
          note: "These will have lastCheckedAt reset so they get re-scanned with improved normalization",
        },
      },
    });
  } catch (error: any) {
    console.error("[Cleanup Unmonitorable] Preview error:", error);
    return NextResponse.json(
      { error: "Preview failed", details: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST - Execute the cleanup
 */
export async function POST(request: NextRequest) {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    const body = await request.json().catch(() => ({}));
    const {
      deactivatePoBoxes = true,
      fixMalformed = true,
      resetUnknown = true,
    } = body;

    const results: Record<string, any> = {};

    // 1. Deactivate PO Box policies
    if (deactivatePoBoxes) {
      const poBoxPolicies = await findPOBoxPolicies(tenantId);

      for (const policy of poBoxPolicies) {
        await db
          .update(riskMonitorPolicies)
          .set({
            isActive: false,
            lastCheckError: "Deactivated: PO Box address cannot be monitored for property listings",
            updatedAt: new Date(),
          })
          .where(eq(riskMonitorPolicies.id, policy.id));
      }

      results.poBoxesDeactivated = {
        count: poBoxPolicies.length,
        addresses: poBoxPolicies.map((p) => `${p.addressLine1}, ${p.city}, ${p.state}`),
      };
    }

    // 2. Fix malformed addresses
    if (fixMalformed) {
      const malformedPolicies = await findMalformedAddresses(tenantId);
      let fixedCount = 0;
      const fixes: Array<{ id: string; before: string; after: string }> = [];

      for (const policy of malformedPolicies) {
        const fixed = fixAddressLine(policy.addressLine1);
        if (fixed !== policy.addressLine1) {
          await db
            .update(riskMonitorPolicies)
            .set({
              addressLine1: fixed,
              updatedAt: new Date(),
            })
            .where(eq(riskMonitorPolicies.id, policy.id));

          fixedCount++;
          fixes.push({
            id: policy.id,
            before: policy.addressLine1,
            after: fixed,
          });
        }
      }

      results.malformedFixed = {
        count: fixedCount,
        fixes,
      };
    }

    // 3. Reset lastCheckedAt for unknown-status policies
    if (resetUnknown) {
      await db
        .update(riskMonitorPolicies)
        .set({
          lastCheckedAt: null,
          checkErrorCount: 0,
          lastCheckError: null,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(riskMonitorPolicies.tenantId, tenantId),
            eq(riskMonitorPolicies.isActive, true),
            eq(riskMonitorPolicies.currentStatus, "unknown")
          )
        );

      const [resetCount] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(riskMonitorPolicies)
        .where(
          and(
            eq(riskMonitorPolicies.tenantId, tenantId),
            eq(riskMonitorPolicies.isActive, true),
            eq(riskMonitorPolicies.currentStatus, "unknown"),
            sql`${riskMonitorPolicies.lastCheckedAt} IS NULL`
          )
        );

      results.unknownPoliciesReset = {
        count: resetCount?.count || 0,
        note: "These policies will be re-scanned on the next monitoring cycle with improved address normalization",
      };
    }

    return NextResponse.json({
      success: true,
      results,
    });
  } catch (error: any) {
    console.error("[Cleanup Unmonitorable] Error:", error);
    return NextResponse.json(
      { error: "Cleanup failed", details: error.message },
      { status: 500 }
    );
  }
}
