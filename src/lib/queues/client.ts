/**
 * BullMQ Queue Client
 *
 * Client for adding jobs to BullMQ queues from the Vercel app.
 * Jobs are processed by the Railway workers package.
 */

import { Queue, type ConnectionOptions } from 'bullmq';
import IORedis from 'ioredis';

// =============================================================================
// REDIS CONNECTION
// =============================================================================

// Single shared connection instance
let sharedConnection: IORedis | null = null;

/**
 * Get Redis connection for BullMQ.
 * Uses a single shared connection to avoid connection limits.
 */
function getRedisConnection(): ConnectionOptions {
  if (!sharedConnection) {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
      throw new Error('REDIS_URL environment variable is required for queue operations');
    }

    sharedConnection = new IORedis(redisUrl, {
      maxRetriesPerRequest: null, // Required for BullMQ
      enableReadyCheck: false,
      lazyConnect: true,
      tls: {
        rejectUnauthorized: false, // Required for Upstash
      },
    });
  }
  // Cast to any to avoid ioredis version conflicts between packages
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return sharedConnection as any;
}

// =============================================================================
// JOB DATA INTERFACES
// =============================================================================

/**
 * Transcript processing job data
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
 */
export interface RiskMonitorJobData {
  type: 'full-scan' | 'single-property' | 'batch';
  propertyIds?: string[];
}

/**
 * Embeddings job data
 */
export interface EmbeddingsJobData {
  type: 'single' | 'batch' | 'pending';
  articleId?: string;
  articleIds?: string[];
}

/**
 * Notification job data
 */
export interface NotificationJobData {
  type: 'email' | 'sms' | 'payment_reminder' | 'policy_expiration';
  recipientId?: string;
  templateId?: string;
  data?: Record<string, unknown>;
}

/**
 * Weather alert job data
 */
export interface WeatherAlertJobData {
  type: 'poll' | 'single-zone' | 'test';
  zoneIds?: string[];
  subscriptionIds?: string[];
}

// =============================================================================
// QUEUE INSTANCES (LAZY LOADED)
// =============================================================================

// Using 'any' for queue instances due to BullMQ 5.x complex generic types
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let transcriptQueue: Queue<any> | null = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let customerSyncQueue: Queue<any> | null = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let riskMonitorQueue: Queue<any> | null = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let embeddingsQueue: Queue<any> | null = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let notificationsQueue: Queue<any> | null = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let weatherAlertsQueue: Queue<any> | null = null;

function getTranscriptQueue() {
  if (!transcriptQueue) {
    transcriptQueue = new Queue('transcript-processing', {
      connection: getRedisConnection(),
    });
  }
  return transcriptQueue;
}

function getCustomerSyncQueue() {
  if (!customerSyncQueue) {
    customerSyncQueue = new Queue('customer-sync', {
      connection: getRedisConnection(),
    });
  }
  return customerSyncQueue;
}

function getRiskMonitorQueue() {
  if (!riskMonitorQueue) {
    riskMonitorQueue = new Queue('risk-monitor', {
      connection: getRedisConnection(),
    });
  }
  return riskMonitorQueue;
}

function getEmbeddingsQueue() {
  if (!embeddingsQueue) {
    embeddingsQueue = new Queue('embeddings', {
      connection: getRedisConnection(),
    });
  }
  return embeddingsQueue;
}

function getNotificationsQueue() {
  if (!notificationsQueue) {
    notificationsQueue = new Queue('notifications', {
      connection: getRedisConnection(),
    });
  }
  return notificationsQueue;
}

