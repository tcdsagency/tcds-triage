/**
 * PATCH /api/renewals/internal/batches/[id]
 * Update batch status (called by worker).
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { renewalBatches } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const updateData: Record<string, any> = { updatedAt: new Date() };
    if (body.status) updateData.status = body.status;
    if (body.totalAl3FilesFound != null) updateData.totalAl3FilesFound = body.totalAl3FilesFound;
    if (body.totalTransactionsFound != null) updateData.totalTransactionsFound = body.totalTransactionsFound;
    if (body.totalRenewalTransactions != null) updateData.totalRenewalTransactions = body.totalRenewalTransactions;
    if (body.totalCandidatesCreated != null) updateData.totalCandidatesCreated = body.totalCandidatesCreated;
    if (body.duplicatesRemoved != null) updateData.duplicatesRemoved = body.duplicatesRemoved;
    if (body.candidatesCompleted != null) updateData.candidatesCompleted = body.candidatesCompleted;
    if (body.candidatesFailed != null) updateData.candidatesFailed = body.candidatesFailed;
    if (body.candidatesSkipped != null) updateData.candidatesSkipped = body.candidatesSkipped;
    if (body.totalBaselinesStored != null) updateData.totalBaselinesStored = body.totalBaselinesStored;
    if (body.errorMessage) updateData.errorMessage = body.errorMessage;
    if (body.processingStartedAt) updateData.processingStartedAt = new Date(body.processingStartedAt);
    if (body.processingCompletedAt) updateData.processingCompletedAt = new Date(body.processingCompletedAt);

    await db.update(renewalBatches).set(updateData).where(eq(renewalBatches.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Internal API] Error updating batch:', error);
    return NextResponse.json({ success: false, error: 'Failed to update batch' }, { status: 500 });
  }
}
