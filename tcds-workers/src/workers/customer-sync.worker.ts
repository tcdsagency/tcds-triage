/**
 * Customer Sync Worker
 *
 * Syncs customer data from external CRMs (AgencyZoom, HawkSoft)
 * to the local database for faster lookups and unified profiles.
 *
 * Job Types:
 * - single: Sync a single customer by ID
 * - batch: Sync a batch of customers by IDs
 * - full: Full sync of all customers
 */

import { Worker, Job } from 'bullmq';
import { redis } from '../redis';
import { config } from '../config';
import { logger } from '../logger';
import { CustomerSyncJobData } from '../queues';

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
            const fullResults = await syncAllCustomers(provider);
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
      concurrency: 3,
      limiter: {
        max: 30,
        duration: 60000, // Max 30 jobs per minute
      },
    }
  );
}

// =============================================================================
// SYNC FUNCTIONS (STUBS - Implement actual logic)
// =============================================================================

async function syncSingleCustomer(
  customerId: string,
  provider?: 'agencyzoom' | 'hawksoft' | 'both'
): Promise<void> {
  logger.debug({ customerId, provider }, 'Syncing single customer');

  // TODO: Implement actual sync logic:
  // 1. Fetch customer from AgencyZoom/HawkSoft API
  // 2. Transform to local schema
  // 3. Upsert to Supabase database
  // 4. Sync related data (policies, notes, etc.)

  // Placeholder - call main app API which has the sync logic
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

async function syncBatchCustomers(
  customerIds: string[],
  provider?: 'agencyzoom' | 'hawksoft' | 'both'
): Promise<{ synced: number; errors: number }> {
  logger.debug({ count: customerIds.length, provider }, 'Syncing batch of customers');

  let synced = 0;
  let errors = 0;

  // Process in smaller batches to avoid rate limits
  const batchSize = 10;
  for (let i = 0; i < customerIds.length; i += batchSize) {
    const batch = customerIds.slice(i, i + batchSize);

    await Promise.all(
      batch.map(async (id) => {
        try {
          await syncSingleCustomer(id, provider);
          synced++;
        } catch (err) {
          logger.warn({ customerId: id, error: err }, 'Failed to sync customer');
          errors++;
        }
      })
    );

    // Rate limit pause between batches
    if (i + batchSize < customerIds.length) {
      await sleep(1000);
    }
  }

  return { synced, errors };
}

async function syncAllCustomers(
  provider?: 'agencyzoom' | 'hawksoft' | 'both'
): Promise<{ synced: number; errors: number }> {
  logger.info({ provider }, 'Starting full customer sync');

  // Call main app API which orchestrates the full sync
  const response = await fetch(`${config.app.url}/api/sync/customers`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.app.internalKey}`,
    },
    body: JSON.stringify({
      type: 'full',
      provider,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Full sync failed: ${response.status} ${errorText}`);
  }

  const result = await response.json() as { synced?: number; errors?: number };
  return {
    synced: result.synced || 0,
    errors: result.errors || 0,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
