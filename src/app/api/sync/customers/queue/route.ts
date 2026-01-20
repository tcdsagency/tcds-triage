/**
 * Queue Customer Sync API
 * ========================
 * POST /api/sync/customers/queue - Queue a customer sync job to Railway worker
 */

import { NextRequest, NextResponse } from 'next/server';
import { queueCustomerSync } from '@/lib/queues/client';

const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY;

export async function POST(request: NextRequest) {
  // Optional auth check
  const authHeader = request.headers.get('authorization');
  const providedKey = authHeader?.replace('Bearer ', '');

  if (INTERNAL_API_KEY && providedKey !== INTERNAL_API_KEY) {
    // Allow without auth for testing, but log warning
    console.warn('[CustomerSync Queue] Request without auth key');
  }

  try {
    const body = await request.json().catch(() => ({}));
    const { type = 'full', provider = 'agencyzoom' } = body;

    const job = await queueCustomerSync({
      type: type as 'single' | 'batch' | 'full',
      source: 'manual',
      provider: provider as 'agencyzoom' | 'hawksoft' | 'both',
    });

    return NextResponse.json({
      success: true,
      jobId: job.id,
      message: `Customer sync job queued: ${type} (${provider})`,
    });
  } catch (error) {
    console.error('[CustomerSync Queue] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to queue job',
      },
      { status: 500 }
    );
  }
}
