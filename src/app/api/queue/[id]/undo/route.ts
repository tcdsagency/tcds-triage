// =============================================================================
// Queue Undo — POST /api/queue/[id]/undo
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { wrapupDrafts } from "@/db/schema";
import { eq, and, gte } from "drizzle-orm";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { undoToken } = body;

    if (!undoToken) {
      return NextResponse.json({ success: false, error: 'undoToken required' }, { status: 400 });
    }

    // Verify undo token and expiry
    const [wrapup] = await db
      .select({
        id: wrapupDrafts.id,
        undoToken: wrapupDrafts.undoToken,
        undoExpiresAt: wrapupDrafts.undoExpiresAt,
      })
      .from(wrapupDrafts)
      .where(and(
        eq(wrapupDrafts.id, id),
        eq(wrapupDrafts.undoToken, undoToken),
        gte(wrapupDrafts.undoExpiresAt, new Date()),
      ))
      .limit(1);

    if (!wrapup) {
      return NextResponse.json({
        success: false,
        error: 'Undo expired or invalid token',
      }, { status: 410 });
    }

    // Revert to pending_review
    await db.update(wrapupDrafts).set({
      status: 'pending_review',
      completionAction: null,
      outcome: null,
      isAutoVoided: false,
      autoVoidReason: null,
      deleteReason: null,
      deleteNotes: null,
      deletedById: null,
      deletedAt: null,
      undoToken: null,
      undoExpiresAt: null,
      completedAt: null,
      reviewedAt: null,
      reviewerDecision: null,
      updatedAt: new Date(),
    }).where(eq(wrapupDrafts.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[queue/undo] Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
