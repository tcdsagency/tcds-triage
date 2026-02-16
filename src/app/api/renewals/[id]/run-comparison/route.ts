/**
 * POST /api/renewals/[id]/run-comparison
 * Agent triggers comparison after reviewing PDF-extracted renewal data.
 * Builds HawkSoft baseline, runs comparison engine, updates record.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { renewalComparisons } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { buildBaselineSnapshot } from '@/lib/al3/baseline-builder';
import { compareSnapshots } from '@/lib/al3/comparison-engine';
import { runCheckEngine, buildCheckSummary } from '@/lib/al3/check-rules/check-engine';
import { logRenewalEvent } from '@/lib/api/renewal-audit';
import type { RenewalSnapshot } from '@/types/renewal.types';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ success: false, error: 'Tenant not configured' }, { status: 500 });
    }

    // Load comparison record
    const [comparison] = await db
      .select()
      .from(renewalComparisons)
      .where(
        and(
          eq(renewalComparisons.id, id),
          eq(renewalComparisons.tenantId, tenantId)
        )
      )
      .limit(1);

    if (!comparison) {
      return NextResponse.json({ success: false, error: 'Comparison not found' }, { status: 404 });
    }

    // Must have renewal snapshot
    const renewalSnapshot = comparison.renewalSnapshot as RenewalSnapshot | null;
    if (!renewalSnapshot) {
      return NextResponse.json(
        { success: false, error: 'No renewal data available. Upload a renewal PDF first.' },
        { status: 400 }
      );
    }

    // Build baseline from HawkSoft
    const baselineResult = await buildBaselineSnapshot(
      tenantId,
      comparison.policyNumber || '',
      comparison.carrierName || '',
      comparison.renewalEffectiveDate?.toISOString()
    );

    if (!baselineResult) {
      // No baseline available — still update with what we have
      await db
        .update(renewalComparisons)
        .set({
          status: 'waiting_agent_review',
          renewalSource: 'pdf_upload',
          renewalPremium: renewalSnapshot.premium?.toString() || null,
          comparisonSummary: {
            baselineStatus: 'unknown',
            baselineStatusReason: 'Policy not found in HawkSoft — prior-term data unavailable',
          },
          updatedAt: new Date(),
        })
        .where(eq(renewalComparisons.id, id));

      await logRenewalEvent({
        tenantId,
        renewalComparisonId: id,
        eventType: 'compared',
        eventData: { baselineStatus: 'not_found', source: 'pdf_upload' },
        performedBy: 'system',
      });

      return NextResponse.json({
        success: true,
        baselineStatus: 'not_found',
        message: 'No baseline found in HawkSoft. Renewal data saved for review.',
      });
    }

    const baselineSnapshot = baselineResult.snapshot;

    // Run comparison engine
    const result = compareSnapshots(
      renewalSnapshot,
      baselineSnapshot,
      undefined,
      comparison.renewalEffectiveDate?.toISOString()
    );

    // Run check engine
    let checkEngineResult = null;
    let checkSummary = null;
    try {
      checkEngineResult = runCheckEngine(
        renewalSnapshot,
        baselineSnapshot,
        result,
        comparison.lineOfBusiness || '',
        comparison.carrierName || ''
      );
      checkSummary = buildCheckSummary(checkEngineResult);
    } catch (checkErr) {
      console.error('[run-comparison] Check engine error (non-blocking):', checkErr);
    }

    // Compute premium changes
    const currentPremium = baselineSnapshot.premium;
    const renewalPremium = renewalSnapshot.premium;
    const premiumChange = renewalPremium != null && currentPremium != null
      ? renewalPremium - currentPremium
      : null;
    const premiumChangePercent = premiumChange != null && currentPremium && currentPremium !== 0
      ? (premiumChange / currentPremium) * 100
      : null;

    // Update comparison record
    await db
      .update(renewalComparisons)
      .set({
        baselineSnapshot,
        materialChanges: result.materialChanges as unknown as Record<string, unknown>[],
        comparisonSummary: {
          ...result.summary,
          baselineSource: 'hawksoft_api',
          baselineStatus: result.baselineStatus,
          baselineStatusReason: result.baselineStatusReason,
        },
        checkResults: (checkEngineResult?.checkResults || null) as unknown as Record<string, unknown>[] | null,
        checkSummary: checkSummary || null,
        currentPremium: currentPremium?.toString() || null,
        renewalPremium: renewalPremium?.toString() || null,
        premiumChangeAmount: premiumChange?.toString() || null,
        premiumChangePercent: premiumChangePercent != null ? premiumChangePercent.toFixed(2) : null,
        recommendation: result.recommendation,
        status: 'waiting_agent_review',
        renewalSource: 'pdf_upload',
        policyId: baselineResult.policyId || comparison.policyId,
        customerId: baselineResult.customerId || comparison.customerId,
        updatedAt: new Date(),
      })
      .where(eq(renewalComparisons.id, id));

    // Log audit event
    await logRenewalEvent({
      tenantId,
      renewalComparisonId: id,
      eventType: 'compared',
      eventData: {
        source: 'pdf_upload',
        recommendation: result.recommendation,
        materialChangesCount: result.materialChanges.length,
        premiumChange,
        premiumChangePercent,
      },
      performedBy: 'system',
    });

    return NextResponse.json({
      success: true,
      recommendation: result.recommendation,
      materialChangesCount: result.materialChanges.length,
      premiumChange,
      premiumChangePercent,
      checkSummary,
    });
  } catch (error) {
    console.error('[API] run-comparison error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Comparison failed' },
      { status: 500 }
    );
  }
}
