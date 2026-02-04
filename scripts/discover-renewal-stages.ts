/**
 * Discover Renewal Pipeline Stages
 * =================================
 * One-time script to discover AZ pipeline stages for the Renewals pipeline.
 * Inserts discovered stages into azPipelineStageConfig table.
 *
 * Usage: npx tsx scripts/discover-renewal-stages.ts
 */

import { config as dotenvConfig } from 'dotenv';
dotenvConfig({ path: '.env.local' });
import { db } from '../src/db';
import { azPipelineStageConfig, tenants } from '../src/db/schema';
import { eq } from 'drizzle-orm';

// Known canonical name mappings based on expected stage names
const CANONICAL_NAME_MAP: Record<string, string> = {
  // Exact matches first (checked before partial matches)
  'pol pend. review': 'policy_pending_review',
  'policy pending review': 'policy_pending_review',
  'pending review': 'policy_pending_review',
  'waiting for agt review': 'waiting_agent_review',
  'waiting agent review': 'waiting_agent_review',
  'agent review': 'waiting_agent_review',
  'contact customer': 'contact_customer',
  'contact insured': 'contact_customer',
  'unable to contact': 'unable_to_contact',
  'no contact': 'unable_to_contact',
  'requote requested': 'requote_requested',
  'requote': 'requote_requested',
  'reshop': 'requote_requested',
  'quote ready in ezlynx': 'quote_ready_ezl',
  'quote ready': 'quote_ready_ezl',
  'quote ready ezl': 'quote_ready_ezl',
  'quote ready - ezl': 'quote_ready_ezl',
  'waiting for customer': 'waiting_customer',
  'waiting customer': 'waiting_customer',
  'waiting on customer': 'waiting_customer',
  'awaiting customer': 'waiting_customer',
  'completed': 'completed',
  'complete': 'completed',
  'done': 'completed',
};

function guessCanonicalName(stageName: string): string {
  const normalized = stageName.toLowerCase().trim();

  // Direct match
  if (CANONICAL_NAME_MAP[normalized]) {
    return CANONICAL_NAME_MAP[normalized];
  }

  // Partial match
  for (const [pattern, canonical] of Object.entries(CANONICAL_NAME_MAP)) {
    if (normalized.includes(pattern)) {
      return canonical;
    }
  }

  // Snake-case the original name as fallback
  return normalized.replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

async function main() {
  console.log('=== Discover Renewal Pipeline Stages ===\n');

  // Dynamic import for AgencyZoom client
  const { getAgencyZoomClient } = await import('../src/lib/api/agencyzoom');
  const { SERVICE_PIPELINES } = await import('../src/lib/api/agencyzoom-service-tickets');

  const RENEWALS_PIPELINE_ID = SERVICE_PIPELINES.RENEWALS;
  console.log(`Target pipeline: RENEWALS (${RENEWALS_PIPELINE_ID})\n`);

  // Get the AZ client
  const azClient = await getAgencyZoomClient();
  if (!azClient) {
    console.error('ERROR: AgencyZoom client not configured');
    process.exit(1);
  }

  // Get tenant ID (assuming single-tenant for now)
  const [tenant] = await db.select({ id: tenants.id }).from(tenants).limit(1);
  if (!tenant) {
    console.error('ERROR: No tenant found');
    process.exit(1);
  }

  console.log(`Tenant: ${tenant.id}\n`);

  // Fetch service pipelines from AZ using /v1/api/pipelines-and-stages
  console.log('Fetching pipelines from AgencyZoom...');
  let pipelines: any;
  try {
    // Try service type first, then all pipelines as fallback
    pipelines = await azClient.getPipelinesAndStages('service');
    console.log(`Fetched ${pipelines?.length ?? 0} service pipelines`);
    if (!pipelines?.length) {
      console.log('No service pipelines returned, trying without type filter...');
      pipelines = await azClient.getPipelinesAndStages();
      console.log(`Fetched ${pipelines?.length ?? 0} total pipelines`);
    }
  } catch (error) {
    console.error('ERROR fetching pipelines:', error);
    process.exit(1);
  }

  // Find the renewals pipeline
  const renewalPipeline = pipelines?.find?.((p: any) => p.id === RENEWALS_PIPELINE_ID);
  if (!renewalPipeline) {
    console.error(`ERROR: Pipeline ${RENEWALS_PIPELINE_ID} not found in AZ response`);
    console.log('Available pipelines:', JSON.stringify(pipelines, null, 2));
    process.exit(1);
  }

  console.log(`Found pipeline: "${renewalPipeline.name}" (ID: ${renewalPipeline.id})`);
  console.log(`Stages found: ${renewalPipeline.stages?.length ?? 0}\n`);

  if (!renewalPipeline.stages?.length) {
    console.error('ERROR: No stages found in pipeline');
    process.exit(1);
  }

  // Insert stages
  console.log('Inserting stages into azPipelineStageConfig:\n');
  let inserted = 0;

  for (let i = 0; i < renewalPipeline.stages.length; i++) {
    const stage = renewalPipeline.stages[i];
    const canonicalName = guessCanonicalName(stage.name || stage.stageName || `stage_${i}`);

    console.log(`  Stage ${i + 1}: "${stage.name || stage.stageName}" (ID: ${stage.id}) -> canonical: "${canonicalName}"`);

    try {
      await db
        .insert(azPipelineStageConfig)
        .values({
          tenantId: tenant.id,
          pipelineId: RENEWALS_PIPELINE_ID,
          stageId: stage.id,
          stageName: stage.name || stage.stageName || `Stage ${i + 1}`,
          canonicalName,
          sortOrder: i,
          isActive: true,
        })
        .onConflictDoUpdate({
          target: [azPipelineStageConfig.tenantId, azPipelineStageConfig.pipelineId, azPipelineStageConfig.stageId],
          set: {
            stageName: stage.name || stage.stageName || `Stage ${i + 1}`,
            canonicalName,
            sortOrder: i,
            updatedAt: new Date(),
          },
        });
      inserted++;
    } catch (error) {
      console.error(`    ERROR inserting stage: ${error}`);
    }
  }

  console.log(`\nDone! Inserted/updated ${inserted} stages.`);

  // Print the stage constants that should be updated in agencyzoom-service-tickets.ts
  console.log('\n=== Update PIPELINE_STAGES in agencyzoom-service-tickets.ts ===\n');
  for (const stage of renewalPipeline.stages) {
    const canonical = guessCanonicalName(stage.name || stage.stageName || '');
    const constName = `RENEWALS_${canonical.toUpperCase()}`;
    console.log(`  ${constName}: ${stage.id},`);
  }

  console.log('\n=== Update RENEWAL_CANONICAL_TO_STAGE ===\n');
  for (const stage of renewalPipeline.stages) {
    const canonical = guessCanonicalName(stage.name || stage.stageName || '');
    const constName = `RENEWALS_${canonical.toUpperCase()}`;
    console.log(`  ${canonical}: PIPELINE_STAGES.${constName},`);
  }

  process.exit(0);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
