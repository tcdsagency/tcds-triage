/**
 * GET /api/renewals/carriers
 * Returns distinct carrier names for the filter dropdown.
 */

import { NextResponse } from 'next/server';
import { db } from '@/db';
import { renewalComparisons } from '@/db/schema';
import { eq } from 'drizzle-orm';

const TENANT_ID = process.env.DEFAULT_TENANT_ID || '';

export async function GET() {
  try {
    const results = await db
      .selectDistinct({ carrierName: renewalComparisons.carrierName })
      .from(renewalComparisons)
      .where(eq(renewalComparisons.tenantId, TENANT_ID))
      .orderBy(renewalComparisons.carrierName);

    const carriers = results
      .map((r) => r.carrierName)
      .filter((name): name is string => !!name);

    return NextResponse.json({ success: true, carriers });
  } catch (error) {
    console.error('[API] Error fetching carriers:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch carriers' }, { status: 500 });
  }
}