function getWeatherAlertsQueue() {
  if (!weatherAlertsQueue) {
    weatherAlertsQueue = new Queue('weather-alerts', {
      connection: getRedisConnection(),
    });
  }
  return weatherAlertsQueue;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Queue a transcript processing job
 * Called when a call ends to extract and analyze the transcript
 *
 * @param data Call data for transcript processing
 * @returns The created job
 */
export async function queueTranscriptProcessing(
  data: Omit<TranscriptJobData, 'source'>
) {
  const queue = getTranscriptQueue();

  const job = await queue.add(
    'process-transcript',
    { ...data, source: 'call_ended_webhook' as const },
    {
      delay: 30000, // 30 second delay for SQL Server to write transcript
      jobId: `transcript-${data.callId}`, // Prevent duplicate jobs
      priority: 1,
      attempts: 10,
      backoff: {
        type: 'exponential',
        delay: 10000, // Start at 10s
      },
    }
  );

  console.log(`[Queue] Transcript job queued: ${job.id} for call ${data.callId}`);
  return job;
}

/**
 * Queue a manual transcript retry
 * Used when automatic processing failed
 */
export async function queueTranscriptRetry(data: Omit<TranscriptJobData, 'source'>) {
  const queue = getTranscriptQueue();

  const job = await queue.add(
    'process-transcript',
    { ...data, source: 'manual_retry' as const },
    {
      jobId: `transcript-retry-${data.callId}-${Date.now()}`,
      priority: 2, // Higher priority than regular jobs
      attempts: 5,
    }
  );

  console.log(`[Queue] Transcript retry queued: ${job.id}`);
  return job;
}

/**
 * Queue a customer sync job
 */
export async function queueCustomerSync(data: CustomerSyncJobData) {
  const queue = getCustomerSyncQueue();

  const jobId = data.type === 'single'
    ? `sync-${data.customerId}`
    : `sync-${data.type}-${Date.now()}`;

  const job = await queue.add('customer-sync', data, {
    jobId,
    attempts: 5,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
  });

  console.log(`[Queue] Customer sync job queued: ${job.id}`);
  return job;
}

/**
 * Queue a risk monitor check
 */
export async function queueRiskMonitorCheck(data: RiskMonitorJobData) {
  const queue = getRiskMonitorQueue();

  const job = await queue.add('risk-check', data, {
    jobId: data.type === 'single-property' && data.propertyIds?.[0]
      ? `risk-${data.propertyIds[0]}`
      : `risk-${data.type}-${Date.now()}`,
    attempts: 3,
  });

  console.log(`[Queue] Risk monitor job queued: ${job.id}`);
  return job;
}

/**
 * Queue an embeddings job
 */
export async function queueEmbeddingsJob(data: EmbeddingsJobData) {
  const queue = getEmbeddingsQueue();

  const job = await queue.add('generate-embeddings', data, {
    jobId: data.type === 'single' && data.articleId
      ? `embed-${data.articleId}`
      : `embed-${data.type}-${Date.now()}`,
    attempts: 5,
  });

  console.log(`[Queue] Embeddings job queued: ${job.id}`);
  return job;
}

/**
 * Queue a notification
 */
export async function queueNotification(data: NotificationJobData) {
  const queue = getNotificationsQueue();

  const job = await queue.add('send-notification', data, {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
  });

  console.log(`[Queue] Notification job queued: ${job.id}`);
  return job;
}

/**
 * Queue a weather alert check
 */
export async function queueWeatherAlertCheck(data: WeatherAlertJobData) {
  const queue = getWeatherAlertsQueue();

  const job = await queue.add('weather-check', data, {
    jobId: data.type === 'single-zone' && data.zoneIds?.[0]
      ? `weather-${data.zoneIds[0]}-${Date.now()}`
      : `weather-${data.type}-${Date.now()}`,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
  });

  console.log(`[Queue] Weather alert job queued: ${job.id}`);
  return job;
}

// =============================================================================
// RENEWAL PROCESSING
// =============================================================================

/**
 * Renewal processing job data
 */
export interface RenewalBatchJobData {
  batchId: string;
  tenantId: string;
  storagePath: string;
  fileBuffer?: string; // Base64 encoded for in-memory processing
  originalFileName?: string;
  forceAsRenewal?: boolean; // Bypass date check — treat all transactions as renewals
}

export interface RenewalCandidateJobData {
  candidateId: string;
  tenantId: string;
  batchId: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let renewalQueue: Queue<any> | null = null;

function getRenewalQueue() {
  if (!renewalQueue) {
    renewalQueue = new Queue('renewal-processing', {
      connection: getRedisConnection(),
    });
  }
  return renewalQueue;
}

/**
 * Queue a renewal batch for processing
 */
export async function queueRenewalBatchProcessing(data: RenewalBatchJobData) {
  const queue = getRenewalQueue();

  const job = await queue.add('process-batch', data, {
    jobId: `renewal-batch-${data.batchId}`,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 10000,
    },
  });

  console.log(`[Queue] Renewal batch job queued: ${job.id}`);
  return job;
}

/**
 * Queue a single renewal candidate for processing
 */
export async function queueRenewalCandidateProcessing(data: RenewalCandidateJobData) {
  const queue = getRenewalQueue();

  const job = await queue.add('process-candidate', data, {
    jobId: `renewal-candidate-${data.candidateId}`,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 10000,
    },
  });

  console.log(`[Queue] Renewal candidate job queued: ${job.id}`);
  return job;
}

// =============================================================================
// QUEUE STATS (for monitoring)
// =============================================================================

/**
 * Get statistics for all queues
 */
export async function getQueueStats() {
  const queues = [
    { name: 'transcript-processing', queue: getTranscriptQueue() },
    { name: 'customer-sync', queue: getCustomerSyncQueue() },
    { name: 'risk-monitor', queue: getRiskMonitorQueue() },
    { name: 'embeddings', queue: getEmbeddingsQueue() },
    { name: 'notifications', queue: getNotificationsQueue() },
    { name: 'renewal-processing', queue: getRenewalQueue() },
    { name: 'weather-alerts', queue: getWeatherAlertsQueue() },
  ];

  const stats = await Promise.all(
    queues.map(async ({ name, queue }) => {
      const [waiting, active, completed, failed, delayed] = await Promise.all([
        queue.getWaitingCount(),
        queue.getActiveCount(),
        queue.getCompletedCount(),
        queue.getFailedCount(),
        queue.getDelayedCount(),
      ]);
      return { name, waiting, active, completed, failed, delayed };
    })
  );

  return stats;
}

/**
 * Get a specific job by ID
 */
export async function getJob(queueName: string, jobId: string) {
  let queue: Queue;

  switch (queueName) {
    case 'transcript-processing':
      queue = getTranscriptQueue();
      break;
    case 'customer-sync':
      queue = getCustomerSyncQueue();
      break;
    case 'risk-monitor':
      queue = getRiskMonitorQueue();
      break;
    case 'embeddings':
      queue = getEmbeddingsQueue();
      break;
    case 'notifications':
      queue = getNotificationsQueue();
      break;
    case 'renewal-processing':
      queue = getRenewalQueue();
      break;
    case 'weather-alerts':
      queue = getWeatherAlertsQueue();
      break;
    default:
      throw new Error(`Unknown queue: ${queueName}`);
  }

  return queue.getJob(jobId);
}
