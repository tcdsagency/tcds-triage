/**
 * Queue Definitions
 *
 * Defines all BullMQ queues with their job data interfaces,
 * default options, and scheduled jobs.
 */

import { Queue } from 'bullmq';
import { redis } from '../redis';
import { logger } from '../logger';

// =============================================================================
// JOB DATA INTERFACES
// =============================================================================

/**
 * Transcript processing job data
 * Created when a call ends to extract and analyze the transcript
 */
export interface TranscriptJobData {
  callId: string;
  externalCallId: string;
  extension: string;
  callerNumber: string;
  callerName?: string;
  agentId: string;
  callStartedAt: string;
  callEndedAt: string;
  source: 'call_ended_webhook' | 'manual_retry';
}

/**
 * Customer sync job data
 * Syncs customer data from AgencyZoom and/or HawkSoft
 */
export interface CustomerSyncJobData {
  type: 'single' | 'batch' | 'full';
  source: 'webhook' | 'scheduled' | 'manual';
  customerId?: string;
  customerIds?: string[];
  provider?: 'agencyzoom' | 'hawksoft' | 'both';
}

/**
 * Risk monitor job data
 * Checks properties for market activity and changes
 */
export interface RiskMonitorJobData {
  type: 'full-scan' | 'single-property' | 'batch';
  propertyIds?: string[];
}

/**
 * Embeddings job data
 * Generates vector embeddings for knowledge base articles
 */
export interface EmbeddingsJobData {
  type: 'single' | 'batch' | 'pending';
  articleId?: string;
  articleIds?: string[];
}

/**
 * Notification job data
 * Sends emails, SMS, and other notifications
 */
export interface NotificationJobData {
  type: 'email' | 'sms' | 'payment_reminder' | 'policy_expiration';
  recipientId?: string;
  templateId?: string;
  data?: Record<string, unknown>;
}

// =============================================================================
// DEFAULT JOB OPTIONS
// =============================================================================

const defaultJobOptions = {
  attempts: 5,
  backoff: {
    type: 'exponential' as const,
    delay: 5000, // 5s, 10s, 20s, 40s, 80s
  },
  removeOnComplete: {
    count: 100, // Keep last 100 completed jobs
    age: 24 * 60 * 60, // Or jobs older than 24 hours
  },
  removeOnFail: {
    count: 50, // Keep last 50 failed jobs
    age: 7 * 24 * 60 * 60, // Or jobs older than 7 days
  },
};

// =============================================================================
// QUEUE INSTANCES
// =============================================================================

/**
 * Transcript Processing Queue
 * Handles post-call transcript extraction and AI analysis
 */
export const transcriptQueue = new Queue<TranscriptJobData>('transcript-processing', {
  connection: redis,
  defaultJobOptions: {
    ...defaultJobOptions,
    attempts: 10, // More attempts - waiting on SQL Server write delay
    backoff: {
      type: 'exponential' as const,
      delay: 10000, // Start at 10s for SQL Server delay
    },
  },
});

/**
 * Customer Sync Queue
 * Syncs customer data from external CRMs
 */
export const customerSyncQueue = new Queue<CustomerSyncJobData>('customer-sync', {
  connection: redis,
  defaultJobOptions,
});

/**
 * Risk Monitor Queue
 * Monitors properties for market changes
 */
export const riskMonitorQueue = new Queue<RiskMonitorJobData>('risk-monitor', {
  connection: redis,
  defaultJobOptions: {
    ...defaultJobOptions,
    attempts: 3, // Fewer attempts for batch jobs
  },
});

/**
 * Embeddings Queue
 * Generates vector embeddings for semantic search
 */
export const embeddingsQueue = new Queue<EmbeddingsJobData>('embeddings', {
  connection: redis,
  defaultJobOptions,
});

/**
 * Notifications Queue
 * Sends emails, SMS, and other notifications
 */
export const notificationsQueue = new Queue<NotificationJobData>('notifications', {
  connection: redis,
  defaultJobOptions: {
    ...defaultJobOptions,
    attempts: 3,
  },
});

/**
 * Renewal Processing Queue
 * Processes IVANS AL3 batch downloads and individual renewal candidates
 */
export interface RenewalBatchJobData {
  batchId: string;
  tenantId: string;
  storagePath: string;
  fileBuffer?: string; // Base64 encoded for in-memory processing
}

export interface RenewalCandidateJobData {
  candidateId: string;
  tenantId: string;
  batchId: string;
}

export interface RenewalCheckJobData {
  // Empty — uses DEFAULT_TENANT_ID from env
}

export const renewalQueue = new Queue<RenewalBatchJobData | RenewalCandidateJobData | RenewalCheckJobData>('renewal-processing', {
  connection: redis,
  defaultJobOptions: {
    ...defaultJobOptions,
    attempts: 3,
    backoff: {
      type: 'exponential' as const,
      delay: 10000, // Start at 10s
    },
  },
});

