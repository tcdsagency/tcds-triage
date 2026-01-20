/**
 * Customer Sync Worker
 *
 * Syncs customer data from external CRMs (AgencyZoom, HawkSoft)
 * to the local database for faster lookups and unified profiles.
 *
 * Uses chunked API calls to avoid Vercel timeout issues.
 *
 * Job Types:
 * - single: Sync a single customer by ID
 * - batch: Sync a batch of customers by IDs
 * - full: Full sync of all customers (chunked)
 */

import { Worker, Job } from 'bullmq';
import { redis } from '../redis';
import { config } from '../config';
import { logger } from '../logger';
import { CustomerSyncJobData } from '../queues';

// Batch size for chunked sync - keep aligned with API endpoint
const CHUNK_SIZE = 25;

// Max pages to process in a single job (safety limit)
const MAX_PAGES = 200;

/**
 * Create and return the customer sync worker
 */
export function createCustomerSyncWorker(): Worker<CustomerSyncJobData> {
  return new Worker<CustomerSyncJobData>(
    'customer-sync',
    async (job: Job<CustomerSyncJobData>) => {
      const { type, source, customerId, customerIds, provider } = job.data;

      logger.info({
        event: 'customer_sync_start',
        jobId: job.id,
        type,
        source,
        provider,
        count: customerIds?.length || (customerId ? 1 : 'all'),
      });

      const startTime = Date.now();
      let syncedCount = 0;
      let errorCount = 0;

      try {
        switch (type) {
          case 'single':
            if (!customerId) {
              throw new Error('customerId required for single sync');
            }
            await syncSingleCustomer(customerId, provider);
            syncedCount = 1;
            break;

          case 'batch':
            if (!customerIds || customerIds.length === 0) {
              throw new Error('customerIds required for batch sync');
            }
            const batchResults = await syncBatchCustomers(customerIds, provider);
            syncedCount = batchResults.synced;
            errorCount = batchResults.errors;
            break;

          case 'full':
            const fullResults = await syncAllCustomersChunked(provider, job);
            syncedCount = fullResults.synced;
            errorCount = fullResults.errors;
            break;

          default:
            throw new Error(`Unknown sync type: ${type}`);
        }

        const duration = Date.now() - startTime;

        logger.info({
          event: 'customer_sync_complete',
          jobId: job.id,
          type,
          syncedCount,
          errorCount,
          durationMs: duration,
        });

        return {
          success: true,
          type,
          source,
          syncedCount,
          errorCount,
          durationMs: duration,
        };
      } catch (err) {
        logger.error({
          event: 'customer_sync_error',
          jobId: job.id,
          type,
          error: err instanceof Error ? err.message : 'Unknown error',
        });
        throw err;
      }
    },
    {
      connection: redis,
      concurrency: 1, // Only one sync at a time to avoid overwhelming APIs
      limiter: {
        max: 5,
        duration: 60000, // Max 5 jobs per minute
      },
    }
  );
}

// =============================================================================
// SYNC FUNCTIONS
// =============================================================================

/**
 * Sync a single customer by ID
 */
async function syncSingleCustomer(
  customerId: string,
  provider?: 'agencyzoom' | 'hawksoft' | 'both'
): Promise<void> {
  logger.debug({ customerId, provider }, 'Syncing single customer');

  // For single customer sync, use the main API (quick operation)
  const response = await fetch(`${config.app.url}/api/sync/customers`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.app.internalKey}`,
    },
    body: JSON.stringify({
      type: 'single',
      customerId,
      provider,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Customer sync failed: ${response.status} ${errorText}`);
  }
}

/**
 * Sync a batch of customers by IDs
 */
async function syncBatchCustomers(
  customerIds: string[],
  provider?: 'agencyzoom' | 'hawksoft' | 'both'
): Promise<{ synced: number; errors: number }> {
  logger.debug({ count: customerIds.length, provider }, 'Syncing batch of customers');

  let synced = 0;
  let errors = 0;

  // Process individually to avoid timeout
  for (const id of customerIds) {
    try {
      await syncSingleCustomer(id, provider);
      synced++;
    } catch (err) {
      logger.warn({ customerId: id, error: err }, 'Failed to sync customer');
      errors++;
    }

    // Small delay between requests to avoid rate limits
    await sleep(200);
  }

  return { synced, errors };
}

/**
 * Full sync using chunked API calls
 *
 * This avoids Vercel timeout by:
 * 1. Calling a chunked API endpoint that processes small batches
 * 2. Iterating through pages until no more data
 * 3. Each chunk request is quick (<60s)
 */
