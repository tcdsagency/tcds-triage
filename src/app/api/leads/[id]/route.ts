import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { leadQueueEntries, leadClaimActivity, users } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

// GET /api/leads/[id] - Get single lead
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const tenantId = process.env.DEFAULT_TENANT_ID;

    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant not configured' }, { status: 500 });
    }

    const [lead] = await db
      .select()
      .from(leadQueueEntries)
      .where(and(eq(leadQueueEntries.tenantId, tenantId), eq(leadQueueEntries.id, id)))
      .limit(1);

    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    // Get activity history
    const activity = await db
      .select()
      .from(leadClaimActivity)
      .where(eq(leadClaimActivity.leadId, id))
      .orderBy(leadClaimActivity.timestamp);

    // Enrich activity with user names
    const enrichedActivity = await Promise.all(
      activity.map(async (a) => {
        let user = null;
        if (a.userId) {
          const [u] = await db
            .select({ firstName: users.firstName, lastName: users.lastName })
            .from(users)
            .where(eq(users.id, a.userId))
            .limit(1);
          user = u;
        }
        return { ...a, user };
      })
    );

    // Get assigned user
    let assignedUser = null;
    if (lead.assignedUserId) {
      const [u] = await db
        .select({ id: users.id, firstName: users.firstName, lastName: users.lastName, email: users.email })
        .from(users)
        .where(eq(users.id, lead.assignedUserId))
        .limit(1);
      assignedUser = u;
    }

    // Get claimed by user
    let claimedByUser = null;
    if (lead.claimedBy) {
      const [u] = await db
        .select({ id: users.id, firstName: users.firstName, lastName: users.lastName, email: users.email })
        .from(users)
        .where(eq(users.id, lead.claimedBy))
        .limit(1);
      claimedByUser = u;
    }

    return NextResponse.json({
      success: true,
      lead: {
        ...lead,
        assignedUser,
        claimedByUser,
      },
      activity: enrichedActivity,
    });
  } catch (error) {
    console.error('Lead fetch error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Fetch failed' },
      { status: 500 }
    );
  }
}

// PATCH /api/leads/[id] - Update lead (assign, convert, etc.)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const tenantId = process.env.DEFAULT_TENANT_ID;

    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant not configured' }, { status: 500 });
    }

    const {
      action, // 'assign', 'escalate', 'convert', 'expire'
      assignToUserId,
      userId, // User performing the action
      agencyzoomLeadId,
    } = body;

    // Get current lead
    const [lead] = await db
      .select()
      .from(leadQueueEntries)
      .where(and(eq(leadQueueEntries.tenantId, tenantId), eq(leadQueueEntries.id, id)))
      .limit(1);

    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    let updates: Partial<typeof leadQueueEntries.$inferInsert> = {
      updatedAt: new Date(),
    };
    let activityAction = action;

    switch (action) {
      case 'assign':
        if (!assignToUserId) {
          return NextResponse.json({ error: 'assignToUserId required' }, { status: 400 });
        }
        updates = {
          ...updates,
          assignedUserId: assignToUserId,
          status: 'notified',
          notifiedAt: new Date(),
          expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
        };
        break;

      case 'escalate':
        updates = {
          ...updates,
          status: 'escalated',
          escalatedAt: new Date(),
        };
        activityAction = 'escalated';
        break;

      case 'convert':
        updates = {
          ...updates,
          status: 'converted',
          agencyzoomLeadId,
          agencyzoomSyncStatus: agencyzoomLeadId ? 'synced' : 'pending',
          agencyzoomSyncedAt: agencyzoomLeadId ? new Date() : null,
        };
        activityAction = 'converted';
        break;

      case 'expire':
        updates = {
          ...updates,
          status: 'expired',
        };
        activityAction = 'timed_out';
        break;

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    // Update lead
    const [updated] = await db
      .update(leadQueueEntries)
      .set(updates)
      .where(eq(leadQueueEntries.id, id))
      .returning();

    // Log activity
    await db.insert(leadClaimActivity).values({
      tenantId,
      leadId: id,
      userId: userId || assignToUserId,
      action: activityAction,
      metadata: { previousStatus: lead.status },
    });

    return NextResponse.json({
      success: true,
      lead: updated,
    });
  } catch (error) {
    console.error('Lead update error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Update failed' },
      { status: 500 }
    );
  }
}
