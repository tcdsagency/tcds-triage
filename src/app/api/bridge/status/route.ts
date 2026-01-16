import { NextResponse } from 'next/server';

const BRIDGE_URL = process.env.VM_BRIDGE_URL || 'http://34.145.14.37:3000';

export async function GET() {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(`${BRIDGE_URL}/health`, {
      signal: controller.signal,
      cache: 'no-store',
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return NextResponse.json({
        success: false,
        status: 'error',
        message: `Bridge returned ${response.status}`,
        data: null,
      }, { status: 503 });
    }

    const health = await response.json();

    return NextResponse.json({
      success: true,
      status: health.status || 'ok',
      data: {
        threecx: health.threecx || { connected: false },
        registrations: health.registrations || 0,
        sessions: health.sessions || { total: 0, active: 0, streaming: 0 },
        autoTranscription: health.autoTranscription || { enabled: false, extensions: [] },
        timestamp: health.timestamp || new Date().toISOString(),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const isTimeout = message.includes('abort');

    return NextResponse.json({
      success: false,
      status: 'offline',
      message: isTimeout ? 'Bridge connection timed out' : `Failed to connect: ${message}`,
      data: null,
    }, { status: 503 });
  }
}
