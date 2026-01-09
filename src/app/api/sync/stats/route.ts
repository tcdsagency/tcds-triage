import { NextResponse } from 'next/server';
import { db } from '@/db';
import { syncLogs, policies } from '@/db/schema';
import { eq, desc, and, count, max } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

/**
 * GET /api/sync/stats
 * Returns sync statistics for the Data Sync settings page
 */
export async function GET() {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant not configured' }, { status: 500 });
    }

    // Get last HawkSoft sync from sync_logs
    const lastHawksoftSync = await db.query.syncLogs.findFirst({
      where: and(
        eq(syncLogs.tenantId, tenantId),
        eq(syncLogs.integration, 'hawksoft')
      ),
      orderBy: [desc(syncLogs.createdAt)],
    });

    // Get last AgencyZoom sync from sync_logs
    const lastAgencyzoomSync = await db.query.syncLogs.findFirst({
      where: and(
        eq(syncLogs.tenantId, tenantId),
        eq(syncLogs.integration, 'agencyzoom')
      ),
      orderBy: [desc(syncLogs.createdAt)],
    });

    // Get total policy count
    const policyCountResult = await db
      .select({ count: count() })
      .from(policies)
      .where(eq(policies.tenantId, tenantId));

    const totalPolicies = policyCountResult[0]?.count || 0;

    // Get last policy sync timestamp
    const lastPolicySync = await db
      .select({ lastSync: max(policies.lastSyncedAt) })
      .from(policies)
      .where(eq(policies.tenantId, tenantId));

    return NextResponse.json({
      success: true,
      stats: {
        hawksoft: {
          lastSync: lastHawksoftSync?.createdAt?.toISOString() || lastPolicySync[0]?.lastSync?.toISOString() || null,
          policiesSynced: totalPolicies,
          status: lastHawksoftSync?.status || 'unknown',
        },
        agencyzoom: {
          lastSync: lastAgencyzoomSync?.createdAt?.toISOString() || null,
          customersSynced: (lastAgencyzoomSync?.responseData as any)?.total || 0,
          status: lastAgencyzoomSync?.status || 'unknown',
        },
      },
    });
  } catch (error) {
    console.error('Error fetching sync stats:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch sync stats' },
      { status: 500 }
    );
  }
}
