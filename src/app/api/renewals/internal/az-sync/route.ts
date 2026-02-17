/**
 * POST /api/renewals/internal/az-sync
 * Matches pending renewal candidates (status = 'awaiting_az_ticket') to active
 * AgencyZoom tickets in the Renewals pipeline (88345).
 *
 * Called by the az-renewal-sync scheduled job every 30 minutes.
 *
 * Matching strategies (in priority order):
 * A) Subject parsing — "Renewal Review: <name> - <policy>" pattern
 * B) Household ID → customer mapping (auto-match when customer has one pending candidate)
 * C) Subject contains candidate's policy number
 *
 * Returns matched pairs so the worker can queue process-candidate jobs.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { renewalCandidates, customers } from '@/db/schema';
import { eq, and, lt, sql } from 'drizzle-orm';
import { getAgencyZoomClient, type ServiceTicket } from '@/lib/api/agencyzoom';
import { SERVICE_PIPELINES } from '@/lib/api/agencyzoom-service-tickets';

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

    // 1. Fetch all candidates awaiting AZ ticket match
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

    if (pendingCandidates.length === 0) {
      return NextResponse.json({ success: true, matched: 0, message: 'No pending candidates' });
    }

    // 2. Fetch all active AZ tickets in Renewals pipeline (paginated)
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
      return NextResponse.json({ success: true, matched: 0, message: 'No active AZ renewal tickets' });
    }

    // 3. Build lookup structures for matching
    const matched: MatchedPair[] = [];
    const matchedCandidateIds = new Set<string>();

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
    // First get all unique customerIds that have pending candidates
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

    // householdId → candidates (via customer mapping)
    const householdToCandidates = new Map<number, typeof pendingCandidates>();
    for (const c of pendingCandidates) {
      if (!c.customerId) continue;
      // Find the AZ household ID for this customer
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

    // 4. Match tickets to candidates
    for (const ticket of allTickets) {
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
            }
          }
          continue;
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
            }
          }
        }
      }
    }

    // 5. Stale candidate cleanup: candidates awaiting AZ ticket 90+ days past effectiveDate
    const staleThreshold = new Date();
    staleThreshold.setDate(staleThreshold.getDate() - 90);

    const staleCandidates = pendingCandidates.filter(
      (c) => c.effectiveDate && new Date(c.effectiveDate) < staleThreshold && !matchedCandidateIds.has(c.id)
    );

    let staleMarked = 0;
    for (const stale of staleCandidates) {
      await db
        .update(renewalCandidates)
        .set({
          status: 'failed',
          errorMessage: 'No matching AZ ticket found within 90 days of effective date',
          updatedAt: new Date(),
        })
        .where(eq(renewalCandidates.id, stale.id));
      staleMarked++;
    }

    return NextResponse.json({
      success: true,
      matched: matched.length,
      staleMarked,
      totalPending: pendingCandidates.length,
      totalAzTickets: allTickets.length,
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
