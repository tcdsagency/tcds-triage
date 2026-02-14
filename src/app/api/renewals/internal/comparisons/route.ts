/**
 * POST /api/renewals/internal/comparisons
 * Create a renewal comparison record (called by worker).
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { renewalComparisons } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { logRenewalEvent } from '@/lib/api/renewal-audit';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const premiumChange = body.renewalPremium != null && body.currentPremium != null
      ? body.renewalPremium - body.currentPremium
      : null;
    const premiumChangePercent = premiumChange != null && body.currentPremium && body.currentPremium !== 0
      ? (premiumChange / body.currentPremium) * 100
      : null;

    const [comparison] = await db
      .insert(renewalComparisons)
      .values({
        tenantId: body.tenantId,
        customerId: body.customerId || null,
        policyId: body.policyId || null,
        policyNumber: body.policyNumber,
        carrierName: body.carrierName,
        lineOfBusiness: body.lineOfBusiness,
        renewalEffectiveDate: new Date(body.renewalEffectiveDate),
        renewalExpirationDate: body.renewalExpirationDate ? new Date(body.renewalExpirationDate) : null,
        currentPremium: body.currentPremium?.toString() || null,
        renewalPremium: body.renewalPremium?.toString() || null,
        premiumChangeAmount: premiumChange?.toString() || null,
        premiumChangePercent: premiumChangePercent != null ? premiumChangePercent.toFixed(2) : null,
        recommendation: body.recommendation,
        status: 'waiting_agent_review',
        renewalSnapshot: body.renewalSnapshot,
        baselineSnapshot: body.baselineSnapshot,
        materialChanges: body.materialChanges || [],
        comparisonSummary: body.comparisonSummary,
        checkResults: body.checkResults || null,
        checkSummary: body.checkSummary || null,
      })
      .onConflictDoNothing()
      .returning();

    if (!comparison) {
      // Duplicate detected — look up the existing comparison to return its ID
      const [existing] = await db
        .select({ id: renewalComparisons.id })
        .from(renewalComparisons)
        .where(
          and(
            eq(renewalComparisons.tenantId, body.tenantId),
            eq(renewalComparisons.policyNumber, body.policyNumber),
            eq(renewalComparisons.carrierName, body.carrierName),
            eq(renewalComparisons.renewalEffectiveDate, new Date(body.renewalEffectiveDate))
          )
        )
        .limit(1);

      return NextResponse.json({
        success: true,
        comparisonId: existing?.id || null,
        duplicate: true,
      });
    }

    // Log audit events
    await logRenewalEvent({
      tenantId: body.tenantId,
      renewalComparisonId: comparison.id,
      eventType: 'ingested',
      eventData: { policyNumber: body.policyNumber, carrierName: body.carrierName },
      performedBy: 'system',
    });

    await logRenewalEvent({
      tenantId: body.tenantId,
      renewalComparisonId: comparison.id,
      eventType: 'compared',
      eventData: {
        recommendation: body.recommendation,
        materialChangesCount: body.materialChanges?.length || 0,
      },
      performedBy: 'system',
    });

    // Create AgencyZoom Service Request (non-blocking)
    if (body.customerId) {
      try {
        const { findOrCreateRenewalSR } = await import('@/lib/api/renewal-sr-service');
        await findOrCreateRenewalSR({
          tenantId: body.tenantId,
          renewalComparisonId: comparison.id,
          customerId: body.customerId,
          policyNumber: body.policyNumber,
          carrierName: body.carrierName,
          lineOfBusiness: body.lineOfBusiness,
        });
      } catch (srErr) {
        console.error('[Comparisons] SR creation failed (non-blocking):', srErr);
      }
    }

    return NextResponse.json({ success: true, comparisonId: comparison.id });
  } catch (error) {
    console.error('[Internal API] Error creating comparison:', error);
    return NextResponse.json({ success: false, error: 'Failed to create comparison' }, { status: 500 });
  }
}
