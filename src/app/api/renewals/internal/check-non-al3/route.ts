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
import { eq, and, gte, lte, sql } from 'drizzle-orm';
import { logRenewalEvent } from '@/lib/api/renewal-audit';
import { getAgencyZoomClient, type ServiceTicket } from '@/lib/api/agencyzoom';
import { SERVICE_PIPELINES } from '@/lib/api/agencyzoom-service-tickets';
import { getHawkSoftHiddenClient } from '@/lib/api/hawksoft-hidden';

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

    // Fetch active AZ tickets in Renewals pipeline to gate placeholder creation
    const azClient = getAgencyZoomClient();
    const azTickets: ServiceTicket[] = [];
    let azPage = 0;
    const azPageSize = 100;

    while (true) {
      const { data: tickets, total } = await azClient.getServiceTickets({
        pipelineId: SERVICE_PIPELINES.RENEWALS,
        status: 1,
        limit: azPageSize,
        page: azPage,
      });
      azTickets.push(...tickets);
      if (azTickets.length >= total || tickets.length < azPageSize) break;
      azPage++;
    }

    // Build a set of policy numbers from AZ ticket subjects for matching
    const azPolicyNumbers = new Set<string>();
    for (const ticket of azTickets) {
      // Strategy A: "Renewal Review: <name> - <policy>"
      const subjectMatch = ticket.subject.match(/Renewal Review:\s*(.+?)\s*-\s*(\S+)/i);
      if (subjectMatch) {
        azPolicyNumbers.add(subjectMatch[2].trim().toUpperCase());
      }
      // Also add any policy-number-like strings from subject for broad matching
      // (Strategy C: any policy number appearing in subject)
      const words = ticket.subject.split(/[\s,;|/-]+/);
      for (const word of words) {
        const cleaned = word.trim().toUpperCase();
        if (cleaned.length >= 5) {
          azPolicyNumbers.add(cleaned);
        }
      }
    }

    // Build householdId set for customer-based matching
    const azHouseholdIds = new Set(azTickets.map(t => t.householdId));

    // Get customer agencyzoomIds for household matching
    const allCustomerIds = [...new Set(expiringPolicies.map(p => p.customerId))];
    const customerAzIds = new Map<string, string>(); // customerId → agencyzoomId
    if (allCustomerIds.length > 0) {
      // Batch in chunks to avoid query limits
      const CHUNK = 500;
      for (let i = 0; i < allCustomerIds.length; i += CHUNK) {
        const chunk = allCustomerIds.slice(i, i + CHUNK);
        const rows = await db
          .select({ id: customers.id, agencyzoomId: customers.agencyzoomId })
          .from(customers)
          .where(
            and(
              eq(customers.tenantId, tenantId),
              // Use SQL IN for the chunk
              ...[chunk.length > 0 ? sql`${customers.id} IN (${sql.join(chunk.map(id => sql`${id}`), sql`, `)})` : sql`false`]
            )
          );
        for (const row of rows) {
          if (row.agencyzoomId) {
            customerAzIds.set(row.id, row.agencyzoomId);
          }
        }
      }
    }

    let created = 0;
    let skippedExisting = 0;
    let skippedNoAzTicket = 0;

    for (const policy of expiringPolicies) {
      // Gate: only create placeholder if there's a matching AZ ticket
      const policyNumUpper = (policy.policyNumber || '').toUpperCase();
      const hasAzByPolicy = azPolicyNumbers.has(policyNumUpper);
      const customerAzId = customerAzIds.get(policy.customerId);
      const hasAzByHousehold = customerAzId ? azHouseholdIds.has(parseInt(customerAzId, 10)) : false;

      if (!hasAzByPolicy && !hasAzByHousehold) {
        skippedNoAzTicket++;
        continue;
      }
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

      // Try HawkSoft Hidden API for rate change data (non-AL3 carriers)
      let renewalPremium: string | null = null;
      let premiumChangeAmount: string | null = null;
      let premiumChangePercent: string | null = null;
      let renewalSource: string = 'pending';
      let comparisonStatus: string = 'pending_manual_renewal';
      let recommendation: string = 'needs_review';
      let comparisonSummary: Record<string, unknown> = hasBaseline
        ? { note: 'AL3 carrier — renewal file not yet received. Will auto-update when AL3 arrives, or upload PDF manually.' }
        : { note: 'Non-AL3 carrier — upload renewal dec page PDF to compare.' };

      // Attempt Hidden API enrichment
      try {
        const hiddenClient = getHawkSoftHiddenClient();

        // Get customer's HawkSoft client code and last name for UUID resolution
        const [customerInfo] = await db
          .select({
            hawksoftClientCode: customers.hawksoftClientCode,
            lastName: customers.lastName,
          })
          .from(customers)
          .where(eq(customers.id, policy.customerId))
          .limit(1);

        if (customerInfo?.hawksoftClientCode) {
          const cloudUuid = await hiddenClient.resolveCloudUuid(
            customerInfo.hawksoftClientCode,
            customerInfo.lastName
          );

          if (cloudUuid) {
            const cloudClient = await hiddenClient.getClient(cloudUuid);
            const matchingPolicy = cloudClient.policies?.find(
              (p) => p.number === policy.policyNumber
            );

            if (matchingPolicy) {
              const rateChanges = await hiddenClient.getRateChangeHistory(
                cloudUuid,
                matchingPolicy.id
              );

              // Find renewal entry matching expiration date
              const expirationStr = policy.expirationDate.toISOString().split('T')[0];
              const renewalEntry = rateChanges?.find((rc) => {
                const rcDate = rc.effective.split('T')[0];
                return rcDate === expirationStr && (rc.al3_type === 40 || rc.al3_type === 41);
              });

              if (renewalEntry) {
                renewalPremium = String(renewalEntry.premium_amt);
                premiumChangeAmount = String(renewalEntry.premium_amt_chg);
                premiumChangePercent = String(renewalEntry.premium_pct_chg * 100);
                renewalSource = 'hawksoft_cloud';
                comparisonStatus = 'waiting_agent_review';
                comparisonSummary = {
                  note: 'Rate change data from HawkSoft Cloud API',
                  premiumDirection: renewalEntry.premium_amt_chg > 0 ? 'increase' : renewalEntry.premium_amt_chg < 0 ? 'decrease' : 'same',
                  premiumChangeAmount: renewalEntry.premium_amt_chg,
                  premiumChangePercent: renewalEntry.premium_pct_chg * 100,
                  rateChangeEffective: renewalEntry.effective,
                  materialNegativeCount: renewalEntry.premium_amt_chg > 0 ? 1 : 0,
                  materialPositiveCount: renewalEntry.premium_amt_chg < 0 ? 1 : 0,
                  nonMaterialCount: 0,
                  headline: renewalEntry.premium_amt_chg > 0
                    ? `Premium increase of $${Math.abs(renewalEntry.premium_amt_chg).toFixed(0)} (${(renewalEntry.premium_pct_chg * 100).toFixed(1)}%)`
                    : renewalEntry.premium_amt_chg < 0
                      ? `Premium decrease of $${Math.abs(renewalEntry.premium_amt_chg).toFixed(0)} (${(Math.abs(renewalEntry.premium_pct_chg) * 100).toFixed(1)}%)`
                      : 'No premium change',
                };

                // Determine recommendation based on premium change
                const absPctChange = Math.abs(renewalEntry.premium_pct_chg * 100);
                if (renewalEntry.premium_amt_chg > 0 && absPctChange >= 10) {
                  recommendation = 'reshop';
                } else if (renewalEntry.premium_amt_chg > 0 && absPctChange >= 5) {
                  recommendation = 'needs_review';
                } else {
                  recommendation = 'renew_as_is';
                }
              }
            }
          }
        }
      } catch (hiddenApiErr) {
        // Hidden API not configured or failed — fall back to placeholder
        console.warn('[check-non-al3] Hidden API enrichment failed (using placeholder):', hiddenApiErr);
      }

      // Create comparison record (enriched or placeholder)
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
          renewalPremium,
          premiumChangeAmount,
          premiumChangePercent,
          status: comparisonStatus as any,
          recommendation: recommendation as any,
          renewalSource,
          assignedAgentId,
          comparisonSummary,
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
            source: renewalSource === 'hawksoft_cloud' ? 'hawksoft_cloud_enriched' : (hasBaseline ? 'al3_overdue_check' : 'non_al3_check'),
            hasAl3Baseline: !!hasBaseline,
            policyNumber: policy.policyNumber,
            carrierName: policy.carrier,
            expirationDate: policy.expirationDate.toISOString(),
            renewalSource,
          },
          performedBy: 'system',
        });
      }
    }

    return NextResponse.json({
      success: true,
      created,
      skippedExisting,
      skippedNoAzTicket,
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
