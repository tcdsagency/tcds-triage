/**
 * Renewal Processing Worker
 * =========================
 * Processes IVANS AL3 batch downloads and individual renewal candidates.
 *
 * Two job types:
 * 1. process-batch: Extract ZIP -> parse AL3 -> filter renewals -> create candidates
 * 2. process-candidate: Full parse -> fetch baseline -> compare -> create comparison
 */

import { Worker, Job } from 'bullmq';
import { redis } from '../redis';
import { logger } from '../logger';
import type { RenewalBatchJobData, RenewalCandidateJobData } from '../queues';

// =============================================================================
// WORKER
// =============================================================================

export const renewalWorker = new Worker(
  'renewal-processing',
  async (job: Job) => {
    const startTime = Date.now();

    try {
      switch (job.name) {
        case 'process-batch':
          await processBatch(job.data as RenewalBatchJobData);
          break;
        case 'process-candidate':
          await processCandidate(job.data as RenewalCandidateJobData);
          break;
        default:
          logger.warn({ jobName: job.name }, 'Unknown renewal job type');
      }
    } catch (error) {
      const elapsed = Date.now() - startTime;
      logger.error(
        { jobName: job.name, jobId: job.id, error, elapsed },
        'Renewal job failed'
      );
      throw error; // Re-throw to trigger BullMQ retry
    }
  },
  {
    connection: redis,
    concurrency: 3,
    limiter: {
      max: 10,
      duration: 60000, // Max 10 jobs per minute (rate limit HawkSoft API)
    },
  }
);

renewalWorker.on('completed', (job) => {
  logger.info({ jobName: job.name, jobId: job.id }, 'Renewal job completed');
});

renewalWorker.on('failed', (job, err) => {
  logger.error(
    { jobName: job?.name, jobId: job?.id, error: err.message },
    'Renewal job failed'
  );
});

// =============================================================================
// PROCESS BATCH
// =============================================================================

