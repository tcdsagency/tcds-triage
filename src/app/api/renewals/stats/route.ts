/**
 * GET /api/renewals/stats
 * Lightweight stats for sidebar badge.
 */

import { NextResponse } from 'next/server';
import { db } from '@/db';
import { renewalComparisons } from '@/db/schema';
import { eq, and, gte, sql } from 'drizzle-orm';

const TENANT_ID = process.env.TENANT_ID || '';

export async function GET() {
  try {
    const all = await db
      .select({
        status: renewalComparisons.status,
        recommendation: renewalComparisons.recommendation,
        premiumChangePercent: renewalComparisons.premiumChangePercent,
        agentDecisionAt: renewalComparisons.agentDecisionAt,
      })
      .from(renewalComparisons)
      .where(eq(renewalComparisons.tenantId, TENANT_ID));

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const stats = {
      pendingCount: all.filter((r) =>
        r.status === 'waiting_agent_review' || r.status === 'comparison_ready'
      ).length,
      totalActive: all.filter((r) =>
        r.status !== 'completed' && r.status !== 'cancelled'
      ).length,
      decidedToday: all.filter((r) =>
        r.agentDecisionAt && new Date(r.agentDecisionAt) >= today
      ).length,
      avgPremiumChange: (() => {
        const withChanges = all.filter((r) => r.premiumChangePercent != null);
        if (withChanges.length === 0) return null;
        const sum = withChanges.reduce((acc, r) => acc + parseFloat(r.premiumChangePercent!), 0);
        return Math.round((sum / withChanges.length) * 100) / 100;
      })(),
      reshopRate: (() => {
        const decided = all.filter((r) => r.recommendation != null);
        if (decided.length === 0) return 0;
        const reshopCount = decided.filter((r) => r.recommendation === 'reshop').length;
        return Math.round((reshopCount / decided.length) * 100);
      })(),
    };

    return NextResponse.json({ success: true, stats });
  } catch (error) {
    console.error('[API] Error fetching renewal stats:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch stats' },
      { status: 500 }
    );
  }
}
