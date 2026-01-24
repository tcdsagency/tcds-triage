// API Route: /api/pending-review/[id]/summary
// Endpoint to save edited AI summary for wrapup drafts

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { wrapupDrafts } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: itemId } = await params;
    const body = await request.json();
    const { summary } = body;

    if (!summary || typeof summary !== 'string' || summary.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Summary is required' },
        { status: 400 }
      );
    }

    // Check if the wrapup exists
    const [existing] = await db
      .select({ id: wrapupDrafts.id })
      .from(wrapupDrafts)
      .where(eq(wrapupDrafts.id, itemId))
      .limit(1);

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Wrapup not found' },
        { status: 404 }
      );
    }

    // Update the summary in the database
    // Update both the main summary field and aiCleanedSummary to ensure consistency
    await db
      .update(wrapupDrafts)
      .set({
        summary: summary.trim(),
        aiCleanedSummary: summary.trim(),
        summaryEdited: true,
        summaryEditedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(wrapupDrafts.id, itemId));

    console.log(`[Summary API] Updated summary for wrapup ${itemId}`);

    return NextResponse.json({
      success: true,
      message: 'Summary updated successfully',
    });
  } catch (error: unknown) {
    console.error('[Summary API] Failed to update summary:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to update summary' },
      { status: 500 }
    );
  }
}
