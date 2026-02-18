import { NextResponse } from 'next/server';
import { ezlynxBot } from '@/lib/api/ezlynx-bot';

// GET /api/ezlynx/status — Check bot connection status
export async function GET() {
  try {
    const status = await ezlynxBot.getStatus();
    return NextResponse.json({ success: true, ...status });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, state: 'disconnected', error: err.message },
      { status: 200 } // Return 200 so the UI can display the error gracefully
    );
  }
}
