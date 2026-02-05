// API Route: /api/gaya/send
// Send customer profile data to Gaya as a clipboard record

import { NextRequest, NextResponse } from 'next/server';
import { getGayaClient } from '@/lib/api/gaya';
import { transformProfileToGayaEntities } from '@/lib/transformers/profile-to-gaya';
import type { MergedProfile } from '@/types/customer-profile';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const profile = body.profile as MergedProfile;

    if (!profile) {
      return NextResponse.json(
        { success: false, error: 'Profile data is required' },
        { status: 400 }
      );
    }

    // Transform profile to Gaya entities
    const result = transformProfileToGayaEntities(profile);

    if (result.error) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    if (result.entities.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No data to send to Gaya' },
        { status: 400 }
      );
    }

    // Send to Gaya
    const client = getGayaClient();
    const record = await client.createClipboardRecord(result.entities);

    console.log(`[Gaya] Sent ${result.entityCount} entities for ${profile.name} (${profile.id})`);

    return NextResponse.json({
      success: true,
      entityCount: result.entityCount,
      gayaRecordId: record.id,
    });
  } catch (error) {
    console.error('[Gaya] Send error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send to Gaya',
      },
      { status: 500 }
    );
  }
}
