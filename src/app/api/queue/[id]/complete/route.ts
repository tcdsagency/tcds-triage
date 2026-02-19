// =============================================================================
// Queue Complete Action — POST /api/queue/[id]/complete
// =============================================================================
// Consolidates pending-review + triage actions into a single endpoint.
// Actions: note | ticket | lead | skip | delete
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { wrapupDrafts, calls, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getAgencyZoomClient } from "@/lib/api/agencyzoom";
import { nanoid } from "nanoid";

const TENANT_ID = process.env.DEFAULT_TENANT_ID!;
const UNDO_WINDOW_MS = 10_000; // 10 second undo window

interface CompleteRequest {
  action: 'note' | 'ticket' | 'lead' | 'skip' | 'delete';
  customerId?: string;
  editedSummary?: string;
  reviewerId?: string;
  // Ticket-specific
  ticketType?: string;
  ticketAssignedToId?: string;
  // Lead-specific
  leadType?: string;
  leadAssignedToId?: string;
  // Delete-specific
  deleteReason?: string;
  deleteNotes?: string;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = (await req.json()) as CompleteRequest;

    // Get wrapup
    const [wrapup] = await db
      .select()
      .from(wrapupDrafts)
      .where(eq(wrapupDrafts.id, id))
      .limit(1);

    if (!wrapup) {
      return NextResponse.json({ success: false, error: 'Item not found' }, { status: 404 });
    }

    const undoToken = nanoid(16);
    const now = new Date();

    switch (body.action) {
      case 'note': {
        // Post note to AgencyZoom customer
        // Actual note posting delegated to existing wrapup completion flow
        await db.update(wrapupDrafts).set({
          status: 'completed',
          completionAction: 'posted',
          outcome: 'note_posted',
          editedSummary: body.editedSummary || undefined,
          summaryEdited: !!body.editedSummary,
          summaryEditedAt: body.editedSummary ? now : undefined,
          reviewerId: body.reviewerId || undefined,
          reviewedAt: now,
          undoToken,
          undoExpiresAt: new Date(now.getTime() + UNDO_WINDOW_MS),
          completedAt: now,
          updatedAt: now,
        }).where(eq(wrapupDrafts.id, id));
        break;
      }

      case 'ticket': {
        await db.update(wrapupDrafts).set({
          status: 'completed',
          completionAction: 'ticket',
          outcome: 'ticket_created',
          ticketType: body.ticketType || undefined,
          ticketAssignedToId: body.ticketAssignedToId || undefined,
          editedSummary: body.editedSummary || undefined,
          summaryEdited: !!body.editedSummary,
          reviewerId: body.reviewerId || undefined,
          reviewedAt: now,
          undoToken,
          undoExpiresAt: new Date(now.getTime() + UNDO_WINDOW_MS),
          completedAt: now,
          updatedAt: now,
        }).where(eq(wrapupDrafts.id, id));
        break;
      }

      case 'lead': {
        await db.update(wrapupDrafts).set({
          status: 'completed',
          completionAction: 'lead',
          outcome: 'lead_created',
          leadType: body.leadType || undefined,
          leadAssignedToId: body.leadAssignedToId || undefined,
          editedSummary: body.editedSummary || undefined,
          summaryEdited: !!body.editedSummary,
          reviewerId: body.reviewerId || undefined,
          reviewedAt: now,
          undoToken,
          undoExpiresAt: new Date(now.getTime() + UNDO_WINDOW_MS),
          completedAt: now,
          updatedAt: now,
        }).where(eq(wrapupDrafts.id, id));
        break;
      }

      case 'skip': {
        await db.update(wrapupDrafts).set({
          status: 'completed',
          completionAction: 'skipped',
          outcome: 'skipped',
          reviewerId: body.reviewerId || undefined,
          reviewedAt: now,
          undoToken,
          undoExpiresAt: new Date(now.getTime() + UNDO_WINDOW_MS),
          completedAt: now,
          updatedAt: now,
        }).where(eq(wrapupDrafts.id, id));
        break;
      }

      case 'delete': {
        await db.update(wrapupDrafts).set({
          status: 'completed',
          completionAction: 'deleted',
          outcome: 'deleted',
          deleteReason: body.deleteReason || undefined,
          deleteNotes: body.deleteNotes || undefined,
          deletedById: body.reviewerId || undefined,
          deletedAt: now,
          undoToken,
          undoExpiresAt: new Date(now.getTime() + UNDO_WINDOW_MS),
          completedAt: now,
          updatedAt: now,
        }).where(eq(wrapupDrafts.id, id));
        break;
      }

      default:
        return NextResponse.json({ success: false, error: `Unknown action: ${body.action}` }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      action: body.action,
      undoToken,
      undoExpiresAt: new Date(now.getTime() + UNDO_WINDOW_MS).toISOString(),
    });
  } catch (error) {
    console.error('[queue/complete] Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
