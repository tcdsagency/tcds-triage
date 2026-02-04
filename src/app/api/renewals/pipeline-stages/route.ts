/**
 * GET /api/renewals/pipeline-stages
 * Returns current AZ pipeline stage configuration for renewals.
 */

import { NextResponse } from 'next/server';
import { db } from '@/db';
import { azPipelineStageConfig } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { SERVICE_PIPELINES } from '@/lib/api/agencyzoom-service-tickets';

const TENANT_ID = process.env.DEFAULT_TENANT_ID || '';

export async function GET() {
  try {
    const stages = await db
      .select()
      .from(azPipelineStageConfig)
      .where(
        and(
          eq(azPipelineStageConfig.tenantId, TENANT_ID),
          eq(azPipelineStageConfig.pipelineId, SERVICE_PIPELINES.RENEWALS)
        )
      )
      .orderBy(azPipelineStageConfig.sortOrder);

    return NextResponse.json({
      success: true,
      pipelineId: SERVICE_PIPELINES.RENEWALS,
      stages: stages.map((s) => ({
        id: s.id,
        stageId: s.stageId,
        stageName: s.stageName,
        canonicalName: s.canonicalName,
        sortOrder: s.sortOrder,
        isActive: s.isActive,
      })),
    });
  } catch (error) {
    console.error('[API] Error fetching pipeline stages:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch pipeline stages' },
      { status: 500 }
    );
  }
}
