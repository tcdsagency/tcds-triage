// API Route: GET /api/customers/[id]/policies
// Returns all active/pending policies for a customer

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { policies } from '@/db/schema';
import { eq, and, inArray } from 'drizzle-orm';

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
        )
      );

    return NextResponse.json({ success: true, policies: results });
  } catch (error) {
    console.error('[Customer Policies] Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    );
  }
}
