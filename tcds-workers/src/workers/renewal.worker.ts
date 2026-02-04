/**
 * Renewal Processing Worker
 * =========================
 * Processes IVANS AL3 batch downloads and individual renewal candidates.
 *
 * Two job types:
 * 1. process-batch: Extract ZIP -> parse AL3 -> filter renewals -> create candidates
 * 2. process-candidate: Full parse -> fetch baseline -> compare -> create comparison
 *
 * All AL3 parsing and comparison logic is delegated to internal API endpoints
 * to keep the worker isolated from the main app's source tree.
 */

import { Worker, Job } from 'bullmq';
import { redis } from '../redis';
import { config } from '../config';
import { logger } from '../logger';
import type { RenewalBatchJobData, RenewalCandidateJobData } from '../queues';

const BASE_URL = config.app.url;
const HEADERS = {
  'Content-Type': 'application/json',
  Authorization: `Bearer ${config.app.internalKey}`,
};

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
// HELPERS
// =============================================================================

async function internalFetch(path: string, options?: RequestInit): Promise<Response> {
  return fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: { ...HEADERS, ...(options?.headers || {}) },
  });
}

async function patchBatch(batchId: string, data: Record<string, unknown>): Promise<void> {
  await internalFetch(`/api/renewals/internal/batches/${batchId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

async function patchCandidate(candidateId: string, data: Record<string, unknown>): Promise<void> {
  await internalFetch(`/api/renewals/internal/candidates/${candidateId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

// =============================================================================
// PROCESS BATCH
// =============================================================================

async function processBatch(data: RenewalBatchJobData): Promise<void> {
  const { batchId, tenantId } = data;
  logger.info({ batchId }, 'Processing renewal batch');

  try {
    // Update batch status to extracting
    await patchBatch(batchId, { status: 'extracting', processingStartedAt: new Date().toISOString() });

    // Get file buffer
    let fileBuffer: string; // base64
    if (data.fileBuffer) {
      fileBuffer = data.fileBuffer;
    } else {
      // TODO: Download from Supabase Storage using data.storagePath
      throw new Error('Storage download not yet implemented');
    }

    // Extract AL3 files from ZIP via internal API
    const extractRes = await internalFetch('/api/renewals/internal/parse', {
      method: 'POST',
      body: JSON.stringify({ action: 'extract-zip', fileBuffer }),
    });
    const extractData = await extractRes.json() as { success: boolean; files: Array<{ fileName: string; content: string }> };
    if (!extractData.success) throw new Error('ZIP extraction failed');

    const al3Files = extractData.files;
    logger.info({ batchId, filesFound: al3Files.length }, 'AL3 files extracted');

    // Update batch with file count
    await patchBatch(batchId, { status: 'filtering', totalAl3FilesFound: al3Files.length });

    // Parse each file and filter for renewals
    let totalTransactions = 0;
    const allRenewals: Array<{ header: Record<string, unknown>; rawContent: string; _fileName: string }> = [];

    for (const file of al3Files) {
      // Parse AL3 file
      const parseRes = await internalFetch('/api/renewals/internal/parse', {
        method: 'POST',
        body: JSON.stringify({ action: 'parse-file', content: file.content }),
      });
      const parseData = await parseRes.json() as { success: boolean; transactions: any[] };
      if (!parseData.success) continue;

      totalTransactions += parseData.transactions.length;

      // Filter for renewals
      const filterRes = await internalFetch('/api/renewals/internal/parse', {
        method: 'POST',
        body: JSON.stringify({ action: 'filter-renewals', transactions: parseData.transactions }),
      });
      const filterData = await filterRes.json() as { success: boolean; unique: any[]; duplicatesRemoved: number };
      if (!filterData.success) continue;

      for (const r of filterData.unique) {
        allRenewals.push({ ...r, _fileName: file.fileName });
      }
    }

    // Global dedup across files
    const deduped = new Map<string, typeof allRenewals[0]>();
    let duplicatesRemoved = 0;
    for (const r of allRenewals) {
      const key = `${r.header?.carrierCode}|${r.header?.policyNumber}|${r.header?.effectiveDate}`;
      if (deduped.has(key)) {
        duplicatesRemoved++;
      } else {
        deduped.set(key, r);
      }
    }
    const unique = Array.from(deduped.values());

    logger.info({
      batchId,
      totalTransactions,
      totalRenewals: allRenewals.length,
      uniqueRenewals: unique.length,
      duplicatesRemoved,
    }, 'Renewals filtered');

    // Update batch stats
    await patchBatch(batchId, {
      status: 'processing',
      totalTransactionsFound: totalTransactions,
      totalRenewalTransactions: allRenewals.length,
      duplicatesRemoved,
      totalCandidatesCreated: unique.length,
    });

    // Create candidate records and queue individual processing
    for (const renewal of unique) {
      try {
        const candidateRes = await internalFetch('/api/renewals/internal/candidates', {
          method: 'POST',
          body: JSON.stringify({
            tenantId,
            batchId,
            transactionType: renewal.header?.transactionType,
            policyNumber: renewal.header?.policyNumber,
            carrierCode: renewal.header?.carrierCode,
            carrierName: renewal.header?.carrierName,
            lineOfBusiness: renewal.header?.lineOfBusiness,
            effectiveDate: renewal.header?.effectiveDate,
            expirationDate: renewal.header?.expirationDate,
            rawAl3Content: renewal.rawContent,
            al3FileName: renewal._fileName,
          }),
        });

        const result = await candidateRes.json() as { success: boolean; candidateId?: string };
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
      await patchBatch(batchId, {
        status: 'completed',
        processingCompletedAt: new Date().toISOString(),
      });
    }

    logger.info({ batchId, candidatesCreated: unique.length }, 'Batch processing complete');
  } catch (error) {
    logger.error({ batchId, error }, 'Batch processing failed');

    await patchBatch(batchId, {
      status: 'failed',
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
      processingCompletedAt: new Date().toISOString(),
    });

    throw error;
  }
}

// =============================================================================
// PROCESS CANDIDATE
// =============================================================================

async function processCandidate(data: RenewalCandidateJobData): Promise<void> {
  const { candidateId, tenantId } = data;

  logger.info({ candidateId }, 'Processing renewal candidate');

  try {
    // Update status to fetching_baseline
    await patchCandidate(candidateId, { status: 'fetching_baseline' });

    // Get candidate data
    const candidateRes = await internalFetch(`/api/renewals/internal/candidates/${candidateId}`);
    const candidateData = await candidateRes.json() as { success: boolean; candidate: Record<string, any> };
    if (!candidateData.success) throw new Error('Failed to fetch candidate');
    const candidate = candidateData.candidate;

    // Full-parse the AL3 content via internal API
    const parseRes = await internalFetch('/api/renewals/internal/parse', {
      method: 'POST',
      body: JSON.stringify({ action: 'parse-file', content: candidate.rawAl3Content || '' }),
    });
    const parseData = await parseRes.json() as { success: boolean; transactions: any[] };
    if (!parseData.success || !parseData.transactions.length) {
      await patchCandidate(candidateId, { status: 'failed', errorMessage: 'No parseable transaction found' });
      return;
    }

    // Build renewal snapshot via internal API
    const snapshotRes = await internalFetch('/api/renewals/internal/parse', {
      method: 'POST',
      body: JSON.stringify({ action: 'build-snapshot', transaction: parseData.transactions[0] }),
    });
    const snapshotData = await snapshotRes.json() as { success: boolean; snapshot: Record<string, any> };
    if (!snapshotData.success) {
      await patchCandidate(candidateId, { status: 'failed', errorMessage: 'Failed to build renewal snapshot' });
      return;
    }

    const renewalSnapshot: Record<string, any> = { ...snapshotData.snapshot, sourceFileName: candidate.al3FileName };

    // Update candidate status and snapshot
    await patchCandidate(candidateId, { status: 'comparing', renewalSnapshot });

    // Fetch HawkSoft baseline via internal API
    const baselineRes = await internalFetch('/api/renewals/internal/baseline', {
      method: 'POST',
      body: JSON.stringify({
        tenantId,
        policyNumber: candidate.policyNumber,
        carrierName: candidate.carrierName,
      }),
    });
    const baselineData = await baselineRes.json() as {
      success: boolean;
      snapshot?: Record<string, any>;
      policyId?: string;
      customerId?: string;
    };

    if (!baselineData.success || !baselineData.snapshot) {
      // Policy not found - skip candidate
      await patchCandidate(candidateId, { status: 'skipped', errorMessage: 'Policy not found in HawkSoft' });
      return;
    }

    // Run comparison engine via internal API
    const compareRes = await internalFetch('/api/renewals/internal/compare', {
      method: 'POST',
      body: JSON.stringify({
        renewalSnapshot,
        baselineSnapshot: baselineData.snapshot,
      }),
    });
    const compareData = await compareRes.json() as {
      success: boolean;
      result: { recommendation: string; materialChanges: any[]; summary: any };
    };
    if (!compareData.success) {
      await patchCandidate(candidateId, { status: 'failed', errorMessage: 'Comparison engine failed' });
      return;
    }

    const comparisonResult = compareData.result;

    // Create comparison record via internal API
    const comparisonRes = await internalFetch('/api/renewals/internal/comparisons', {
      method: 'POST',
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

    const comparison = await comparisonRes.json() as { success: boolean; comparisonId?: string };

    // Update candidate with completion
    await patchCandidate(candidateId, {
      status: 'completed',
      comparisonId: comparison.comparisonId,
      policyId: baselineData.policyId,
      customerId: baselineData.customerId,
    });

    logger.info({
      candidateId,
      comparisonId: comparison.comparisonId,
      recommendation: comparisonResult.recommendation,
    }, 'Candidate processing complete');
  } catch (error) {
    logger.error({ candidateId, error }, 'Candidate processing failed');

    await patchCandidate(candidateId, {
      status: 'failed',
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
    });

    throw error;
  }
}
