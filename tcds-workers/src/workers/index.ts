/**
 * Workers Module
 *
 * Initializes and manages all BullMQ workers.
 * Provides centralized event handling and graceful shutdown.
 */

import { Worker } from 'bullmq';
import { logger } from '../logger';
import { getSupabaseClient } from '../db';
import { createTranscriptWorker } from './transcript.worker';
import { createCustomerSyncWorker } from './customer-sync.worker';
import { createRiskMonitorWorker } from './risk-monitor.worker';
import { createEmbeddingsWorker } from './embeddings.worker';
import { createNotificationsWorker } from './notifications.worker';
import { createRenewalWorker } from './renewal.worker';

// Store all worker instances for management
const workers: Worker[] = [];

/**
 * Initialize and start all workers
 */
export async function initializeWorkers(): Promise<void> {
  logger.info('Starting workers...');

  // Create all worker instances
  workers.push(
    createTranscriptWorker(),
    createCustomerSyncWorker(),
    createRiskMonitorWorker(),
    createEmbeddingsWorker(),
    createNotificationsWorker(),
    createRenewalWorker()
  );

  // Attach event handlers to each worker
  workers.forEach((worker) => {
    // Log completed jobs
    worker.on('completed', (job) => {
      logger.info({
        event: 'job_completed',
        worker: worker.name,
        jobId: job.id,
        jobName: job.name,
        duration: job.finishedOn && job.processedOn
          ? job.finishedOn - job.processedOn
          : undefined,
      });
    });

    // Log failed jobs with full error details
    worker.on('failed', (job, err) => {
      logger.error({
        event: 'job_failed',
        worker: worker.name,
        jobId: job?.id,
        jobName: job?.name,
        attemptsMade: job?.attemptsMade,
        error: err.message,
        stack: err.stack,
      });

      // Record exhausted jobs (all retries used) to dead_letter_jobs table
      if (job && job.attemptsMade >= (job.opts?.attempts ?? 1)) {
        const supabase = getSupabaseClient();
        (supabase
          .from('dead_letter_jobs') as any)
          .insert({
            queue_name: worker.name,
            job_id: String(job.id),
            job_name: job.name,
            job_data: job.data,
            error: err.message,
            stack: err.stack,
            attempts_made: job.attemptsMade,
            failed_at: new Date().toISOString(),
          })
          .then(({ error: insertErr }: { error: any }) => {
            if (insertErr) {
              logger.error({ event: 'dead_letter_insert_failed', jobId: job.id, error: insertErr.message });
            } else {
              logger.info({ event: 'dead_letter_recorded', worker: worker.name, jobId: job.id });
            }
          });
      }
    });

    // Log worker errors (connection issues, etc.)
    worker.on('error', (err) => {
      logger.error({
        event: 'worker_error',
        worker: worker.name,
        error: err.message,
      });
    });

    // Log stalled jobs (jobs that haven't reported progress)
    worker.on('stalled', (jobId) => {
      logger.warn({
        event: 'job_stalled',
        worker: worker.name,
        jobId,
      });
    });

    // Log when job is active (started processing)
    worker.on('active', (job) => {
      logger.debug({
        event: 'job_active',
        worker: worker.name,
        jobId: job.id,
        jobName: job.name,
      });
    });

    // Log job progress updates
    worker.on('progress', (job, progress) => {
      logger.debug({
        event: 'job_progress',
        worker: worker.name,
        jobId: job.id,
        progress,
      });
    });
  });

  logger.info(`Started ${workers.length} workers: ${workers.map((w) => w.name).join(', ')}`);
}

/**
 * Gracefully shutdown all workers
 * Waits for active jobs to complete before closing
 */
export async function shutdownWorkers(): Promise<void> {
  logger.info('Shutting down workers gracefully...');

  const shutdownPromises = workers.map(async (worker) => {
    try {
      logger.info(`Closing worker: ${worker.name}`);
      await worker.close();
      logger.info(`Worker closed: ${worker.name}`);
    } catch (err) {
      logger.error({ worker: worker.name, error: err }, 'Error closing worker');
    }
  });

  await Promise.all(shutdownPromises);
  logger.info('All workers stopped');
}

/**
 * Get health status of all workers
 */
export async function getWorkersHealth(): Promise<{
  healthy: boolean;
  workers: Array<{ name: string; running: boolean; paused: boolean }>;
}> {
  const status = await Promise.all(
    workers.map(async (w) => ({
      name: w.name,
      running: w.isRunning(),
      paused: await w.isPaused(),
    }))
  );

  return {
    healthy: status.every((w) => w.running && !w.paused),
    workers: status,
  };
}

/**
 * Pause a specific worker by name
 */
export async function pauseWorker(name: string): Promise<boolean> {
  const worker = workers.find((w) => w.name === name);
  if (worker) {
    await worker.pause();
    logger.info({ worker: name }, 'Worker paused');
    return true;
  }
  return false;
}

/**
 * Resume a specific worker by name
 */
export async function resumeWorker(name: string): Promise<boolean> {
  const worker = workers.find((w) => w.name === name);
  if (worker) {
    worker.resume();
    logger.info({ worker: name }, 'Worker resumed');
    return true;
  }
  return false;
}
