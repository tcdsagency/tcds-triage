import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { leadQueueEntries, leadClaimActivity } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

// PATCH /api/leads/[id]/status - Update lead status
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

    const { status, userId } = body;

    if (!status) {
      return NextResponse.json({ error: 'status is required' }, { status: 400 });
    }

    // Validate status value
    const validStatuses = ['queued', 'notified', 'escalated', 'claimed', 'converted', 'expired'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` }, { status: 400 });
    }

    // Get current lead
    const [lead] = await db
      .select()
      .from(leadQueueEntries)
      .where(and(eq(leadQueueEntries.tenantId, tenantId), eq(leadQueueEntries.id, id)))
      .limit(1);

    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    // Build updates based on new status
    const updates: Partial<typeof leadQueueEntries.$inferInsert> = {
      status,
      updatedAt: new Date(),
    };

    // Add timestamps based on status (only for fields that exist in schema)
    if (status === 'notified' && !lead.notifiedAt) {
      updates.notifiedAt = new Date();
    } else if (status === 'escalated' && !lead.escalatedAt) {
      updates.escalatedAt = new Date();
    } else if (status === 'claimed' && !lead.claimedAt) {
      updates.claimedAt = new Date();
    }
    // Note: 'converted' and 'expired' don't have dedicated timestamp fields

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
      userId: userId || null,
      action: `status_changed_to_${status}`,
      metadata: { previousStatus: lead.status, newStatus: status },
    });

    return NextResponse.json({
      success: true,
      lead: updated,
    });
  } catch (error) {
    console.error('Lead status update error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Update failed' },
      { status: 500 }
    );
  }
}
