/**
 * POST /api/renewals/internal/baseline
 * Fetch baseline snapshot for a policy (called by worker).
 */

import { NextRequest, NextResponse } from 'next/server';
import { buildBaselineSnapshot } from '@/lib/al3/baseline-builder';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tenantId, policyNumber, carrierName, renewalEffectiveDate } = body;

    if (!tenantId || !policyNumber) {
      return NextResponse.json(
        { success: false, error: 'tenantId and policyNumber are required' },
        { status: 400 }
      );
    }

    const result = await buildBaselineSnapshot(tenantId, policyNumber, carrierName, renewalEffectiveDate);

    if (!result) {
      return NextResponse.json({
        success: false,
        error: 'Policy not found',
      });
    }

    return NextResponse.json({
      success: true,
      snapshot: result.snapshot,
      policyId: result.policyId,
      customerId: result.customerId,
    });
  } catch (error) {
    console.error('[Internal API] Error fetching baseline:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch baseline' },
      { status: 500 }
    );
  }
}
