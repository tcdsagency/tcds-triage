/**
 * POST /api/renewals/batches/[id]/reprocess
 * Re-upload a ZIP file and retrigger processing for a stuck/failed batch.
 * Resets all counters, deletes old candidates, and re-queues the job.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { renewalBatches, renewalCandidates, renewalComparisons, al3TransactionArchive } from '@/db/schema';
import { eq, and, inArray, isNull } from 'drizzle-orm';
import { queueRenewalBatchProcessing } from '@/lib/queues/client';

const TENANT_ID = process.env.DEFAULT_TENANT_ID || '';
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Verify batch exists
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

    // Get the re-uploaded file
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided. Re-upload the ZIP to reprocess.' },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { success: false, error: 'File exceeds 100MB limit' },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // Collect comparison IDs linked to candidates about to be deleted
    const candidatesWithComparisons = await db
      .select({ comparisonId: renewalCandidates.comparisonId })
      .from(renewalCandidates)
      .where(eq(renewalCandidates.batchId, id));

    const comparisonIds = candidatesWithComparisons
      .map(c => c.comparisonId)
      .filter((cid): cid is string => cid != null);

    // Delete linked comparisons that have no agent decision (safe to re-create)
    if (comparisonIds.length > 0) {
      await db.delete(renewalComparisons)
        .where(
          and(
            inArray(renewalComparisons.id, comparisonIds),
            isNull(renewalComparisons.agentDecision)
          )
        );
    }

    // Delete old candidates and archived transactions for this batch
    await db.delete(al3TransactionArchive).where(eq(al3TransactionArchive.batchId, id));
    await db.delete(renewalCandidates).where(eq(renewalCandidates.batchId, id));

    // Reset batch status and counters
    await db
      .update(renewalBatches)
      .set({
        status: 'uploaded',
        originalFileName: file.name,
        fileSize: file.size,
        storagePath: `renewals/${Date.now()}-${file.name}`,
        totalAl3FilesFound: 0,
        totalTransactionsFound: 0,
        totalRenewalTransactions: 0,
        totalCandidatesCreated: 0,
        duplicatesRemoved: 0,
        totalArchivedTransactions: 0,
        candidatesCompleted: 0,
        candidatesFailed: 0,
        candidatesSkipped: 0,
        errorMessage: null,
        processingLog: [],
        processingStartedAt: null,
        processingCompletedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(renewalBatches.id, id));

    // Queue for processing
    try {
      await queueRenewalBatchProcessing({
        batchId: id,
        tenantId: TENANT_ID,
        storagePath: `renewals/${Date.now()}-${file.name}`,
        fileBuffer: buffer.toString('base64'),
      });
    } catch (queueError) {
      console.error('[Reprocess] Failed to queue batch processing:', queueError);
      await db
        .update(renewalBatches)
        .set({
          status: 'failed',
          errorMessage: 'Failed to queue for processing',
          updatedAt: new Date(),
        })
        .where(eq(renewalBatches.id, id));

      return NextResponse.json(
        { success: false, error: 'Batch reset but failed to queue processing' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      batchId: id,
      fileName: file.name,
      fileSize: file.size,
      message: 'Batch reset and requeued for processing',
    });
  } catch (error) {
    console.error('[API] Error reprocessing batch:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to reprocess batch' },
      { status: 500 }
    );
  }
}
