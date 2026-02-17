/**
 * POST /api/renewals/internal/baselines — Bulk upsert baseline snapshots
 * GET  /api/renewals/internal/baselines — Look up best baseline for a policy
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { renewalBaselines, policies } from '@/db/schema';
import { eq, and, lt, desc } from 'drizzle-orm';
import { normalizeHawkSoftCoverages, findLocalPolicy } from '@/lib/al3/baseline-builder';
import { DISCOUNT_COVERAGE_TYPES, RATING_FACTOR_TYPES } from '@/lib/al3/constants';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tenantId, batchId, baselines } = body as {
      tenantId: string;
      batchId?: string;
      baselines: Array<{
        policyNumber: string;
        carrierCode: string;
        carrierName?: string;
        lineOfBusiness?: string;
        effectiveDate: string;
        expirationDate?: string;
        insuredName?: string;
        snapshot: Record<string, unknown>;
        rawAl3Content?: string;
        sourceFileName?: string;
      }>;
    };

    if (!baselines || baselines.length === 0) {
      return NextResponse.json({ success: true, stored: 0 });
    }

    // Build a cache of policy lookups to avoid N+1 queries
    const policyCache = new Map<string, { policyId: string; customerId: string } | null>();

    let stored = 0;
    let errors = 0;
    for (const b of baselines) {
      try {
        // Look up policyId/customerId by policy number (with suffix fallback)
        let policyLink = policyCache.get(b.policyNumber);
        if (policyLink === undefined) {
          policyLink = await findLocalPolicy(tenantId, b.policyNumber);
          policyCache.set(b.policyNumber, policyLink);
        }

        // Enrich snapshot with HawkSoft coverages if key coverages are missing
        let enrichedSnapshot = b.snapshot;
        if (policyLink) {
          enrichedSnapshot = await enrichSnapshotFromHawkSoft(
            policyLink.policyId,
            b.snapshot,
            b.lineOfBusiness
          );
        }

        await db
          .insert(renewalBaselines)
          .values({
            tenantId,
            policyNumber: b.policyNumber,
            carrierCode: b.carrierCode,
            carrierName: b.carrierName || null,
            lineOfBusiness: b.lineOfBusiness || null,
            insuredName: b.insuredName || null,
            effectiveDate: new Date(b.effectiveDate),
            expirationDate: b.expirationDate ? new Date(b.expirationDate) : null,
            snapshot: enrichedSnapshot,
            rawAl3Content: b.rawAl3Content || null,
            sourceFileName: b.sourceFileName || null,
            batchId: batchId || null,
            policyId: policyLink?.policyId || null,
            customerId: policyLink?.customerId || null,
          })
          .onConflictDoUpdate({
            target: [
              renewalBaselines.tenantId,
              renewalBaselines.carrierCode,
              renewalBaselines.policyNumber,
              renewalBaselines.effectiveDate,
            ],
            set: {
              carrierName: b.carrierName || null,
              lineOfBusiness: b.lineOfBusiness || null,
              insuredName: b.insuredName || null,
              expirationDate: b.expirationDate ? new Date(b.expirationDate) : null,
              snapshot: enrichedSnapshot,
              rawAl3Content: b.rawAl3Content || null,
              sourceFileName: b.sourceFileName || null,
              batchId: batchId || null,
              policyId: policyLink?.policyId || null,
              customerId: policyLink?.customerId || null,
              updatedAt: new Date(),
            },
          });
        stored++;
      } catch (err) {
        errors++;
        console.error(`[Baselines] Error storing baseline for ${b.policyNumber}:`, err);
      }
    }

    console.log(`[Baselines] Stored ${stored} baselines for tenant ${tenantId}${errors > 0 ? ` (${errors} errors)` : ''}`);
    return NextResponse.json({ success: true, stored });
  } catch (error) {
    console.error('[Internal API] Baselines POST error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Baseline store failed' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');
    const carrierCode = searchParams.get('carrierCode');
    const policyNumber = searchParams.get('policyNumber');
    const beforeDate = searchParams.get('beforeDate');

    if (!tenantId || !carrierCode || !policyNumber || !beforeDate) {
      return NextResponse.json(
        { success: false, error: 'tenantId, carrierCode, policyNumber, and beforeDate are required' },
        { status: 400 }
      );
    }

    const result = await db
      .select()
      .from(renewalBaselines)
      .where(
        and(
          eq(renewalBaselines.tenantId, tenantId),
          eq(renewalBaselines.carrierCode, carrierCode),
          eq(renewalBaselines.policyNumber, policyNumber),
          lt(renewalBaselines.effectiveDate, new Date(beforeDate))
        )
      )
      .orderBy(desc(renewalBaselines.effectiveDate))
      .limit(1);

    if (result.length === 0) {
      return NextResponse.json({ success: false, baseline: null });
    }

    const baseline = result[0];
    return NextResponse.json({
      success: true,
      baseline: {
        snapshot: baseline.snapshot,
        policyId: baseline.policyId,
        customerId: baseline.customerId,
      },
    });
  } catch (error) {
    console.error('[Internal API] Baselines GET error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Baseline lookup failed' },
      { status: 500 }
    );
  }
}

// =============================================================================
// HAWKSOFT ENRICHMENT
// =============================================================================

const HOME_KEY_COVERAGES = ['dwelling', 'personal_liability'];
const AUTO_KEY_COVERAGES = ['bodily_injury'];

/**
 * Enrich a baseline snapshot with missing coverages from HawkSoft policy data.
 * Lightweight — single DB query, no API calls.
 */
