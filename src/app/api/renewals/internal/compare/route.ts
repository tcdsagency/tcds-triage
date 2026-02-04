/**
 * POST /api/renewals/internal/compare
 * Run comparison engine on renewal vs baseline snapshots (called by worker).
 *
 * Accepts: { renewalSnapshot, baselineSnapshot, thresholds? }
 * Returns: { success, result: ComparisonResult }
 */

import { NextRequest, NextResponse } from 'next/server';
import { compareSnapshots } from '@/lib/al3/comparison-engine';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.renewalSnapshot || !body.baselineSnapshot) {
      return NextResponse.json(
        { success: false, error: 'renewalSnapshot and baselineSnapshot are required' },
        { status: 400 }
      );
    }

    const result = compareSnapshots(body.renewalSnapshot, body.baselineSnapshot, body.thresholds);

    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error('[Internal API] Compare error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Comparison failed' },
      { status: 500 }
    );
  }
}
