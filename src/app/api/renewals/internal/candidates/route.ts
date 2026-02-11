/**
 * POST /api/renewals/internal/candidates
 * Create a renewal candidate record (called by worker).
 * Also captures baseline snapshot immediately to preserve current term data.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { renewalCandidates } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { buildBaselineSnapshot } from '@/lib/al3/baseline-builder';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const [candidate] = await db
      .insert(renewalCandidates)
      .values({
        tenantId: body.tenantId,
        batchId: body.batchId,
        status: 'pending',
        transactionType: body.transactionType,
        policyNumber: body.policyNumber,
        carrierCode: body.carrierCode,
        carrierName: body.carrierName,
        lineOfBusiness: body.lineOfBusiness,
        effectiveDate: body.effectiveDate ? new Date(body.effectiveDate) : null,
        expirationDate: body.expirationDate ? new Date(body.expirationDate) : null,
        rawAl3Content: body.rawAl3Content,
        al3FileName: body.al3FileName,
      })
      .onConflictDoNothing()
      .returning();

    if (!candidate) {
      return NextResponse.json({ success: true, candidateId: null, duplicate: true });
    }

    // Capture baseline snapshot immediately to preserve current term data
    // This prevents data staleness when HawkSoft syncs update the policy
    try {
      const baselineResult = await buildBaselineSnapshot(
        body.tenantId,
        body.policyNumber,
        body.carrierName,
        body.effectiveDate  // pass renewal effective date for stale detection
      );

      if (baselineResult) {
        await db
          .update(renewalCandidates)
          .set({
            baselineSnapshot: baselineResult.snapshot,
            baselineCapturedAt: new Date(),
            policyId: baselineResult.policyId,
            customerId: baselineResult.customerId,
          })
          .where(eq(renewalCandidates.id, candidate.id));
      }
    } catch (baselineError) {
      // Log but don't fail - worker can still build baseline later
      console.error('[Internal API] Failed to capture baseline snapshot:', baselineError);
    }

    return NextResponse.json({ success: true, candidateId: candidate.id });
  } catch (error) {
    console.error('[Internal API] Error creating candidate:', error);
    return NextResponse.json({ success: false, error: 'Failed to create candidate' }, { status: 500 });
  }
}
