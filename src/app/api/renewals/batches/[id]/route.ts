/**
 * GET /api/renewals/batches/[id]
 * Get batch details with candidates.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { renewalBatches, renewalCandidates } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const [batch] = await db
      .select()
      .from(renewalBatches)
      .where(eq(renewalBatches.id, id))
      .limit(1);

    if (!batch) {
      return NextResponse.json(
        { success: false, error: 'Batch not found' },
        { status: 404 }
      );
    }

    const candidates = await db
      .select()
      .from(renewalCandidates)
      .where(eq(renewalCandidates.batchId, id));

    return NextResponse.json({
      success: true,
      batch: {
        ...batch,
        processingLog: batch.processingLog || [],
      },
      candidates: candidates.map((c) => ({
        id: c.id,
        status: c.status,
        transactionType: c.transactionType,
        policyNumber: c.policyNumber,
        carrierCode: c.carrierCode,
        carrierName: c.carrierName,
        lineOfBusiness: c.lineOfBusiness,
        effectiveDate: c.effectiveDate,
        expirationDate: c.expirationDate,
        comparisonId: c.comparisonId,
        errorMessage: c.errorMessage,
        createdAt: c.createdAt,
      })),
    });
  } catch (error) {
    console.error('[API] Error fetching batch details:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch batch details' },
      { status: 500 }
    );
  }
}
