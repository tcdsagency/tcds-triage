/**
 * Risk Monitor Worker
 *
 * Monitors insured properties for market activity and changes
 * that could indicate churn risk (listings, sales, permit activity).
 *
 * Job Types:
 * - full-scan: Check all monitored properties
 * - single-property: Check a specific property
 * - batch: Check a batch of properties
 */

import { Worker, Job } from 'bullmq';
import { redis } from '../redis';
import { config } from '../config';
import { logger } from '../logger';
import { RiskMonitorJobData } from '../queues';

/**
 * Create and return the risk monitor worker
 */
export function createRiskMonitorWorker(): Worker<RiskMonitorJobData> {
  return new Worker<RiskMonitorJobData>(
    'risk-monitor',
    async (job: Job<RiskMonitorJobData>) => {
      const { type, propertyIds } = job.data;

      logger.info({
        event: 'risk_monitor_start',
        jobId: job.id,
        type,
        propertyCount: propertyIds?.length || 'all',
      });

      const startTime = Date.now();
      let checkedCount = 0;
      let alertsCreated = 0;
      let errorCount = 0;

      try {
        switch (type) {
          case 'single-property':
            if (!propertyIds || propertyIds.length !== 1) {
              throw new Error('Single propertyId required for single-property check');
            }
            const singleResult = await checkProperty(propertyIds[0]);
            checkedCount = 1;
            alertsCreated = singleResult.alertCreated ? 1 : 0;
            break;

          case 'batch':
            if (!propertyIds || propertyIds.length === 0) {
              throw new Error('propertyIds required for batch check');
            }
            const batchResults = await checkBatchProperties(propertyIds, job);
            checkedCount = batchResults.checked;
            alertsCreated = batchResults.alerts;
            errorCount = batchResults.errors;
            break;

          case 'full-scan':
            const fullResults = await runFullScan(job);
            checkedCount = fullResults.checked;
            alertsCreated = fullResults.alerts;
            errorCount = fullResults.errors;
            break;

          default:
            throw new Error(`Unknown risk monitor type: ${type}`);
        }

        const duration = Date.now() - startTime;

        logger.info({
          event: 'risk_monitor_complete',
          jobId: job.id,
          type,
          checkedCount,
          alertsCreated,
          errorCount,
          durationMs: duration,
        });

        return {
          success: true,
          type,
          checkedCount,
          alertsCreated,
          errorCount,
          durationMs: duration,
        };
      } catch (err) {
        logger.error({
          event: 'risk_monitor_error',
          jobId: job.id,
          type,
          error: err instanceof Error ? err.message : 'Unknown error',
        });
        throw err;
      }
    },
    {
      connection: redis,
      concurrency: 1, // Sequential to respect API rate limits
      limiter: {
        max: 60,
        duration: 60000, // Max 60 per minute
      },
    }
  );
}

// =============================================================================
// CHECK FUNCTIONS
// =============================================================================

interface CheckResult {
  alertCreated: boolean;
  alertType?: string;
}

async function checkProperty(propertyId: string): Promise<CheckResult> {
  logger.debug({ propertyId }, 'Checking property for risk indicators');

  // Call main app API which has the RPR/MMI integration
  const response = await fetch(
    `${config.app.url}/api/risk-monitor/policies/${propertyId}/check`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.app.internalKey}`,
      },
    }
  );

  if (!response.ok) {
    if (response.status === 404) {
      logger.warn({ propertyId }, 'Property not found');
      return { alertCreated: false };
    }
    const errorText = await response.text();
    throw new Error(`Property check failed: ${response.status} ${errorText}`);
  }

  const result = await response.json() as { alertCreated?: boolean; alertType?: string };
  return {
    alertCreated: result.alertCreated || false,
    alertType: result.alertType,
  };
}

async function checkBatchProperties(
  propertyIds: string[],
  job: Job<RiskMonitorJobData>
): Promise<{ checked: number; alerts: number; errors: number }> {
  let checked = 0;
  let alerts = 0;
  let errors = 0;

  // Process sequentially to respect rate limits
  for (let i = 0; i < propertyIds.length; i++) {
    const propertyId = propertyIds[i];

    try {
      const result = await checkProperty(propertyId);
      checked++;
      if (result.alertCreated) alerts++;

      // Update job progress
      await job.updateProgress(Math.round(((i + 1) / propertyIds.length) * 100));
    } catch (err) {
      logger.warn({ propertyId, error: err }, 'Failed to check property');
      errors++;
    }

    // Rate limit: 1 second between checks
    if (i < propertyIds.length - 1) {
      await sleep(1000);
    }
  }

  return { checked, alerts, errors };
}

async function runFullScan(
  job: Job<RiskMonitorJobData>
): Promise<{ checked: number; alerts: number; errors: number }> {
  logger.info('Starting full risk monitor scan');

  // Fetch all actively monitored policies, paginating through results
  const allPolicies: Array<{ id: string }> = [];
  const pageSize = 500;
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const listResponse = await fetch(
      `${config.app.url}/api/risk-monitor/policies?isActive=true&limit=${pageSize}&offset=${offset}`,
      {
        headers: {
          Authorization: `Bearer ${config.app.internalKey}`,
        },
      }
    );

    if (!listResponse.ok) {
      throw new Error(`Failed to fetch property list: ${listResponse.status}`);
    }

    const policiesData = await listResponse.json() as { policies?: Array<{ id: string }>; total?: number };
    const { policies } = policiesData;

    if (!policies || policies.length === 0) {
      hasMore = false;
    } else {
      allPolicies.push(...policies);
      offset += policies.length;
      hasMore = policies.length === pageSize;
    }
  }

  if (allPolicies.length === 0) {
    logger.info('No active policies to check');
    return { checked: 0, alerts: 0, errors: 0 };
  }

  logger.info({ count: allPolicies.length }, 'Checking properties');

  // Process all properties
  const propertyIds = allPolicies.map((p) => p.id);
  return checkBatchProperties(propertyIds, job);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