// =============================================================================
// SCHEDULED JOBS
// =============================================================================

/**
 * Initialize all scheduled/repeatable jobs.
 * Uses upsertJobScheduler to idempotently create schedules.
 */
export async function initializeScheduledJobs(): Promise<void> {
  logger.info('Initializing scheduled jobs...');

  try {
    // Customer Sync - Every hour at :00
    await customerSyncQueue.upsertJobScheduler(
      'customer-sync-hourly',
      { pattern: '0 * * * *' },
      {
        name: 'scheduled-sync',
        data: { type: 'full', source: 'scheduled', provider: 'both' },
      }
    );
    logger.info('Scheduled: customer-sync-hourly (every hour)');

    // Risk Monitor - Daily at 6 AM Central
    await riskMonitorQueue.upsertJobScheduler(
      'risk-monitor-daily',
      { pattern: '0 6 * * *', tz: 'America/Chicago' },
      {
        name: 'daily-scan',
        data: { type: 'full-scan' },
      }
    );
    logger.info('Scheduled: risk-monitor-daily (6 AM CT)');

    // Embeddings - DISABLED (endpoint not implemented yet)
    // await embeddingsQueue.upsertJobScheduler(
    //   'embeddings-daily',
    //   { pattern: '0 2 * * *', tz: 'America/Chicago' },
    //   {
    //     name: 'process-pending',
    //     data: { type: 'pending' },
    //   }
    // );
    // logger.info('Scheduled: embeddings-daily (2 AM CT)');
    logger.info('Skipped: embeddings-daily (disabled)');

    // Payment Reminders - Daily at 8 AM Central
    await notificationsQueue.upsertJobScheduler(
      'payment-reminders-daily',
      { pattern: '0 8 * * *', tz: 'America/Chicago' },
      {
        name: 'payment-reminders',
        data: { type: 'payment_reminder' },
      }
    );
    logger.info('Scheduled: payment-reminders-daily (8 AM CT)');

    // Policy Expiration Notices - Daily at 9 AM Central
    await notificationsQueue.upsertJobScheduler(
      'expiration-notices-daily',
      { pattern: '0 9 * * *', tz: 'America/Chicago' },
      {
        name: 'expiration-notices',
        data: { type: 'policy_expiration' },
      }
    );
    logger.info('Scheduled: expiration-notices-daily (9 AM CT)');

    // Non-AL3 Renewal Check - Daily at 6 AM Central
    // Finds active policies expiring within 45 days with no AL3 baseline
    await (renewalQueue as Queue).upsertJobScheduler(
      'check-non-al3-renewals-daily',
      { pattern: '0 6 * * *', tz: 'America/Chicago' },
      {
        name: 'check-non-al3-renewals',
        data: {},
      }
    );
    logger.info('Scheduled: check-non-al3-renewals-daily (6 AM CT)');

    logger.info('All scheduled jobs initialized');
  } catch (err) {
    logger.error({ error: err }, 'Failed to initialize scheduled jobs');
    throw err;
  }
}

// =============================================================================
// HEALTH CHECK
// =============================================================================

/**
 * Get health status of all queues
 */
export async function getQueuesHealth(): Promise<{
  healthy: boolean;
  queues: Array<{
    name: string;
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  }>;
}> {
  const queues = [
    { name: 'transcript-processing', queue: transcriptQueue },
    { name: 'customer-sync', queue: customerSyncQueue },
    { name: 'risk-monitor', queue: riskMonitorQueue },
    { name: 'embeddings', queue: embeddingsQueue },
    { name: 'notifications', queue: notificationsQueue },
    { name: 'renewal-processing', queue: renewalQueue },
  ];

  const results = await Promise.all(
    queues.map(async ({ name, queue }) => {
      try {
        const [waiting, active, completed, failed, delayed] = await Promise.all([
          queue.getWaitingCount(),
          queue.getActiveCount(),
          queue.getCompletedCount(),
          queue.getFailedCount(),
          queue.getDelayedCount(),
        ]);
        return { name, waiting, active, completed, failed, delayed };
      } catch (err) {
        logger.error({ queue: name, error: err }, 'Failed to get queue stats');
        return { name, waiting: -1, active: -1, completed: -1, failed: -1, delayed: -1 };
      }
    })
  );

  // Consider unhealthy if any queue has > 100 waiting jobs or stats failed
  const healthy = results.every((q) => q.waiting >= 0 && q.waiting < 100);

  return { healthy, queues: results };
}

/**
 * Close all queue connections gracefully
 */
export async function closeQueues(): Promise<void> {
  await Promise.all([
    transcriptQueue.close(),
    customerSyncQueue.close(),
    riskMonitorQueue.close(),
    embeddingsQueue.close(),
    notificationsQueue.close(),
    renewalQueue.close(),
  ]);
  logger.info('All queues closed');
}
