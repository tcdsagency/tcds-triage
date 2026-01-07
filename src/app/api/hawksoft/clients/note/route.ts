import { NextRequest, NextResponse } from 'next/server';
import { getHawkSoftClient, LogAction } from '@/lib/api/hawksoft';

/**
 * POST /api/hawksoft/clients/note
 * Add a note to a HawkSoft client
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { clientId, note, channel } = body;

    if (!clientId || !note) {
      return NextResponse.json(
        { error: 'Missing required fields: clientId, note' },
        { status: 400 }
      );
    }

    const hsClient = getHawkSoftClient();
    
    await hsClient.logNote({
      clientId: parseInt(clientId),
      note,
      channel: channel || LogAction.PhoneFromInsured, // Default to inbound phone call
    });

    return NextResponse.json({ success: true, message: 'Note added successfully' });
  } catch (error) {
    console.error('HawkSoft note error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
