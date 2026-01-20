/**
 * Health Check Server
 *
 * HTTP server for Railway health checks and metrics.
 * Exposes /health and /metrics endpoints.
 */

import http from 'http';
import { logger } from './logger';
import { checkRedisHealth } from './redis';

// Get port directly to avoid circular dependency
const port = parseInt(process.env.PORT || '3001', 10);

// These will be set after workers/queues are initialized
let getWorkersHealthFn: (() => Promise<WorkersHealth>) | null = null;
let getQueuesHealthFn: (() => Promise<QueuesHealth>) | null = null;

interface WorkersHealth {
  healthy: boolean;
  workers: Array<{ name: string; running: boolean }>;
}

interface QueuesHealth {
  healthy: boolean;
  queues: Array<{
    name: string;
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  }>;
}

/**
 * Register health check functions from workers and queues modules
 */
export function registerHealthChecks(
  workersHealthFn: () => Promise<WorkersHealth>,
  queuesHealthFn: () => Promise<QueuesHealth>
): void {
  getWorkersHealthFn = workersHealthFn;
  getQueuesHealthFn = queuesHealthFn;
}

/**
 * Start the health check HTTP server
 */
export async function startHealthServer(): Promise<http.Server> {
  const server = http.createServer(async (req, res) => {
    // Health check endpoint (Railway uses this)
    if (req.url === '/health' || req.url === '/') {
      try {
        const redisHealthy = await checkRedisHealth();

        const workersHealth = getWorkersHealthFn
          ? await getWorkersHealthFn()
          : { healthy: true, workers: [] };

        const queuesHealth = getQueuesHealthFn
          ? await getQueuesHealthFn()
          : { healthy: true, queues: [] };

        const isHealthy = redisHealthy && workersHealth.healthy && queuesHealth.healthy;

        res.writeHead(isHealthy ? 200 : 503, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify(
            {
              status: isHealthy ? 'healthy' : 'unhealthy',
              timestamp: new Date().toISOString(),
              uptime: process.uptime(),
              redis: redisHealthy,
              workers: workersHealth,
              queues: queuesHealth,
            },
            null,
            2
          )
        );
      } catch (err) {
        logger.error({ error: err }, 'Health check error');
        res.writeHead(503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'error', error: String(err) }));
      }
      return;
    }

    // Metrics endpoint - detailed queue stats
    if (req.url === '/metrics') {
      try {
        const queuesHealth = getQueuesHealthFn
          ? await getQueuesHealthFn()
          : { healthy: true, queues: [] };

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(queuesHealth, null, 2));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: String(err) }));
      }
      return;
    }

    // Ready endpoint - for Kubernetes-style readiness probes
    if (req.url === '/ready') {
      const redisHealthy = await checkRedisHealth();
      res.writeHead(redisHealthy ? 200 : 503);
      res.end(redisHealthy ? 'ready' : 'not ready');
      return;
    }

    // Live endpoint - for liveness probes
    if (req.url === '/live') {
      res.writeHead(200);
      res.end('alive');
      return;
    }

    res.writeHead(404);
    res.end('Not found');
  });

  return new Promise((resolve, reject) => {
    server.on('error', (err) => {
      logger.error({ error: err }, 'Health server error');
      reject(err);
    });

    server.listen(port, '0.0.0.0', () => {
      logger.info(`Health server listening on port ${port}`);
      resolve(server);
    });
  });
}
