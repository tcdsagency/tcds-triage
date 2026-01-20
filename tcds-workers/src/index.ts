/**
 * TCDS Workers Entry Point
 *
 * BullMQ workers for TCDS-Triage, deployed on Railway.
 * Handles background job processing for transcripts, syncs, and notifications.
 */

import 'dotenv/config';
import { validateConfig } from './config';
import { logger } from './logger';
import { startHealthServer, registerHealthChecks } from './health';
import { initializeWorkers, shutdownWorkers, getWorkersHealth } from './workers';
import { initializeScheduledJobs, getQueuesHealth, closeQueues } from './queues';
import { closeRedis } from './redis';

/**
 * Main entry point
 */
async function main() {
  logger.info('Starting TCDS Workers...');
  logger.info({
    environment: process.env.NODE_ENV,
    logLevel: process.env.LOG_LEVEL,
    nodeVersion: process.version,
  });

  // Validate configuration before starting
  try {
    validateConfig();
    logger.info('Configuration validated');
  } catch (err) {
    logger.error({ error: err }, 'Configuration validation failed');
    process.exit(1);
  }

  // Register health check functions
  registerHealthChecks(getWorkersHealth, getQueuesHealth);

  // Start health check server (Railway uses this)
  await startHealthServer();

  // Initialize scheduled/repeatable jobs
  await initializeScheduledJobs();

  // Start all workers
  await initializeWorkers();

  logger.info('All workers running and healthy');

  // Graceful shutdown handlers
  const shutdown = async (signal: string) => {
    logger.info(`${signal} received, starting graceful shutdown...`);

    try {
      // Stop accepting new jobs
      await shutdownWorkers();

      // Close queue connections
      await closeQueues();

      // Close Redis connection
      await closeRedis();

      logger.info('Shutdown complete');
      process.exit(0);
    } catch (err) {
      logger.error({ error: err }, 'Error during shutdown');
      process.exit(1);
    }
  };

  // Handle shutdown signals
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // Handle uncaught errors
  process.on('uncaughtException', (err) => {
    logger.error({ error: err }, 'Uncaught exception');
    shutdown('uncaughtException');
  });

  process.on('unhandledRejection', (reason) => {
    logger.error({ reason }, 'Unhandled rejection');
    // Don't shutdown for unhandled rejections, just log
  });
}

// Start the application
main().catch((err) => {
  logger.error({ error: err }, 'Failed to start workers');
  process.exit(1);
});
