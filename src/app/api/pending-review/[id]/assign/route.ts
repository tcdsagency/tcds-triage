// API Route: /api/pending-review/[id]/assign
// Endpoint to assign/unassign triage items to team members

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { wrapupDrafts, users } from '@/db/schema';
import { eq } from 'drizzle-orm';
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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: itemId } = await params;
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { assignedTo } = body;

    // Validate the item exists
    const [existing] = await db
      .select({ id: wrapupDrafts.id })
      .from(wrapupDrafts)
      .where(eq(wrapupDrafts.id, itemId))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ success: false, error: 'Item not found' }, { status: 404 });
    }

    // Handle special 'me' value
    const targetUserId = assignedTo === 'me' ? currentUser.id : assignedTo;

    // Update assignment
    await db
      .update(wrapupDrafts)
      .set({
        assignedToId: targetUserId,
        assignedAt: targetUserId ? new Date() : null,
        assignedById: targetUserId ? currentUser.id : null,
        updatedAt: new Date(),
      })
      .where(eq(wrapupDrafts.id, itemId));

    // Get assignee name for response
    let assigneeName = null;
    if (targetUserId) {
      const [assignee] = await db
        .select({ firstName: users.firstName, lastName: users.lastName })
        .from(users)
        .where(eq(users.id, targetUserId))
        .limit(1);
      assigneeName = assignee ? `${assignee.firstName} ${assignee.lastName}` : null;
    }

    console.log(
      `[Assignment] Item ${itemId} ${targetUserId ? `assigned to ${assigneeName}` : 'unassigned'} by ${currentUser.name}`
    );

    return NextResponse.json({
      success: true,
      assignedTo: targetUserId,
      assigneeName,
    });
  } catch (error: unknown) {
    console.error('[Assignment API] Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to assign item' },
      { status: 500 }
    );
  }
}
