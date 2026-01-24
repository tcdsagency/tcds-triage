// API Route: /api/pending-review/bulk-action
// Endpoint for bulk operations on triage items (skip, delete, post notes)

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { wrapupDrafts, users } from '@/db/schema';
import { eq, inArray } from 'drizzle-orm';
import { createClient } from '@/lib/supabase/server';

async function getCurrentUser() {
  try {
    const supabase = await createClient();
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();

    if (!authUser?.email) return null;

    const [dbUser] = await db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
      })
      .from(users)
      .where(eq(users.email, authUser.email))
      .limit(1);

    if (!dbUser) return null;

    return {
      id: dbUser.id,
      name: `${dbUser.firstName} ${dbUser.lastName}`,
      email: dbUser.email,
    };
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { itemIds, action, reason, notes } = body;

    if (!itemIds || !Array.isArray(itemIds) || itemIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'itemIds array is required' },
        { status: 400 }
      );
    }

    if (!action) {
      return NextResponse.json({ success: false, error: 'action is required' }, { status: 400 });
    }

    const validActions = ['skip', 'delete', 'post_note', 'void'];
    if (!validActions.includes(action)) {
      return NextResponse.json(
        { success: false, error: `Invalid action. Must be one of: ${validActions.join(', ')}` },
        { status: 400 }
      );
    }

    let updateData: Record<string, unknown> = {
      updatedAt: new Date(),
      reviewerId: currentUser.id,
      reviewedAt: new Date(),
    };

    switch (action) {
      case 'skip':
        updateData = {
          ...updateData,
          status: 'skipped',
          completionAction: 'skipped',
          completedAt: new Date(),
        };
        break;

      case 'delete':
        if (!reason) {
          return NextResponse.json(
            { success: false, error: 'reason is required for delete action' },
            { status: 400 }
          );
        }
        updateData = {
          ...updateData,
          status: 'deleted',
          completionAction: 'deleted',
          deleteReason: reason,
          deleteNotes: notes || null,
          deletedById: currentUser.id,
          deletedAt: new Date(),
          completedAt: new Date(),
        };
        break;

      case 'void':
        updateData = {
          ...updateData,
          status: 'voided',
          completionAction: 'voided',
          isAutoVoided: false, // Manual void
          autoVoidReason: reason || 'manual_void',
          completedAt: new Date(),
        };
        break;

      case 'post_note':
        // For post_note, we mark as completed - actual AgencyZoom posting
        // would need to happen in a separate job or via the individual endpoint
        updateData = {
          ...updateData,
          status: 'completed',
          completionAction: 'posted',
          completedAt: new Date(),
        };
        break;
    }

    // Perform the bulk update
    const result = await db
      .update(wrapupDrafts)
      .set(updateData)
      .where(inArray(wrapupDrafts.id, itemIds));

    console.log(
      `[Bulk Action] ${action} performed on ${itemIds.length} items by ${currentUser.name}`
    );

    return NextResponse.json({
      success: true,
      action,
      affectedCount: itemIds.length,
      message: `Successfully ${action === 'delete' ? 'deleted' : action === 'skip' ? 'skipped' : action === 'void' ? 'voided' : 'processed'} ${itemIds.length} items`,
    });
  } catch (error: unknown) {
    console.error('[Bulk Action API] Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to perform bulk action' },
      { status: 500 }
    );
  }
}
