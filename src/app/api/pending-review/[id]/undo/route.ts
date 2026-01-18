// API Route: /api/pending-review/[id]/undo
// Undo a recently completed action

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { wrapupDrafts, messages } from "@/db/schema";
import { eq, and, gt } from "drizzle-orm";

// =============================================================================
// TYPES
// =============================================================================

interface UndoRequest {
  undoToken: string;
  itemType?: 'wrapup' | 'message';
}

// =============================================================================
// POST - Undo a completed action
// =============================================================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: itemId } = await params;
    const body: UndoRequest = await request.json();
    const { undoToken, itemType = 'wrapup' } = body;

    if (!undoToken) {
      return NextResponse.json({ error: "Undo token required" }, { status: 400 });
    }

    const now = new Date();

    // =======================================================================
    // HANDLE WRAPUP UNDO
    // =======================================================================
    if (itemType === 'wrapup') {
      // Find the wrapup with valid undo token
      const [wrapup] = await db
        .select()
        .from(wrapupDrafts)
        .where(
          and(
            eq(wrapupDrafts.id, itemId),
            eq(wrapupDrafts.undoToken, undoToken),
            gt(wrapupDrafts.undoExpiresAt, now)
          )
        )
        .limit(1);

      if (!wrapup) {
        return NextResponse.json(
          { error: "Undo expired or invalid token" },
          { status: 400 }
        );
      }

      // Reset the wrapup to pending_review status
      await db
        .update(wrapupDrafts)
        .set({
          status: "pending_review",
          reviewerDecision: null,
          outcome: null,
          completionAction: null,
          completedAt: null,
          reviewerId: null,
          reviewedAt: null,
          // Clear deletion fields
          deleteReason: null,
          deleteNotes: null,
          deletedById: null,
          deletedAt: null,
          // Clear undo fields
          undoToken: null,
          undoExpiresAt: null,
          // Keep the edited summary if it was set
          updatedAt: new Date(),
        })
        .where(eq(wrapupDrafts.id, itemId));

      return NextResponse.json({
        success: true,
        message: "Action undone successfully",
      });
    }

    // =======================================================================
    // HANDLE MESSAGE UNDO
    // =======================================================================
    if (itemType === 'message') {
      // For messages, we simply set isAcknowledged back to false
      // Messages don't have undo tokens, but we can still support basic undo
      const [message] = await db
        .select()
        .from(messages)
        .where(eq(messages.id, itemId))
        .limit(1);

      if (!message) {
        return NextResponse.json({ error: "Message not found" }, { status: 404 });
      }

      await db
        .update(messages)
        .set({ isAcknowledged: false })
        .where(eq(messages.id, itemId));

      return NextResponse.json({
        success: true,
        message: "Message acknowledgement undone",
      });
    }

    return NextResponse.json({ error: "Invalid item type" }, { status: 400 });
  } catch (error) {
    console.error("[Pending Review Undo] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Undo failed" },
      { status: 500 }
    );
  }
}
