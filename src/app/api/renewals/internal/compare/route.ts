/**
 * POST /api/renewals/internal/compare
 * Run comparison engine on renewal vs baseline snapshots (called by worker).
 *
 * Accepts: { renewalSnapshot, baselineSnapshot, thresholds?, lineOfBusiness?, carrierName? }
 * Returns: { success, result: ComparisonResult, checkEngineResult?: CheckEngineResult }
 */

import { NextRequest, NextResponse } from 'next/server';
import { compareSnapshots } from '@/lib/al3/comparison-engine';
import { runCheckEngine, buildCheckSummary } from '@/lib/al3/check-rules/check-engine';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.renewalSnapshot || !body.baselineSnapshot) {
      return NextResponse.json(
        { success: false, error: 'renewalSnapshot and baselineSnapshot are required' },
        { status: 400 }
      );
    }

    const result = compareSnapshots(
      body.renewalSnapshot,
      body.baselineSnapshot,
      body.thresholds,
      body.renewalEffectiveDate,
      body.lineOfBusiness || undefined
    );

    // Run check engine as post-processing layer
    let checkEngineResult = null;
    let checkSummary = null;
    try {
      checkEngineResult = runCheckEngine(
        body.renewalSnapshot,
        body.baselineSnapshot,
        result,
        body.lineOfBusiness || '',
        body.carrierName || ''
      );
      checkSummary = buildCheckSummary(checkEngineResult);
    } catch (checkErr) {
      console.error('[Internal API] Check engine error (non-blocking):', checkErr);
    }

    return NextResponse.json({ success: true, result, checkEngineResult, checkSummary });
  } catch (error) {
    console.error('[Internal API] Compare error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Comparison failed' },
      { status: 500 }
    );
  }
}
