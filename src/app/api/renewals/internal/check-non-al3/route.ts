/**
 * POST /api/renewals/internal/check-non-al3
 * Daily check: find active policies expiring within 45 days that have no AL3 baseline
 * and no existing comparison record, then create pending_manual_renewal records.
 *
 * Called by the renewal worker's check-non-al3-renewals scheduled job.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { policies, renewalBaselines, renewalComparisons, customers } from '@/db/schema';
import { eq, and, gte, lte, sql } from 'drizzle-orm';
import { logRenewalEvent } from '@/lib/api/renewal-audit';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const tenantId = body.tenantId || process.env.DEFAULT_TENANT_ID;

    if (!tenantId) {
      return NextResponse.json({ success: false, error: 'tenantId required' }, { status: 400 });
    }

    const now = new Date();
    const futureDate = new Date(now.getTime() + 45 * 24 * 60 * 60 * 1000);

    // Find active policies expiring within 45 days
    const expiringPolicies = await db
      .select({
        id: policies.id,
        tenantId: policies.tenantId,
        customerId: policies.customerId,
        policyNumber: policies.policyNumber,
        carrier: policies.carrier,
        lineOfBusiness: policies.lineOfBusiness,
        expirationDate: policies.expirationDate,
        premium: policies.premium,
        producerId: policies.producerId,
      })
      .from(policies)
      .where(
        and(
          eq(policies.tenantId, tenantId),
          eq(policies.status, 'active'),
          gte(policies.expirationDate, now),
          lte(policies.expirationDate, futureDate)
        )
      );

    if (expiringPolicies.length === 0) {
      return NextResponse.json({ success: true, created: 0, message: 'No expiring policies found' });
    }

    let created = 0;
    let skippedBaseline = 0;
    let skippedExisting = 0;

    for (const policy of expiringPolicies) {
      // Check if AL3 baseline exists for this policy
      const [hasBaseline] = await db
        .select({ id: renewalBaselines.id })
        .from(renewalBaselines)
        .where(
          and(
            eq(renewalBaselines.tenantId, tenantId),
            eq(renewalBaselines.policyNumber, policy.policyNumber)
          )
        )
        .limit(1);

      if (hasBaseline) {
        skippedBaseline++;
        continue;
      }

      // Check if comparison already exists for this policy + effective date
      const [hasComparison] = await db
        .select({ id: renewalComparisons.id })
        .from(renewalComparisons)
        .where(
          and(
            eq(renewalComparisons.tenantId, tenantId),
            eq(renewalComparisons.policyNumber, policy.policyNumber),
            eq(renewalComparisons.renewalEffectiveDate, policy.expirationDate)
          )
        )
        .limit(1);

      if (hasComparison) {
        skippedExisting++;
        continue;
      }

      // Resolve assigned agent: prefer policy producer, fallback to customer producer
      let assignedAgentId: string | null = policy.producerId || null;
      if (!assignedAgentId) {
        const [customer] = await db
          .select({ producerId: customers.producerId })
          .from(customers)
          .where(eq(customers.id, policy.customerId))
          .limit(1);
        assignedAgentId = customer?.producerId || null;
      }

      // Create pending_manual_renewal comparison record
      const [comparison] = await db
        .insert(renewalComparisons)
        .values({
          tenantId,
          customerId: policy.customerId,
          policyId: policy.id,
          policyNumber: policy.policyNumber,
          carrierName: policy.carrier,
          lineOfBusiness: policy.lineOfBusiness,
          renewalEffectiveDate: policy.expirationDate,
          currentPremium: policy.premium,
          status: 'pending_manual_renewal',
          recommendation: 'needs_review',
          renewalSource: 'pending',
          assignedAgentId,
        })
        .onConflictDoNothing()
        .returning();

      if (comparison) {
        created++;

        // Log audit event
        await logRenewalEvent({
          tenantId,
          renewalComparisonId: comparison.id,
          eventType: 'ingested',
          eventData: {
            source: 'non_al3_check',
            policyNumber: policy.policyNumber,
            carrierName: policy.carrier,
            expirationDate: policy.expirationDate.toISOString(),
          },
          performedBy: 'system',
        });
      }
    }

    return NextResponse.json({
      success: true,
      created,
      skippedBaseline,
      skippedExisting,
      totalChecked: expiringPolicies.length,
    });
  } catch (error) {
    console.error('[Internal API] check-non-al3 error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed' },
      { status: 500 }
    );
  }
}
