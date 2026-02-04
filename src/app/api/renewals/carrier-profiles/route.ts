/**
 * GET/POST /api/renewals/carrier-profiles
 * Carrier profile CRUD.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { carrierProfiles } from '@/db/schema';
import { eq } from 'drizzle-orm';

const TENANT_ID = process.env.DEFAULT_TENANT_ID || '';

export async function GET() {
  try {
    const profiles = await db
      .select()
      .from(carrierProfiles)
      .where(eq(carrierProfiles.tenantId, TENANT_ID));

    return NextResponse.json({ success: true, profiles });
  } catch (error) {
    console.error('[API] Error fetching carrier profiles:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch carrier profiles' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const [profile] = await db
      .insert(carrierProfiles)
      .values({
        tenantId: TENANT_ID,
        carrierName: body.carrierName,
        carrierCode: body.carrierCode || null,
        al3CompanyCode: body.al3CompanyCode || null,
        renewalTransactionTypes: body.renewalTransactionTypes || ['RWL', 'RWQ'],
        al3ParsingRules: body.al3ParsingRules || null,
        comparisonThresholds: body.comparisonThresholds || null,
        premiumIncreaseThresholdPercent: body.premiumIncreaseThresholdPercent || '10',
        autoRenewThresholdPercent: body.autoRenewThresholdPercent || '5',
        isActive: body.isActive ?? true,
      })
      .returning();

    return NextResponse.json({ success: true, profile });
  } catch (error) {
    console.error('[API] Error creating carrier profile:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create carrier profile' },
      { status: 500 }
    );
  }
}
