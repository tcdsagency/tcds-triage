/**
 * Redis Connection Module
 *
 * Creates and manages the Redis connection for BullMQ.
 * Uses Upstash Redis with automatic reconnection.
 */

import Redis from 'ioredis';
import { logger } from './logger';

// Get Redis URL directly to avoid circular dependency
const redisUrl = process.env.REDIS_URL;

if (!redisUrl) {
  throw new Error('REDIS_URL environment variable is required');
}

/**
 * Redis connection instance shared by all queues and workers.
 *
 * Configuration notes:
 * - maxRetriesPerRequest: null is REQUIRED for BullMQ
 * - enableReadyCheck: false prevents issues with Upstash
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const redis: any = new Redis(redisUrl, {
  maxRetriesPerRequest: null, // Required for BullMQ
  enableReadyCheck: false,
  tls: {
    rejectUnauthorized: false, // Required for Upstash
  },
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    logger.warn(`Redis connection retry #${times}, waiting ${delay}ms`);
    return delay;
  },
  reconnectOnError: (err: Error) => {
    const targetError = 'READONLY';
    if (err.message.includes(targetError)) {
      // Only reconnect when the error contains "READONLY"
      return true;
    }
    return false;
  },
});

redis.on('connect', () => {
  logger.info('Connected to Redis (Upstash)');
});

redis.on('ready', () => {
  logger.info('Redis connection ready');
});

redis.on('error', (err: Error) => {
  logger.error({ error: err.message }, 'Redis error');
});

redis.on('close', () => {
  logger.warn('Redis connection closed');
});

redis.on('reconnecting', () => {
  logger.info('Redis reconnecting...');
});

/**
 * Check Redis health
 */
export async function checkRedisHealth(): Promise<boolean> {
  try {
    const result = await redis.ping();
    return result === 'PONG';
  } catch {
    return false;
  }
}

/**
 * Close Redis connection gracefully
 */
export async function closeRedis(): Promise<void> {
  await redis.quit();
  logger.info('Redis connection closed');
}
