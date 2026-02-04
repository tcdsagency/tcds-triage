/**
 * GET /api/renewals/batches
 * List renewal batches with status.
 */

import { NextResponse } from 'next/server';
import { db } from '@/db';
import { renewalBatches } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';

const TENANT_ID = process.env.TENANT_ID || '';

export async function GET() {
  try {
    const batches = await db
      .select()
      .from(renewalBatches)
      .where(eq(renewalBatches.tenantId, TENANT_ID))
      .orderBy(desc(renewalBatches.createdAt))
      .limit(50);

    return NextResponse.json({
      success: true,
      batches: batches.map((b) => ({
        id: b.id,
        originalFileName: b.originalFileName,
        fileSize: b.fileSize,
        status: b.status,
        totalAl3FilesFound: b.totalAl3FilesFound,
        totalTransactionsFound: b.totalTransactionsFound,
        totalRenewalTransactions: b.totalRenewalTransactions,
        totalCandidatesCreated: b.totalCandidatesCreated,
        duplicatesRemoved: b.duplicatesRemoved,
        candidatesCompleted: b.candidatesCompleted,
        candidatesFailed: b.candidatesFailed,
        candidatesSkipped: b.candidatesSkipped,
        errorMessage: b.errorMessage,
        createdAt: b.createdAt,
        processingStartedAt: b.processingStartedAt,
        processingCompletedAt: b.processingCompletedAt,
      })),
    });
  } catch (error) {
    console.error('[API] Error fetching batches:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch batches' },
      { status: 500 }
    );
  }
}
