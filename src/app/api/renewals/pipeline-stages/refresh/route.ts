/**
 * POST /api/renewals/pipeline-stages/refresh
 * Re-fetches pipeline stages from AgencyZoom and updates local config.
 */

import { NextResponse } from 'next/server';
import { db } from '@/db';
import { azPipelineStageConfig } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { getAgencyZoomClient } from '@/lib/api/agencyzoom';
import { SERVICE_PIPELINES } from '@/lib/api/agencyzoom-service-tickets';
import { clearStageResolverCache } from '@/lib/api/renewal-stage-resolver';

const TENANT_ID = process.env.TENANT_ID || '';

export async function POST() {
  try {
    const azClient = await getAgencyZoomClient();
    if (!azClient) {
      return NextResponse.json(
        { success: false, error: 'AgencyZoom client not configured' },
        { status: 503 }
      );
    }

    // Fetch pipelines
    const pipelines = await azClient.getServiceTicketPipelines();
    const renewalPipeline = pipelines?.find?.((p: any) => p.id === SERVICE_PIPELINES.RENEWALS);

    if (!renewalPipeline?.stages?.length) {
      return NextResponse.json(
        { success: false, error: 'Renewals pipeline not found or has no stages' },
        { status: 404 }
      );
    }

    // Get existing configs for canonical name preservation
    const existing = await db
      .select()
      .from(azPipelineStageConfig)
      .where(
        and(
          eq(azPipelineStageConfig.tenantId, TENANT_ID),
          eq(azPipelineStageConfig.pipelineId, SERVICE_PIPELINES.RENEWALS)
        )
      );

    const existingByStageId = new Map(existing.map((s) => [s.stageId, s]));

    // Upsert stages
    let updated = 0;
    for (let i = 0; i < renewalPipeline.stages.length; i++) {
      const stage = renewalPipeline.stages[i];
      const existingConfig = existingByStageId.get(stage.id);
      const stageName = stage.name || stage.stageName || `Stage ${i + 1}`;

      await db
        .insert(azPipelineStageConfig)
        .values({
          tenantId: TENANT_ID,
          pipelineId: SERVICE_PIPELINES.RENEWALS,
          stageId: stage.id,
          stageName,
          canonicalName: existingConfig?.canonicalName ?? stageName.toLowerCase().replace(/[^a-z0-9]+/g, '_'),
          sortOrder: i,
          isActive: true,
        })
        .onConflictDoUpdate({
          target: [azPipelineStageConfig.tenantId, azPipelineStageConfig.pipelineId, azPipelineStageConfig.stageId],
          set: {
            stageName,
            sortOrder: i,
            updatedAt: new Date(),
          },
        });
      updated++;
    }

    // Clear resolver cache
    clearStageResolverCache();

    return NextResponse.json({
      success: true,
      stagesUpdated: updated,
      pipelineId: SERVICE_PIPELINES.RENEWALS,
      pipelineName: renewalPipeline.name,
    });
  } catch (error) {
    console.error('[API] Error refreshing pipeline stages:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to refresh pipeline stages' },
      { status: 500 }
    );
  }
}
