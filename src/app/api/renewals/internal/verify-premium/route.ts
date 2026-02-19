/**
 * POST /api/renewals/internal/verify-premium
 * Cross-check AL3-parsed renewal premium against HawkSoft Cloud API rate change history.
 * Called by renewal worker after comparison is created.
 *
 * Accepts: { policyNumber, effectiveDate, al3Premium, customerId, hawksoftClientCode, customerLastName }
 * Returns: { success, verification: PremiumVerification | null }
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyRenewalPremium } from '@/lib/al3/premium-verification';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const { policyNumber, effectiveDate, customerId } = body;

    if (!policyNumber || !effectiveDate || !customerId) {
      return NextResponse.json(
        { success: false, error: 'policyNumber, effectiveDate, and customerId are required' },
        { status: 400 }
      );
    }

    const verification = await verifyRenewalPremium({
      policyNumber,
      effectiveDate,
      al3Premium: body.al3Premium,
      customerId,
      hawksoftClientCode: body.hawksoftClientCode || null,
      customerLastName: body.customerLastName || '',
    });

    return NextResponse.json({ success: true, verification });
  } catch (error) {
    console.error('[Internal API] verify-premium error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed' },
      { status: 500 }
    );
  }
}
