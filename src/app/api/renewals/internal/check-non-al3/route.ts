/**
 * POST /api/renewals/internal/check-non-al3
 * Daily check: find active policies expiring within 45 days that have no
 * existing comparison record, then create pending_manual_renewal placeholders.
 *
 * Catches two cases:
 * 1. Non-AL3 carriers (Travelers, Heritage, etc.) — agent must upload PDF dec page
 * 2. AL3 carriers where the renewal file hasn't arrived yet — placeholder ensures
 *    the policy doesn't silently expire; if AL3 arrives later, the worker will
 *    upgrade this placeholder with full comparison data.
 *
 * Called by the renewal worker's check-non-al3-renewals scheduled job.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { policies, renewalBaselines, renewalComparisons, customers } from '@/db/schema';
import { eq, and, gte, lte } from 'drizzle-orm';
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
    let skippedExisting = 0;

    for (const policy of expiringPolicies) {
      // Check if any comparison already exists for this policy + effective date
      // (match by policy number only, ignoring carrier name variations between
      //  HawkSoft names and AL3 carrier names)
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

      // Check if AL3 baseline exists — determines whether this is a non-AL3 carrier
      // or an AL3 carrier whose renewal file is overdue
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
          comparisonSummary: hasBaseline
            ? { note: 'AL3 carrier — renewal file not yet received. Will auto-update when AL3 arrives, or upload PDF manually.' }
            : { note: 'Non-AL3 carrier — upload renewal dec page PDF to compare.' },
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
            source: hasBaseline ? 'al3_overdue_check' : 'non_al3_check',
            hasAl3Baseline: !!hasBaseline,
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
