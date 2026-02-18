/**
 * POST /api/renewals/internal/az-sync
 * Two-way sync between renewal candidates and AgencyZoom Renewals pipeline tickets.
 *
 * Called by the az-renewal-sync scheduled job every 30 minutes.
 *
 * Phase 1 — Match candidates to tickets:
 *   Finds candidates in 'awaiting_az_ticket' status and matches them to active
 *   AZ tickets using subject parsing, household mapping, and policy number search.
 *
 * Phase 2 — Create placeholders for unmatched tickets:
 *   AZ tickets that didn't match any candidate get a 'pending_manual_renewal'
 *   comparison record so agents see them in the triage dashboard immediately.
 *   These placeholders get upgraded when AL3 data arrives, or the agent can
 *   upload a PDF dec page manually.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { renewalCandidates, renewalComparisons, customers, policies, users } from '@/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { getAgencyZoomClient, type ServiceTicket } from '@/lib/api/agencyzoom';
import { SERVICE_PIPELINES } from '@/lib/api/agencyzoom-service-tickets';
import { logRenewalEvent } from '@/lib/api/renewal-audit';

interface MatchedPair {
  candidateId: string;
  tenantId: string;
  batchId: string;
  azTicketId: number;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const tenantId = body.tenantId || process.env.DEFAULT_TENANT_ID;

    if (!tenantId) {
      return NextResponse.json({ success: false, error: 'tenantId required' }, { status: 400 });
    }

    // 1. Fetch all active AZ tickets in Renewals pipeline (paginated)
    const azClient = getAgencyZoomClient();
    const allTickets: ServiceTicket[] = [];
    let page = 0;
    const pageSize = 100;

    while (true) {
      const { data: tickets, total } = await azClient.getServiceTickets({
        pipelineId: SERVICE_PIPELINES.RENEWALS,
        status: 1, // Active
        limit: pageSize,
        page,
      });

      allTickets.push(...tickets);
      if (allTickets.length >= total || tickets.length < pageSize) break;
      page++;
    }

    if (allTickets.length === 0) {
      return NextResponse.json({ success: true, matched: 0, placeholdersCreated: 0, message: 'No active AZ renewal tickets' });
    }

    // 2. Fetch all candidates awaiting AZ ticket match
    const pendingCandidates = await db
      .select({
        id: renewalCandidates.id,
        tenantId: renewalCandidates.tenantId,
        batchId: renewalCandidates.batchId,
        policyNumber: renewalCandidates.policyNumber,
        customerId: renewalCandidates.customerId,
        effectiveDate: renewalCandidates.effectiveDate,
        createdAt: renewalCandidates.createdAt,
      })
      .from(renewalCandidates)
      .where(
        and(
          eq(renewalCandidates.tenantId, tenantId),
          eq(renewalCandidates.status, 'awaiting_az_ticket')
        )
      );

    // =========================================================================
    // PHASE 1: Match candidates to tickets
    // =========================================================================

    const matched: MatchedPair[] = [];
    const matchedCandidateIds = new Set<string>();
    const matchedTicketIds = new Set<number>();

    if (pendingCandidates.length > 0) {
      // Build policy number → candidate(s) map
      const policyToCandidates = new Map<string, typeof pendingCandidates>();
      for (const c of pendingCandidates) {
        if (!c.policyNumber) continue;
        const normalized = c.policyNumber.trim().toUpperCase();
        const existing = policyToCandidates.get(normalized) || [];
        existing.push(c);
        policyToCandidates.set(normalized, existing);
      }

      // Build householdId → candidates via customer.agencyzoomId mapping
      const customerIds = [...new Set(pendingCandidates.filter(c => c.customerId).map(c => c.customerId!))];
      const customerAzMap = new Map<string, string>(); // agencyzoomId → customerId
      if (customerIds.length > 0) {
        const customerRows = await db
          .select({ id: customers.id, agencyzoomId: customers.agencyzoomId })
          .from(customers)
          .where(sql`${customers.id} IN (${sql.join(customerIds.map(id => sql`${id}`), sql`, `)})`);

        for (const row of customerRows) {
          if (row.agencyzoomId) {
            customerAzMap.set(row.agencyzoomId, row.id);
          }
        }
      }

      const householdToCandidates = new Map<number, typeof pendingCandidates>();
      for (const c of pendingCandidates) {
        if (!c.customerId) continue;
        for (const [azId, custId] of customerAzMap.entries()) {
          if (custId === c.customerId) {
            const hhId = parseInt(azId, 10);
            if (!isNaN(hhId)) {
              const existing = householdToCandidates.get(hhId) || [];
              existing.push(c);
              householdToCandidates.set(hhId, existing);
            }
            break;
          }
        }
      }

      // Match tickets to candidates
      for (const ticket of allTickets) {
        let ticketMatched = false;

        // Strategy A: Parse subject "Renewal Review: <name> - <policy>"
        const subjectMatch = ticket.subject.match(/Renewal Review:\s*(.+?)\s*-\s*(\S+)/i);
        if (subjectMatch) {
          const policyFromSubject = subjectMatch[2].trim().toUpperCase();
          const candidates = policyToCandidates.get(policyFromSubject);
          if (candidates && candidates.length > 0) {
            for (const c of candidates) {
              if (!matchedCandidateIds.has(c.id)) {
                matched.push({ candidateId: c.id, tenantId: c.tenantId, batchId: c.batchId, azTicketId: ticket.id });
                matchedCandidateIds.add(c.id);
                ticketMatched = true;
              }
            }
            if (ticketMatched) { matchedTicketIds.add(ticket.id); continue; }
          }
        }

        // Strategy B: Household ID → customer → single pending candidate auto-match
        if (ticket.householdId) {
          const candidates = householdToCandidates.get(ticket.householdId);
          if (candidates && candidates.length === 1 && !matchedCandidateIds.has(candidates[0].id)) {
            matched.push({
              candidateId: candidates[0].id,
              tenantId: candidates[0].tenantId,
              batchId: candidates[0].batchId,
              azTicketId: ticket.id,
            });
            matchedCandidateIds.add(candidates[0].id);
            matchedTicketIds.add(ticket.id);
            continue;
          }
        }

        // Strategy C: Subject contains policy number anywhere
        const subjectUpper = ticket.subject.toUpperCase();
        for (const [policyNum, candidates] of policyToCandidates.entries()) {
          if (subjectUpper.includes(policyNum)) {
            for (const c of candidates) {
              if (!matchedCandidateIds.has(c.id)) {
                matched.push({ candidateId: c.id, tenantId: c.tenantId, batchId: c.batchId, azTicketId: ticket.id });
                matchedCandidateIds.add(c.id);
                ticketMatched = true;
              }
            }
          }
        }
        if (ticketMatched) matchedTicketIds.add(ticket.id);
      }

      // Stale candidate cleanup: 90+ days past effectiveDate with no match
      const staleThreshold = new Date();
      staleThreshold.setDate(staleThreshold.getDate() - 90);

      const staleCandidates = pendingCandidates.filter(
        (c) => c.effectiveDate && new Date(c.effectiveDate) < staleThreshold && !matchedCandidateIds.has(c.id)
      );

      for (const stale of staleCandidates) {
        await db
          .update(renewalCandidates)
          .set({
            status: 'failed',
            errorMessage: 'No matching AZ ticket found within 90 days of effective date',
            updatedAt: new Date(),
          })
          .where(eq(renewalCandidates.id, stale.id));
      }
    }

    // =========================================================================
    // PHASE 2: Create placeholders for unmatched tickets
    // =========================================================================
    // Tickets that didn't match any candidate may be for non-AL3 carriers or
    // renewals where AL3 hasn't arrived yet. Create pending_manual_renewal
    // comparison records so agents see them in the dashboard.

    const unmatchedTickets = allTickets.filter(t => !matchedTicketIds.has(t.id));
    let placeholdersCreated = 0;

    if (unmatchedTickets.length > 0) {
      // Build householdId → customer mapping for all unmatched ticket households
      const unmatchedHouseholdIds = [...new Set(unmatchedTickets.map(t => t.householdId).filter(Boolean))];
      const householdToCustomer = new Map<number, { customerId: string; producerId: string | null }>();

      if (unmatchedHouseholdIds.length > 0) {
        const customerRows = await db
          .select({ id: customers.id, agencyzoomId: customers.agencyzoomId, producerId: customers.producerId })
          .from(customers)
          .where(
            and(
              eq(customers.tenantId, tenantId),
              sql`${customers.agencyzoomId} IN (${sql.join(unmatchedHouseholdIds.map(id => sql`${id.toString()}`), sql`, `)})`
            )
          );

        for (const row of customerRows) {
          if (row.agencyzoomId) {
            const hhId = parseInt(row.agencyzoomId, 10);
            if (!isNaN(hhId)) {
              householdToCustomer.set(hhId, { customerId: row.id, producerId: row.producerId });
            }
          }
        }
      }

      // Build AZ CSR ID → user ID mapping for agent assignment
      const unmatchedCsrIds = [...new Set(unmatchedTickets.map(t => t.csr).filter(Boolean))];
      const csrToUserId = new Map<number, string>(); // AZ CSR ID → users.id
      if (unmatchedCsrIds.length > 0) {
        const userRows = await db
          .select({ id: users.id, agencyzoomId: users.agencyzoomId })
          .from(users)
          .where(
            and(
              eq(users.tenantId, tenantId),
              sql`${users.agencyzoomId} IN (${sql.join(unmatchedCsrIds.map(id => sql`${id.toString()}`), sql`, `)})`
            )
          );
        for (const row of userRows) {
          if (row.agencyzoomId) {
            const csrId = parseInt(row.agencyzoomId, 10);
            if (!isNaN(csrId)) {
              csrToUserId.set(csrId, row.id);
            }
          }
        }
      }

      for (const ticket of unmatchedTickets) {
        try {
          // Try to resolve the ticket to a customer
          const customerInfo = ticket.householdId ? householdToCustomer.get(ticket.householdId) : undefined;
          const customerId = customerInfo?.customerId || null;

          // Try to extract policy number from subject
          let policyNumber: string | null = null;
          const subjectMatch = ticket.subject.match(/Renewal Review:\s*(.+?)\s*-\s*(\S+)/i);
          if (subjectMatch) {
            policyNumber = subjectMatch[2].trim();
          }

          // Try to find a matching policy for richer placeholder data
          let matchedPolicy: {
            id: string;
            policyNumber: string;
            carrier: string | null;
            lineOfBusiness: string;
            expirationDate: Date;
            premium: string | null;
            producerId: string | null;
          } | null = null;

          if (policyNumber && customerId) {
            // Best match: policy number + customer
            const [policy] = await db
              .select({
                id: policies.id,
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
                  eq(policies.customerId, customerId),
                  eq(policies.policyNumber, policyNumber),
                  eq(policies.status, 'active')
                )
              )
              .limit(1);
            matchedPolicy = policy || null;
          } else if (customerId) {
            // Household match only — find the soonest-expiring active policy
            // (most likely the one the renewal ticket is about)
            const { asc: ascOrder, gte } = await import('drizzle-orm');
            const now = new Date();
            const [policy] = await db
              .select({
                id: policies.id,
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
                  eq(policies.customerId, customerId),
                  eq(policies.status, 'active'),
                  gte(policies.expirationDate, now)
                )
              )
              .orderBy(ascOrder(policies.expirationDate))
              .limit(1);
            matchedPolicy = policy || null;
          }

          // Use policy data if found, otherwise use what we have from the ticket
          const effectiveDate = matchedPolicy?.expirationDate || null;
          const resolvedPolicyNumber = matchedPolicy?.policyNumber || policyNumber;

          // Check if a comparison already exists for this policy + effective date
          // (or for this AZ ticket ID)
          const existingChecks = [];
          if (resolvedPolicyNumber && effectiveDate) {
            const [existing] = await db
              .select({ id: renewalComparisons.id })
              .from(renewalComparisons)
              .where(
                and(
                  eq(renewalComparisons.tenantId, tenantId),
                  eq(renewalComparisons.policyNumber, resolvedPolicyNumber),
                  eq(renewalComparisons.renewalEffectiveDate, effectiveDate)
                )
              )
              .limit(1);
            if (existing) continue;
          }

          // Also check by AZ ticket ID to avoid duplicates
          const [existingBySr] = await db
            .select({ id: renewalComparisons.id })
            .from(renewalComparisons)
            .where(
              and(
                eq(renewalComparisons.tenantId, tenantId),
                eq(renewalComparisons.agencyzoomSrId, ticket.id)
              )
            )
            .limit(1);
          if (existingBySr) continue;

          // Also check if there's an awaiting_az_ticket candidate for this policy
          // (AL3 arrived but hasn't been matched yet — Phase 1 will handle it next run)
          if (resolvedPolicyNumber) {
            const [awaitingCandidate] = await db
              .select({ id: renewalCandidates.id })
              .from(renewalCandidates)
              .where(
                and(
                  eq(renewalCandidates.tenantId, tenantId),
                  eq(renewalCandidates.policyNumber, resolvedPolicyNumber),
                  eq(renewalCandidates.status, 'awaiting_az_ticket')
                )
              )
              .limit(1);
            if (awaitingCandidate) continue; // Phase 1 will match this next run
          }

          const assignedAgentId = matchedPolicy?.producerId || customerInfo?.producerId || (ticket.csr ? csrToUserId.get(ticket.csr) : null) || null;

          // Build customer display name from ticket or customer record
          const ticketCustomerName = [ticket.householdFirstname, ticket.householdLastname]
            .filter(Boolean).join(' ') || ticket.name || null;

          // Create pending_manual_renewal placeholder
          const [comparison] = await db
            .insert(renewalComparisons)
            .values({
              tenantId,
              customerId,
              policyId: matchedPolicy?.id || null,
              policyNumber: resolvedPolicyNumber,
              carrierName: matchedPolicy?.carrier || null,
              lineOfBusiness: matchedPolicy?.lineOfBusiness || null,
              renewalEffectiveDate: effectiveDate || new Date(), // Fallback to now if unknown
              currentPremium: matchedPolicy?.premium || null,
              status: 'pending_manual_renewal',
              recommendation: 'needs_review',
              renewalSource: 'pending',
              assignedAgentId,
              agencyzoomSrId: ticket.id,
              renewalSnapshot: {
                insuredName: ticketCustomerName,
              },
              comparisonSummary: {
                note: 'AZ renewal ticket created — awaiting renewal data. Upload PDF dec page or wait for AL3 file.',
                azTicketSubject: ticket.subject,
                azTicketCreatedAt: ticket.createDate,
              },
            })
            .onConflictDoNothing()
            .returning();

          if (comparison) {
            placeholdersCreated++;

            await logRenewalEvent({
              tenantId,
              renewalComparisonId: comparison.id,
              eventType: 'ingested',
              eventData: {
                source: 'az_ticket_sync',
                azTicketId: ticket.id,
                azTicketSubject: ticket.subject,
                policyNumber: resolvedPolicyNumber,
                hasPolicy: !!matchedPolicy,
              },
              performedBy: 'system',
            });
          }
        } catch (err) {
          console.error(`[az-sync] Failed to create placeholder for ticket ${ticket.id}:`, err);
        }
      }
    }

    return NextResponse.json({
      success: true,
      matched: matched.length,
      placeholdersCreated,
      totalPending: pendingCandidates.length,
      totalAzTickets: allTickets.length,
      unmatchedTickets: unmatchedTickets.length,
      matches: matched,
    });
  } catch (error) {
    console.error('[Internal API] az-sync error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed' },
      { status: 500 }
    );
  }
}
