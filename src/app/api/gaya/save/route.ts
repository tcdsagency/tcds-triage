// API Route: /api/gaya/save
// Save edited entities as a Gaya clipboard record

import { NextRequest, NextResponse } from 'next/server';
import { getGayaClient } from '@/lib/api/gaya';
import type { GayaEntity } from '@/types/gaya';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const entities = body.entities as GayaEntity[];

    if (!entities?.length) {
      return NextResponse.json(
        { success: false, error: 'Entities are required' },
        { status: 400 }
      );
    }

    const client = getGayaClient();
    const record = await client.createClipboardRecord(entities);

    console.log(`[Gaya] Saved clipboard record with ${entities.length} entities`);

    return NextResponse.json({
      success: true,
      gayaRecordId: record.id,
    });
  } catch (error) {
    console.error('[Gaya] Save error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to save to Gaya',
      },
      { status: 500 }
    );
  }
}
