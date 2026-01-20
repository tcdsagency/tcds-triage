/**
 * Queue Status API
 * =================
 * GET /api/queues/status - Get status of all BullMQ queues
 */

import { NextResponse } from 'next/server';
import { getQueueStats } from '@/lib/queues/client';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const stats = await getQueueStats();

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      queues: stats,
      summary: {
        totalWaiting: stats.reduce((sum, q) => sum + q.waiting, 0),
        totalActive: stats.reduce((sum, q) => sum + q.active, 0),
        totalCompleted: stats.reduce((sum, q) => sum + q.completed, 0),
        totalFailed: stats.reduce((sum, q) => sum + q.failed, 0),
        totalDelayed: stats.reduce((sum, q) => sum + q.delayed, 0),
      },
    });
  } catch (error) {
    console.error('[Queue Status] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get queue stats',
      },
      { status: 500 }
    );
  }
}
