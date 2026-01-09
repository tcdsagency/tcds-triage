import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { syncFromDonna } from '@/lib/api/donna-sync';

export const maxDuration = 300; // 5 minutes
export const dynamic = 'force-dynamic';

/**
 * POST /api/sync/donna
 * Triggers a sync of customer data from Donna AI
 *
 * Query params:
 * - fullSync: true/false - Force sync all records (ignore stale threshold)
 * - limit: number - Max records to sync (for testing)
 *
 * Body:
 * - batchSize: number - Records per batch (default: 25)
 * - staleThresholdHours: number - Re-sync records older than N hours (default: 24)
 */
export async function POST(request: NextRequest) {
  try {
    // Get current user and their tenant
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's tenant
    const dbUser = await db.query.users.findFirst({
      where: eq(users.authId, user.id),
    });

    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Parse query params
    const url = new URL(request.url);
    const fullSync = url.searchParams.get('fullSync') === 'true';
    const limit =
      parseInt(url.searchParams.get('limit') || '0') || undefined;

    // Parse request body for options
    const body = await request.json().catch(() => ({}));
    const batchSize = body.batchSize || 25;
    const staleThresholdHours = body.staleThresholdHours || 24;

    // Run sync
    console.log(`[DonnaSync] Starting sync for tenant ${dbUser.tenantId}`);
    const result = await syncFromDonna({
      tenantId: dbUser.tenantId,
      fullSync,
      maxRecords: limit,
      batchSize,
      staleThresholdHours,
    });

    console.log(`[DonnaSync] Complete:`, result);

    return NextResponse.json({
      success: true,
      ...result,
      duration: `${(result.duration / 1000).toFixed(1)}s`,
    });
  } catch (error) {
    console.error('[DonnaSync] Route error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Sync failed',
      },
      { status: 500 }
    );
  }
}
