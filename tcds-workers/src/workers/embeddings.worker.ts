/**
 * Embeddings Worker
 *
 * Generates vector embeddings for knowledge base articles
 * to enable semantic search and AI-powered retrieval.
 *
 * Job Types:
 * - single: Generate embedding for a single article
 * - batch: Generate embeddings for a batch of articles
 * - pending: Process all articles pending embedding generation
 */

import { Worker, Job } from 'bullmq';
import { redis } from '../redis';
import { config } from '../config';
import { logger } from '../logger';
import { EmbeddingsJobData } from '../queues';

/**
 * Create and return the embeddings worker
 */
export function createEmbeddingsWorker(): Worker<EmbeddingsJobData> {
  return new Worker<EmbeddingsJobData>(
    'embeddings',
    async (job: Job<EmbeddingsJobData>) => {
      const { type, articleId, articleIds } = job.data;

      logger.info({
        event: 'embeddings_start',
        jobId: job.id,
        type,
        count: articleIds?.length || (articleId ? 1 : 'pending'),
      });

      const startTime = Date.now();
      let processedCount = 0;
      let errorCount = 0;

      try {
        switch (type) {
          case 'single':
            if (!articleId) {
              throw new Error('articleId required for single embedding');
            }
            await generateEmbedding(articleId);
            processedCount = 1;
            break;

          case 'batch':
            if (!articleIds || articleIds.length === 0) {
              throw new Error('articleIds required for batch embedding');
            }
            const batchResults = await generateBatchEmbeddings(articleIds, job);
            processedCount = batchResults.processed;
            errorCount = batchResults.errors;
            break;

          case 'pending':
            const pendingResults = await processPendingEmbeddings(job);
            processedCount = pendingResults.processed;
            errorCount = pendingResults.errors;
            break;

          default:
            throw new Error(`Unknown embeddings type: ${type}`);
        }

        const duration = Date.now() - startTime;

        logger.info({
          event: 'embeddings_complete',
          jobId: job.id,
          type,
          processedCount,
          errorCount,
          durationMs: duration,
        });

        return {
          success: true,
          type,
          processedCount,
          errorCount,
          durationMs: duration,
        };
      } catch (err) {
        logger.error({
          event: 'embeddings_error',
          jobId: job.id,
          type,
          error: err instanceof Error ? err.message : 'Unknown error',
        });
        throw err;
      }
    },
    {
      connection: redis,
      concurrency: 2,
      limiter: {
        max: 20,
        duration: 60000, // Max 20 per minute (OpenAI rate limits)
      },
    }
  );
}

// =============================================================================
// EMBEDDING FUNCTIONS
// =============================================================================

async function generateEmbedding(articleId: string): Promise<void> {
  logger.debug({ articleId }, 'Generating embedding for article');

  // Call main app API which handles embedding generation
  const response = await fetch(`${config.app.url}/api/ai/embeddings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.app.internalKey}`,
    },
    body: JSON.stringify({
      articleId,
    }),
  });

  if (!response.ok) {
    if (response.status === 404) {
      logger.warn({ articleId }, 'Article not found');
      return;
    }
    const errorText = await response.text();
    throw new Error(`Embedding generation failed: ${response.status} ${errorText}`);
  }
}

async function generateBatchEmbeddings(
  articleIds: string[],
  job: Job<EmbeddingsJobData>
): Promise<{ processed: number; errors: number }> {
  let processed = 0;
  let errors = 0;

  // Process in batches to respect rate limits
  const batchSize = 5;
  for (let i = 0; i < articleIds.length; i += batchSize) {
    const batch = articleIds.slice(i, i + batchSize);

    await Promise.all(
      batch.map(async (id) => {
        try {
          await generateEmbedding(id);
          processed++;
        } catch (err) {
          logger.warn({ articleId: id, error: err }, 'Failed to generate embedding');
          errors++;
        }
      })
    );

    // Update job progress
    await job.updateProgress(
      Math.round((Math.min(i + batchSize, articleIds.length) / articleIds.length) * 100)
    );

    // Rate limit pause between batches
    if (i + batchSize < articleIds.length) {
      await sleep(3000); // 3 second pause between batches
    }
  }

  return { processed, errors };
}

async function processPendingEmbeddings(
  job: Job<EmbeddingsJobData>
): Promise<{ processed: number; errors: number }> {
  logger.info('Processing pending embeddings');

  // Fetch articles that need embedding
  const response = await fetch(
    `${config.app.url}/api/ai/embeddings/pending?limit=100`,
    {
      headers: {
        Authorization: `Bearer ${config.app.internalKey}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch pending articles: ${response.status}`);
  }

  const data = await response.json() as { articles?: Array<{ id: string }> };
  const { articles } = data;

  if (!articles || articles.length === 0) {
    logger.info('No pending articles to process');
    return { processed: 0, errors: 0 };
  }

  logger.info({ count: articles.length }, 'Processing pending articles');

  const articleIds = articles.map((a) => a.id);
  return generateBatchEmbeddings(articleIds, job);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
