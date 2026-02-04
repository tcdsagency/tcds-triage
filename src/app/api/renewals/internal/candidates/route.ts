/**
 * POST /api/renewals/internal/candidates
 * Create a renewal candidate record (called by worker).
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { renewalCandidates } from '@/db/schema';

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

    return NextResponse.json({ success: true, candidateId: candidate.id });
  } catch (error) {
    console.error('[Internal API] Error creating candidate:', error);
    return NextResponse.json({ success: false, error: 'Failed to create candidate' }, { status: 500 });
  }
}