async function enrichSnapshotFromHawkSoft(
  policyId: string,
  snapshot: Record<string, unknown>,
  lineOfBusiness?: string | null
): Promise<Record<string, unknown>> {
  const coverages = (snapshot.coverages || []) as Array<{ type: string; limitAmount?: number; [k: string]: unknown }>;
  if (!Array.isArray(coverages)) return snapshot;

  const lob = (lineOfBusiness || '').toLowerCase();
  const isHome = lob.includes('home') || lob.includes('dwelling') || lob.includes('fire');
  const isAuto = lob.includes('auto') && !lob.includes('home');

  // Determine which key coverages are missing
  const keyCoverages = isHome ? HOME_KEY_COVERAGES : isAuto ? AUTO_KEY_COVERAGES : [...HOME_KEY_COVERAGES, ...AUTO_KEY_COVERAGES];
  const existingTypes = new Set(coverages.map((c) => c.type));
  const missingKeys = keyCoverages.filter((k) => {
    const existing = coverages.find((c) => c.type === k && c.limitAmount && c.limitAmount > 0);
    return !existing;
  });

  if (missingKeys.length === 0) return snapshot;

  // Look up HawkSoft coverages from policies table
  const [policy] = await db
    .select({ coverages: policies.coverages })
    .from(policies)
    .where(eq(policies.id, policyId))
    .limit(1);

  if (!policy?.coverages || !Array.isArray(policy.coverages) || policy.coverages.length === 0) {
    return snapshot;
  }

  const hsCoverages = normalizeHawkSoftCoverages(policy.coverages as any);
  const realHsCoverages = hsCoverages.filter(
    (c) => !DISCOUNT_COVERAGE_TYPES.has(c.type) && !RATING_FACTOR_TYPES.has(c.type)
  );

  const newCoverages: any[] = [];
  let modified = false;

  for (const missing of missingKeys) {
    const hsCov = realHsCoverages.find(
      (c) => c.type === missing && c.limitAmount && c.limitAmount > 0
    );
    if (!hsCov) continue;

    if (!existingTypes.has(missing)) {
      newCoverages.push({ ...hsCov, enrichedFromHawksoft: true });
    } else {
      // Update in-place: coverage exists but has no valid limit
      for (const existing of coverages) {
        if (existing.type === missing && (!existing.limitAmount || existing.limitAmount <= 0)) {
          existing.limitAmount = hsCov.limitAmount;
          existing.limit = hsCov.limit || String(hsCov.limitAmount);
          (existing as any).enrichedFromHawksoft = true;
          if (hsCov.deductibleAmount && !existing.deductibleAmount) {
            existing.deductibleAmount = hsCov.deductibleAmount as number;
            existing.deductible = hsCov.deductible as string;
          }
          modified = true;
        }
      }
    }
  }

  if (newCoverages.length === 0 && !modified) return snapshot;

  return {
    ...snapshot,
    coverages: [...coverages, ...newCoverages],
    enrichedFromHawksoft: true,
  };
}
