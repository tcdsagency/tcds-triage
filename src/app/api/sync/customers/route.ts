/**
 * Customer Directory Sync API
 * ============================
 * POST /api/sync/customers - Trigger customer directory sync
 * GET /api/sync/customers - Get sync status
 */

import { NextRequest, NextResponse } from 'next/server';
import { 
  syncCustomerDirectory,
  runIncrementalSync, 
  runFullSync,
  getLastSyncTimestamp,
  type SyncResult 
} from '@/lib/api/customer-sync';

// Hardcoded tenant ID for now - in production, get from auth context
const TENANT_ID = process.env.DEFAULT_TENANT_ID || 'demo-tenant';

/**
 * POST /api/sync/customers
 * Trigger a customer directory sync
 * 
 * Body:
 * - type: 'full' | 'incremental' (default: 'incremental')
 * - source: 'agencyzoom' | 'hawksoft' | 'all' (default: 'all')
 * - dryRun: boolean (default: false)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { type = 'incremental', source = 'all', dryRun = false } = body;

    console.log(`[API] Starting ${type} sync for ${source}, dryRun=${dryRun}`);

    let result: SyncResult;

    if (type === 'full') {
      result = await runFullSync(TENANT_ID);
    } else {
      result = await runIncrementalSync(TENANT_ID);
    }

    return NextResponse.json({
      success: true,
      data: {
        source: result.source,
        created: result.created,
        updated: result.updated,
        linked: result.linked,
        deleted: result.deleted,
        errors: result.errors,
        total: result.total,
        duration: result.duration,
        timestamp: result.timestamp.toISOString(),
      },
    });
  } catch (error) {
    console.error('[API] Sync error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Sync failed' 
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/sync/customers
 * Get sync status and last sync times
 */
export async function GET() {
  try {
    const [azLastSync, hsLastSync] = await Promise.all([
      getLastSyncTimestamp(TENANT_ID, 'agencyzoom'),
      getLastSyncTimestamp(TENANT_ID, 'hawksoft'),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        tenantId: TENANT_ID,
        lastSync: {
          agencyzoom: azLastSync,
          hawksoft: hsLastSync,
        },
        status: 'ready',
      },
    });
  } catch (error) {
    console.error('[API] Status error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to get status' 
      },
      { status: 500 }
    );
  }
}
