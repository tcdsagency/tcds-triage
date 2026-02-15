/**
 * GET /api/renewals/[id]/property-verification
 * On-demand property verification: cross-checks HawkSoft data against
 * RPR, PropertyAPI, and Nearmap public records. Results are cached on the
 * renewalComparisons row so subsequent views are instant.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { renewalComparisons, propertyLookups } from '@/db/schema';
import { eq, and, gt } from 'drizzle-orm';
import { rprClient } from '@/lib/rpr';
import { propertyApiClient } from '@/lib/propertyapi';
import {
  runPropertyVerification,
  type PropertyVerificationResult,
  type NearmapLookupData,
} from '@/lib/property-verification';
import type { CheckResult, CheckSummary } from '@/types/check-rules.types';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // 1. Load renewal from DB
    const [renewal] = await db
      .select({
        id: renewalComparisons.id,
        tenantId: renewalComparisons.tenantId,
        lineOfBusiness: renewalComparisons.lineOfBusiness,
        renewalSnapshot: renewalComparisons.renewalSnapshot,
        baselineSnapshot: renewalComparisons.baselineSnapshot,
        checkResults: renewalComparisons.checkResults,
        checkSummary: renewalComparisons.checkSummary,
        propertyVerification: renewalComparisons.propertyVerification,
      })
      .from(renewalComparisons)
      .where(eq(renewalComparisons.id, id))
      .limit(1);

    if (!renewal) {
      return NextResponse.json({ success: false, error: 'Renewal not found' }, { status: 404 });
    }

    // 2. If cached, return immediately
    const cached = renewal.propertyVerification as PropertyVerificationResult | null;
    if (cached?.status === 'complete') {
      return NextResponse.json({ success: true, verification: cached });
    }

    // 3. Extract address from snapshots
    const snapshot = (renewal.renewalSnapshot || renewal.baselineSnapshot) as any;
    if (!snapshot) {
      return NextResponse.json({ success: false, error: 'No snapshot data' }, { status: 404 });
    }

    const addressParts = [
      snapshot.insuredAddress,
      snapshot.insuredCity,
      snapshot.insuredState,
      snapshot.insuredZip,
    ].filter(Boolean);

    if (addressParts.length === 0) {
      return NextResponse.json({ success: false, error: 'No address in renewal snapshot' }, { status: 422 });
    }

    const fullAddress = addressParts.join(', ');

    // 4. Check propertyLookups cache (7-day TTL)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const [cachedLookup] = await db
      .select()
      .from(propertyLookups)
      .where(
        and(
          eq(propertyLookups.tenantId, renewal.tenantId),
          eq(propertyLookups.address, fullAddress),
          gt(propertyLookups.expiresAt, sevenDaysAgo),
        )
      )
      .limit(1);

    let rprData = (cachedLookup?.rprData as any) || null;
    let propertyApiData = (cachedLookup?.propertyApiData as any) || null;
    let nearmapData: NearmapLookupData | null = (cachedLookup?.nearmapData as NearmapLookupData) || null;
    let propertyLookupId: string | null = cachedLookup?.id || null;

    // 5. Cache miss — fetch RPR + PropertyAPI in parallel
    if (!cachedLookup) {
      const [rprResult, papiResult] = await Promise.all([
        rprClient.lookupProperty(fullAddress).catch(() => null),
        propertyApiClient.lookupByAddress(fullAddress).catch(() => null),
      ]);
      rprData = rprResult;
      propertyApiData = papiResult;
      // nearmapData stays null — we use whatever is on the lookup row already
    }

    // 6. Extract dwelling limit from renewal snapshot
    let dwellingLimit: number | null = null;
    const coverages = (snapshot.coverages || []) as Array<{ type?: string; limitAmount?: number }>;
    const dwellingCov = coverages.find(
      (c) => c.type?.toLowerCase() === 'dwelling' || c.type?.toLowerCase() === 'cov a'
    );
    if (dwellingCov?.limitAmount) {
      dwellingLimit = dwellingCov.limitAmount;
    }

    // 7. Build Street View embed URL
    const googleApiKey = process.env.GOOGLE_MAPS_API_KEY || '';
    const streetViewUrl = googleApiKey
      ? `https://www.google.com/maps/embed/v1/streetview?key=${googleApiKey}&location=${encodeURIComponent(fullAddress)}&heading=0&pitch=0&fov=90`
      : null;

    // 8. Run verification rules
    const propertyContext = (snapshot.propertyContext || (renewal.baselineSnapshot as any)?.propertyContext) || null;
    const pvResults = runPropertyVerification({
      propertyContext,
      insuredName: snapshot.insuredName || null,
      dwellingLimit,
      rprData,
      propertyApiData,
      nearmapData,
    });

    // 9. Build public data summary
    const publicData: PropertyVerificationResult['publicData'] = {};
    if (rprData || propertyApiData) {
      publicData.yearBuilt = rprData?.yearBuilt ?? propertyApiData?.building?.yearBuilt;
      publicData.sqft = rprData?.sqft ?? propertyApiData?.building?.sqft;
      publicData.stories = rprData?.stories ?? propertyApiData?.building?.stories;
      publicData.roofType = rprData?.roofType;
      publicData.constructionType = rprData?.exteriorWalls ?? rprData?.constructionType;
      publicData.ownerName = rprData?.ownerName ?? propertyApiData?.owner?.name;
      publicData.ownerOccupied = rprData?.ownerOccupied ?? propertyApiData?.owner?.ownerOccupied;
      publicData.estimatedValue = rprData?.estimatedValue ?? propertyApiData?.valuation?.marketValue;
      publicData.listingStatus = rprData?.currentStatus;
      publicData.lastSaleDate = rprData?.lastSaleDate ?? propertyApiData?.saleHistory?.lastSaleDate;
      publicData.lastSalePrice = rprData?.lastSalePrice ?? propertyApiData?.saleHistory?.lastSalePrice;
    }

    // 10. Build verification result
    const verificationResult: PropertyVerificationResult = {
      status: 'complete',
      verifiedAt: new Date().toISOString(),
      address: fullAddress,
      streetViewUrl,
      sources: {
        rpr: !!rprData,
        propertyApi: !!propertyApiData,
        nearmap: !!nearmapData,
      },
      propertyLookupId,
      publicData,
      checkResults: pvResults,
    };

    // 11. Merge PV results into existing checkResults (filter out old PV-* first)
    const existingChecks = ((renewal.checkResults || []) as unknown as CheckResult[])
      .filter((r) => !r.ruleId.startsWith('PV-'));
    const mergedChecks = [...existingChecks, ...pvResults];

    // Recompute checkSummary
    const criticalCount = mergedChecks.filter((r) => r.severity === 'critical').length;
    const warningCount = mergedChecks.filter((r) => r.severity === 'warning').length;
    const infoCount = mergedChecks.filter((r) => r.severity === 'info').length;
    const unchangedCount = mergedChecks.filter((r) => r.severity === 'unchanged').length;
    const reviewable = mergedChecks.filter((r) => r.severity !== 'unchanged');
    const reviewedCount = reviewable.filter((r) => r.reviewed).length;

    const updatedSummary: CheckSummary = {
      totalChecks: mergedChecks.length,
      criticalCount,
      warningCount,
      infoCount,
      unchangedCount,
      pipelineHalted: (renewal.checkSummary as CheckSummary | null)?.pipelineHalted ?? false,
      blockerRuleIds: (renewal.checkSummary as CheckSummary | null)?.blockerRuleIds ?? [],
      reviewProgress: reviewable.length > 0 ? Math.round((reviewedCount / reviewable.length) * 100) : 0,
    };

    // 12. Persist
    await db
      .update(renewalComparisons)
      .set({
        propertyVerification: verificationResult,
        checkResults: mergedChecks as unknown as Record<string, unknown>[],
        checkSummary: updatedSummary,
        updatedAt: new Date(),
      })
      .where(eq(renewalComparisons.id, id));

    return NextResponse.json({ success: true, verification: verificationResult });
  } catch (error) {
    console.error('[Property Verification] Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    );
  }
}
