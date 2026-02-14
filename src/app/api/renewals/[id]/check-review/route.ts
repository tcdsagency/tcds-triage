/**
 * PATCH /api/renewals/[id]/check-review
 * Toggle reviewed flag on individual CheckResult by ruleId.
 *
 * Body: { ruleId: string, reviewed: boolean, reviewedBy?: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { renewalComparisons } from '@/db/schema';
import { eq } from 'drizzle-orm';
import type { CheckResult } from '@/types/check-rules.types';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    if (!body.ruleId || typeof body.reviewed !== 'boolean') {
      return NextResponse.json(
        { success: false, error: 'ruleId and reviewed (boolean) are required' },
        { status: 400 }
      );
    }

    // Fetch current check results
    const [renewal] = await db
      .select({ checkResults: renewalComparisons.checkResults })
      .from(renewalComparisons)
      .where(eq(renewalComparisons.id, id))
      .limit(1);

    if (!renewal) {
      return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
    }

    const checkResults = (renewal.checkResults as CheckResult[] | null) || [];
    let updated = false;

    // Find and update the matching rule result(s)
    for (const result of checkResults) {
      if (result.ruleId === body.ruleId ||
          (body.field && result.ruleId === body.ruleId && result.field === body.field)) {
        result.reviewed = body.reviewed;
        result.reviewedBy = body.reviewed ? (body.reviewedBy || null) : null;
        result.reviewedAt = body.reviewed ? new Date().toISOString() : null;
        updated = true;
      }
    }

    if (!updated) {
      return NextResponse.json(
        { success: false, error: `Rule ${body.ruleId} not found in check results` },
        { status: 404 }
      );
    }

    // Recalculate review progress
    const reviewable = checkResults.filter(r => r.severity !== 'unchanged');
    const reviewedCount = reviewable.filter(r => r.reviewed).length;
    const reviewProgress = reviewable.length > 0
      ? Math.round((reviewedCount / reviewable.length) * 100)
      : 100;

    // Update check summary
    const currentSummary = (renewal as any).checkSummary || {};
    const updatedSummary = { ...currentSummary, reviewProgress };

    // Persist
    await db
      .update(renewalComparisons)
      .set({
        checkResults: checkResults as any,
        checkSummary: updatedSummary,
        updatedAt: new Date(),
      })
      .where(eq(renewalComparisons.id, id));

    return NextResponse.json({
      success: true,
      reviewProgress,
      updatedRuleId: body.ruleId,
    });
  } catch (error) {
    console.error('[API] Error updating check review:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update check review' },
      { status: 500 }
    );
  }
}
