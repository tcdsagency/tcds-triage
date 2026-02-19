// =============================================================================
// Queue Bulk Actions — POST /api/queue/bulk
// =============================================================================
// Bulk skip/delete/post_note/void for multiple queue items
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { wrapupDrafts } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";

interface BulkRequest {
  ids: string[];
  action: 'skip' | 'delete' | 'post_note' | 'void';
  reviewerId?: string;
  deleteReason?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as BulkRequest;

    if (!body.ids || body.ids.length === 0) {
      return NextResponse.json({ success: false, error: 'ids required' }, { status: 400 });
    }

    if (body.ids.length > 100) {
      return NextResponse.json({ success: false, error: 'Max 100 items per bulk action' }, { status: 400 });
    }

    const now = new Date();
    let updated = 0;

    switch (body.action) {
      case 'skip': {
        const result = await db.update(wrapupDrafts).set({
          status: 'completed',
          completionAction: 'skipped',
          outcome: 'skipped',
          reviewerId: body.reviewerId || undefined,
          reviewedAt: now,
          completedAt: now,
          updatedAt: now,
        }).where(inArray(wrapupDrafts.id, body.ids));
        updated = body.ids.length;
        break;
      }

      case 'delete': {
        await db.update(wrapupDrafts).set({
          status: 'completed',
          completionAction: 'deleted',
          outcome: 'deleted',
          deleteReason: body.deleteReason || 'no_action_needed',
          deletedById: body.reviewerId || undefined,
          deletedAt: now,
          completedAt: now,
          updatedAt: now,
        }).where(inArray(wrapupDrafts.id, body.ids));
        updated = body.ids.length;
        break;
      }

      case 'void': {
        await db.update(wrapupDrafts).set({
          status: 'completed',
          completionAction: 'skipped',
          outcome: 'auto_voided',
          isAutoVoided: true,
          autoVoidReason: 'bulk_void',
          reviewerId: body.reviewerId || undefined,
          reviewedAt: now,
          completedAt: now,
          updatedAt: now,
        }).where(inArray(wrapupDrafts.id, body.ids));
        updated = body.ids.length;
        break;
      }

      case 'post_note': {
        // Bulk note posting — mark as posted, actual AZ posting handled async
        await db.update(wrapupDrafts).set({
          status: 'completed',
          completionAction: 'posted',
          outcome: 'note_posted',
          noteAutoPosted: true,
          noteAutoPostedAt: now,
          reviewerId: body.reviewerId || undefined,
          reviewedAt: now,
          completedAt: now,
          updatedAt: now,
        }).where(inArray(wrapupDrafts.id, body.ids));
        updated = body.ids.length;
        break;
      }

      default:
        return NextResponse.json({ success: false, error: `Unknown action: ${body.action}` }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      action: body.action,
      updated,
    });
  } catch (error) {
    console.error('[queue/bulk] Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
