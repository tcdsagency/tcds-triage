// API Route: GET /api/customers/[id]/policies
// Returns all active/pending policies for a customer, with linked renewal comparison IDs

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { policies, renewalComparisons } from '@/db/schema';
import { eq, and, inArray, desc, sql } from 'drizzle-orm';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const tenantId = process.env.DEFAULT_TENANT_ID;

    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant not configured' }, { status: 500 });
    }

    // Only return policies that are active/pending AND not expired
    // (expirationDate is null or >= 30 days ago to catch recently-expired)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const results = await db
      .select({
        id: policies.id,
        policyNumber: policies.policyNumber,
        lineOfBusiness: policies.lineOfBusiness,
        carrier: policies.carrier,
        premium: policies.premium,
        effectiveDate: policies.effectiveDate,
        expirationDate: policies.expirationDate,
        status: policies.status,
      })
      .from(policies)
      .where(
        and(
          eq(policies.tenantId, tenantId),
          eq(policies.customerId, id),
          inArray(policies.status, ['active', 'pending']),
          sql`(${policies.expirationDate} IS NULL OR ${policies.expirationDate} >= ${thirtyDaysAgo.toISOString()})`,
        )
      );

    // For each policy, find the latest renewal comparison (if any)
    const policyIds = results.map(p => p.id);
    let renewalMap: Record<string, string> = {};

    if (policyIds.length > 0) {
      const renewals = await db
        .select({
          policyId: renewalComparisons.policyId,
          comparisonId: renewalComparisons.id,
          createdAt: renewalComparisons.createdAt,
        })
        .from(renewalComparisons)
        .where(
          and(
            sql`${renewalComparisons.policyId} IN (${sql.join(policyIds.map(id => sql`${id}`), sql`, `)})`,
          )
        )
        .orderBy(desc(renewalComparisons.createdAt));

      // Keep only the latest comparison per policy
      for (const r of renewals) {
        if (r.policyId && !renewalMap[r.policyId]) {
          renewalMap[r.policyId] = r.comparisonId;
        }
      }
    }

    const enriched = results.map(p => ({
      ...p,
      renewalComparisonId: renewalMap[p.id] || null,
    }));

    return NextResponse.json({ success: true, policies: enriched });
  } catch (error) {
    console.error('[Customer Policies] Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    );
  }
}
