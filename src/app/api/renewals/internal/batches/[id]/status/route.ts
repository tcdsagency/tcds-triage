/**
 * GET /api/renewals/internal/batches/[id]/status
 * Returns candidate completion counts for a batch (called by worker).
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { renewalCandidates } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const [counts] = await db
      .select({
        totalCandidates: sql<number>`count(*)::int`,
        completedCandidates: sql<number>`count(*) filter (where ${renewalCandidates.status} = 'completed')::int`,
        failedCandidates: sql<number>`count(*) filter (where ${renewalCandidates.status} = 'failed')::int`,
      })
      .from(renewalCandidates)
      .where(eq(renewalCandidates.batchId, id));

    return NextResponse.json({
      success: true,
      totalCandidates: counts?.totalCandidates ?? 0,
      completedCandidates: counts?.completedCandidates ?? 0,
      failedCandidates: counts?.failedCandidates ?? 0,
    });
  } catch (error) {
    console.error('[Internal API] Error checking batch status:', error);
    return NextResponse.json({ success: false, error: 'Failed to check batch status' }, { status: 500 });
  }
}
