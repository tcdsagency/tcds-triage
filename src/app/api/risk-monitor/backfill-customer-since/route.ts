/**
 * API Route: /api/risk-monitor/backfill-customer-since
 * Backfills customerSinceDate on existing risk monitor policies
 * by looking up the linked customer's createdAt date.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { customers, riskMonitorPolicies, policies } from "@/db/schema";
import { eq, and, isNull, sql } from "drizzle-orm";

export async function POST(request: NextRequest) {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    // Find policies missing customerSinceDate
    const policiesNeedingBackfill = await db
      .select({
        policyId: riskMonitorPolicies.id,
        contactName: riskMonitorPolicies.contactName,
        contactEmail: riskMonitorPolicies.contactEmail,
        contactPhone: riskMonitorPolicies.contactPhone,
        azContactId: riskMonitorPolicies.azContactId,
      })
      .from(riskMonitorPolicies)
      .where(
        and(
          eq(riskMonitorPolicies.tenantId, tenantId),
          isNull(riskMonitorPolicies.customerSinceDate)
        )
      );

    console.log(`[Backfill] Found ${policiesNeedingBackfill.length} policies needing customerSinceDate`);

    let updated = 0;
    let notFound = 0;

    for (const policy of policiesNeedingBackfill) {
      // Try to find the customer by azContactId first, then by name/email
      let customer;

      if (policy.azContactId) {
        [customer] = await db
          .select({
            id: customers.id,
            customerSince: sql<Date>`(SELECT min(${policies.effectiveDate}) FROM ${policies} WHERE ${policies.customerId} = ${customers.id})`.as('customer_since'),
          })
          .from(customers)
          .where(
            and(
              eq(customers.tenantId, tenantId),
              eq(customers.agencyzoomId, policy.azContactId)
            )
          )
          .limit(1);
      }

      if (!customer && policy.contactEmail) {
        [customer] = await db
          .select({
            id: customers.id,
            customerSince: sql<Date>`(SELECT min(${policies.effectiveDate}) FROM ${policies} WHERE ${policies.customerId} = ${customers.id})`.as('customer_since'),
          })
          .from(customers)
          .where(
            and(
              eq(customers.tenantId, tenantId),
              sql`lower(${customers.email}) = lower(${policy.contactEmail})`
            )
          )
          .limit(1);
      }

      if (!customer && policy.contactName) {
        // Try name match as last resort
        const nameParts = policy.contactName.split(' ');
        const firstName = nameParts[0];
        const lastName = nameParts.slice(1).join(' ') || '';

        if (firstName && lastName) {
          [customer] = await db
            .select({
              id: customers.id,
              customerSince: sql<Date>`(SELECT min(${policies.effectiveDate}) FROM ${policies} WHERE ${policies.customerId} = ${customers.id})`.as('customer_since'),
            })
            .from(customers)
            .where(
              and(
                eq(customers.tenantId, tenantId),
                sql`lower(${customers.firstName}) = lower(${firstName})`,
                sql`lower(${customers.lastName}) = lower(${lastName})`
              )
            )
            .limit(1);
        }
      }

      if (customer?.customerSince) {
        await db
          .update(riskMonitorPolicies)
          .set({ customerSinceDate: customer.customerSince })
          .where(eq(riskMonitorPolicies.id, policy.policyId));
        updated++;
      } else {
        notFound++;
      }
    }

    return NextResponse.json({
      success: true,
      stats: {
        totalNeeded: policiesNeedingBackfill.length,
        updated,
        notFound,
      },
    });
  } catch (error: any) {
    console.error("[Backfill] Error:", error);
    return NextResponse.json(
      { error: "Backfill failed", details: error.message },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    // Count policies missing customerSinceDate
    const [{ missing }] = await db
      .select({
        missing: sql<number>`count(*)::int`,
      })
      .from(riskMonitorPolicies)
      .where(
        and(
          eq(riskMonitorPolicies.tenantId, tenantId),
          isNull(riskMonitorPolicies.customerSinceDate)
        )
      );

    const [{ total }] = await db
      .select({
        total: sql<number>`count(*)::int`,
      })
      .from(riskMonitorPolicies)
      .where(eq(riskMonitorPolicies.tenantId, tenantId));

    return NextResponse.json({
      success: true,
      stats: {
        total,
        missingCustomerSinceDate: missing,
        hasCustomerSinceDate: total - missing,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Status check failed", details: error.message },
      { status: 500 }
    );
  }
}