async function syncAllCustomersChunked(
  provider: 'agencyzoom' | 'hawksoft' | 'both' = 'agencyzoom',
  job: Job<CustomerSyncJobData>
): Promise<{ synced: number; errors: number }> {
  logger.info({ provider }, 'Starting chunked full customer sync');

  let totalSynced = 0;
  let totalErrors = 0;
  let page = 1;
  let hasMore = true;

  // Sync AgencyZoom customers
  if (provider === 'agencyzoom' || provider === 'both') {
    logger.info('Syncing AgencyZoom customers...');

    while (hasMore && page <= MAX_PAGES) {
      try {
        // Update job progress
        await job.updateProgress({
          stage: 'agencyzoom',
          page,
          totalSynced,
        });

        const response = await fetch(`${config.app.url}/api/sync/customers/chunk`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${config.app.internalKey}`,
          },
          body: JSON.stringify({
            page,
            batchSize: CHUNK_SIZE,
            provider: 'agencyzoom',
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          logger.error({ page, status: response.status, error: errorText }, 'Chunk sync failed');
          totalErrors++;

          // If it's a 5xx error, maybe retry; otherwise skip this page
          if (response.status >= 500) {
            await sleep(5000); // Wait before retry
            continue; // Retry same page
          }
          page++;
          continue;
        }

        const result = await response.json() as {
          success: boolean;
          synced: number;
          errors: number;
          hasMore: boolean;
          nextPage: number | null;
          duration: number;
        };

        totalSynced += result.synced || 0;
        totalErrors += result.errors || 0;
        hasMore = result.hasMore;

        logger.info({
          event: 'chunk_complete',
          provider: 'agencyzoom',
          page,
          synced: result.synced,
          totalSynced,
          hasMore,
          duration: result.duration,
        });

        page++;

        // Small delay between chunks to be nice to the API
        if (hasMore) {
          await sleep(500);
        }
      } catch (err) {
        logger.error({ page, error: err }, 'Error processing chunk');
        totalErrors++;
        page++;

        // Don't fail the whole job for one bad page
        await sleep(2000);
      }
    }

    if (page > MAX_PAGES) {
      logger.warn({ maxPages: MAX_PAGES }, 'Reached max page limit');
    }
  }

  // Sync HawkSoft customers (uses existing batched endpoint)
  // Using smaller batches (100) to avoid Vercel timeout (~0.4s per customer = ~40s per batch)
  if (provider === 'hawksoft' || provider === 'both') {
    logger.info('Syncing HawkSoft customers...');

    const HS_BATCH_SIZE = 100;
    const HS_MAX_CUSTOMERS = 2500;
    let hsOffset = 0;
    let hsHasMore = true;

    while (hsHasMore && hsOffset < HS_MAX_CUSTOMERS) {
      try {
        await job.updateProgress({
          stage: 'hawksoft',
          offset: hsOffset,
          totalSynced,
        });

        const response = await fetch(`${config.app.url}/api/sync/hawksoft?offset=${hsOffset}&limit=${HS_BATCH_SIZE}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${config.app.internalKey}`,
          },
        });

        if (!response.ok) {
          logger.warn({ offset: hsOffset, status: response.status }, 'HawkSoft batch failed');
          totalErrors++;
          hsOffset += HS_BATCH_SIZE;
          continue;
        }

        const result = await response.json() as {
          success: boolean;
          customersUpdated?: number;
          policiesSynced?: number;
          hasMore?: boolean;
        };

        if (result.success) {
          totalSynced += result.customersUpdated || 0;
          logger.info({
            event: 'hawksoft_batch_complete',
            offset: hsOffset,
            updated: result.customersUpdated,
            policies: result.policiesSynced,
          });
        }

        // Check if there are more customers
        hsHasMore = result.hasMore ?? false;
        hsOffset += HS_BATCH_SIZE;

        // Small delay between batches
        if (hsHasMore) {
          await sleep(500);
        }
      } catch (err) {
        logger.error({ offset: hsOffset, error: err }, 'HawkSoft batch error');
        totalErrors++;
        hsOffset += HS_BATCH_SIZE;
        await sleep(2000);
      }
    }
  }

  logger.info({
    event: 'full_sync_complete',
    totalSynced,
    totalErrors,
    pagesProcessed: page - 1,
  });

  return { synced: totalSynced, errors: totalErrors };
}

/**
 * Sleep helper
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