async function processBatch(data: RenewalBatchJobData): Promise<void> {
  const { batchId, tenantId } = data;
  logger.info({ batchId }, 'Processing renewal batch');

  // Use internal API endpoints to update batch status (avoids DB import issues in workers)
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'http://localhost:3000';

  try {
    // Update batch status to extracting
    await fetch(`${baseUrl}/api/renewals/internal/batches/${batchId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'extracting', processingStartedAt: new Date().toISOString() }),
    });

    // Get file buffer
    let fileBuffer: Buffer;
    if (data.fileBuffer) {
      fileBuffer = Buffer.from(data.fileBuffer, 'base64');
    } else {
      // TODO: Download from Supabase Storage using data.storagePath
      throw new Error('Storage download not yet implemented');
    }

    // Extract AL3 files from ZIP
    const { extractAL3FilesFromZip } = await import('../../../src/lib/al3/zip-extractor');
    const al3Files = await extractAL3FilesFromZip(fileBuffer);

    logger.info({ batchId, filesFound: al3Files.length }, 'AL3 files extracted');

    // Update batch with file count
    await fetch(`${baseUrl}/api/renewals/internal/batches/${batchId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: 'filtering',
        totalAl3FilesFound: al3Files.length,
      }),
    });

    // Parse and filter for renewals
    const { parseAL3File } = await import('../../../src/lib/al3/parser');
    const { filterRenewalTransactions, deduplicateRenewals } = await import('../../../src/lib/al3/filter');

    let totalTransactions = 0;
    let allRenewals: any[] = [];

    for (const file of al3Files) {
      const transactions = parseAL3File(file.content);
      totalTransactions += transactions.length;

      const renewals = filterRenewalTransactions(transactions);
      allRenewals.push(
        ...renewals.map((r) => ({ ...r, _fileName: file.fileName }))
      );
    }

    // Deduplicate
    const { unique, duplicatesRemoved } = deduplicateRenewals(allRenewals);

    logger.info({
      batchId,
      totalTransactions,
      totalRenewals: allRenewals.length,
      uniqueRenewals: unique.length,
      duplicatesRemoved,
    }, 'Renewals filtered');

    // Update batch stats
    await fetch(`${baseUrl}/api/renewals/internal/batches/${batchId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: 'processing',
        totalTransactionsFound: totalTransactions,
        totalRenewalTransactions: allRenewals.length,
        duplicatesRemoved,
        totalCandidatesCreated: unique.length,
      }),
    });

    // Create candidate records and queue individual processing
    for (const renewal of unique) {
      try {
        const candidateResponse = await fetch(`${baseUrl}/api/renewals/internal/candidates`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tenantId,
            batchId,
            transactionType: renewal.header.transactionType,
            policyNumber: renewal.header.policyNumber,
            carrierCode: renewal.header.carrierCode,
            carrierName: renewal.header.carrierName,
            lineOfBusiness: renewal.header.lineOfBusiness,
            effectiveDate: renewal.header.effectiveDate,
            expirationDate: renewal.header.expirationDate,
            rawAl3Content: renewal.rawContent,
            al3FileName: renewal._fileName,
          }),
        });

        const result = await candidateResponse.json();
        if (result.success && result.candidateId) {
          // Queue individual candidate processing
          const { renewalQueue } = await import('../queues');
          await renewalQueue.add('process-candidate', {
            candidateId: result.candidateId,
            tenantId,
            batchId,
          } as RenewalCandidateJobData, {
            jobId: `renewal-candidate-${result.candidateId}`,
            attempts: 3,
            backoff: { type: 'exponential', delay: 10000 },
          });
        }
      } catch (err) {
        logger.error({ batchId, error: err }, 'Failed to create candidate');
      }
    }

    // If no candidates, mark batch complete
    if (unique.length === 0) {
      await fetch(`${baseUrl}/api/renewals/internal/batches/${batchId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'completed',
          processingCompletedAt: new Date().toISOString(),
        }),
      });
    }

    logger.info({ batchId, candidatesCreated: unique.length }, 'Batch processing complete');
  } catch (error) {
    logger.error({ batchId, error }, 'Batch processing failed');

    await fetch(`${baseUrl}/api/renewals/internal/batches/${batchId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        processingCompletedAt: new Date().toISOString(),
      }),
    });

    throw error;
  }
}

// =============================================================================
// PROCESS CANDIDATE
// =============================================================================

async function processCandidate(data: RenewalCandidateJobData): Promise<void> {
  const { candidateId, tenantId, batchId } = data;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'http://localhost:3000';

  logger.info({ candidateId }, 'Processing renewal candidate');

  try {
    // Update status to fetching_baseline
    await fetch(`${baseUrl}/api/renewals/internal/candidates/${candidateId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'fetching_baseline' }),
    });

    // Get candidate data
    const candidateRes = await fetch(`${baseUrl}/api/renewals/internal/candidates/${candidateId}`);
    const candidateData = await candidateRes.json();
    if (!candidateData.success) throw new Error('Failed to fetch candidate');
    const candidate = candidateData.candidate;

    // Full-parse the AL3 content
    const { parseAL3File } = await import('../../../src/lib/al3/parser');
    const { buildRenewalSnapshot } = await import('../../../src/lib/al3/snapshot-builder');

    const transactions = parseAL3File(candidate.rawAl3Content || '');
    const transaction = transactions[0]; // Take first (should match)
    if (!transaction) {
      await fetch(`${baseUrl}/api/renewals/internal/candidates/${candidateId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'failed', errorMessage: 'No parseable transaction found' }),
      });
      return;
    }

    const renewalSnapshot = buildRenewalSnapshot(transaction);
    renewalSnapshot.sourceFileName = candidate.al3FileName;

    // Fetch HawkSoft baseline
    await fetch(`${baseUrl}/api/renewals/internal/candidates/${candidateId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'comparing', renewalSnapshot }),
    });

    const baselineRes = await fetch(`${baseUrl}/api/renewals/internal/baseline`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantId,
        policyNumber: candidate.policyNumber,
        carrierName: candidate.carrierName,
      }),
    });
    const baselineData = await baselineRes.json();

    if (!baselineData.success || !baselineData.snapshot) {
      // Policy not found - skip candidate
      await fetch(`${baseUrl}/api/renewals/internal/candidates/${candidateId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'skipped', errorMessage: 'Policy not found in HawkSoft' }),
      });
      return;
    }

    // Run comparison engine
    const { compareSnapshots } = await import('../../../src/lib/al3/comparison-engine');
    const comparisonResult = compareSnapshots(renewalSnapshot, baselineData.snapshot);

    // Create comparison record
    const comparisonRes = await fetch(`${baseUrl}/api/renewals/internal/comparisons`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantId,
        candidateId,
        customerId: baselineData.customerId,
        policyId: baselineData.policyId,
        policyNumber: candidate.policyNumber,
        carrierName: candidate.carrierName,
        lineOfBusiness: candidate.lineOfBusiness,
        renewalEffectiveDate: candidate.effectiveDate,
        renewalExpirationDate: candidate.expirationDate,
        currentPremium: baselineData.snapshot.premium,
        renewalPremium: renewalSnapshot.premium,
        recommendation: comparisonResult.recommendation,
        renewalSnapshot,
        baselineSnapshot: baselineData.snapshot,
        materialChanges: comparisonResult.materialChanges,
        comparisonSummary: comparisonResult.summary,
      }),
    });

    const comparison = await comparisonRes.json();

    // Update candidate with completion
    await fetch(`${baseUrl}/api/renewals/internal/candidates/${candidateId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: 'completed',
        comparisonId: comparison.comparisonId,
        policyId: baselineData.policyId,
        customerId: baselineData.customerId,
      }),
    });

    logger.info({
      candidateId,
      comparisonId: comparison.comparisonId,
      recommendation: comparisonResult.recommendation,
    }, 'Candidate processing complete');
  } catch (error) {
    logger.error({ candidateId, error }, 'Candidate processing failed');

    await fetch(`${baseUrl}/api/renewals/internal/candidates/${candidateId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      }),
    });

    throw error;
  }
}
