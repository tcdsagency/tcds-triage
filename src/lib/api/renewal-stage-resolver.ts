/**
 * Renewal Stage Resolver
 * ======================
 * Resolves canonical renewal stage names to/from AgencyZoom stage IDs.
 * Checks in-memory constants first, falls back to DB lookup, caches results.
 */

import { db } from '@/db';
import { azPipelineStageConfig } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import {
  SERVICE_PIPELINES,
  PIPELINE_STAGES,
  RENEWAL_CANONICAL_TO_STAGE,
} from './agencyzoom-service-tickets';

// In-memory cache (per-tenant)
const stageIdCache = new Map<string, number>(); // "tenantId:canonical" -> stageId
const stageNameCache = new Map<string, string>(); // "tenantId:stageId" -> canonical

export type RenewalCanonicalStage =
  | 'policy_pending_review'
  | 'waiting_agent_review'
  | 'contact_customer'
  | 'unable_to_contact'
  | 'requote_requested'
  | 'quote_ready_ezl'
  | 'waiting_customer'
  | 'completed';

/**
 * Resolve a canonical stage name to an AZ stage ID.
 */
export async function resolveRenewalStageId(
  tenantId: string,
  canonicalName: RenewalCanonicalStage
): Promise<number | null> {
  // Check in-memory constants first
  const constantKey = `RENEWALS_${canonicalName.toUpperCase()}` as keyof typeof PIPELINE_STAGES;
  if (PIPELINE_STAGES[constantKey]) {
    return PIPELINE_STAGES[constantKey];
  }

  // Check canonical map
  if (RENEWAL_CANONICAL_TO_STAGE[canonicalName]) {
    return RENEWAL_CANONICAL_TO_STAGE[canonicalName];
  }

  // Check cache
  const cacheKey = `${tenantId}:${canonicalName}`;
  if (stageIdCache.has(cacheKey)) {
    return stageIdCache.get(cacheKey)!;
  }

  // Fall back to DB
  const [config] = await db
    .select()
    .from(azPipelineStageConfig)
    .where(
      and(
        eq(azPipelineStageConfig.tenantId, tenantId),
        eq(azPipelineStageConfig.pipelineId, SERVICE_PIPELINES.RENEWALS),
        eq(azPipelineStageConfig.canonicalName, canonicalName)
      )
    )
    .limit(1);

  if (config) {
    stageIdCache.set(cacheKey, config.stageId);
    return config.stageId;
  }

  return null;
}

/**
 * Resolve an AZ stage ID to a canonical stage name.
 */
export async function resolveRenewalStageName(
  tenantId: string,
  stageId: number
): Promise<string | null> {
  // Check canonical map (reverse lookup)
  for (const [canonical, id] of Object.entries(RENEWAL_CANONICAL_TO_STAGE)) {
    if (id === stageId) return canonical;
  }

  // Check cache
  const cacheKey = `${tenantId}:${stageId}`;
  if (stageNameCache.has(cacheKey)) {
    return stageNameCache.get(cacheKey)!;
  }

  // Fall back to DB
  const [config] = await db
    .select()
    .from(azPipelineStageConfig)
    .where(
      and(
        eq(azPipelineStageConfig.tenantId, tenantId),
        eq(azPipelineStageConfig.pipelineId, SERVICE_PIPELINES.RENEWALS),
        eq(azPipelineStageConfig.stageId, stageId)
      )
    )
    .limit(1);

  if (config) {
    stageNameCache.set(cacheKey, config.canonicalName);
    return config.canonicalName;
  }

  return null;
}

/**
 * Clear the in-memory caches. Useful after pipeline stage discovery.
 */
export function clearStageResolverCache(): void {
  stageIdCache.clear();
  stageNameCache.clear();
}
