import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { leadQueueEntries, leadClaimActivity, users } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

// POST /api/leads/claim - Claim a lead
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const tenantId = process.env.DEFAULT_TENANT_ID;

    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant not configured' }, { status: 500 });
    }

    const { leadId, userId } = body;

    if (!leadId || !userId) {
      return NextResponse.json({ error: 'leadId and userId required' }, { status: 400 });
    }

    // Get lead
    const [lead] = await db
      .select()
      .from(leadQueueEntries)
      .where(and(eq(leadQueueEntries.tenantId, tenantId), eq(leadQueueEntries.id, leadId)))
      .limit(1);

    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    // Check if already claimed
    if (lead.status === 'claimed' || lead.status === 'converted') {
      // Get who claimed it
      let claimedByUser = null;
      if (lead.claimedBy) {
        const [u] = await db
          .select({ firstName: users.firstName, lastName: users.lastName })
          .from(users)
          .where(eq(users.id, lead.claimedBy))
          .limit(1);
        claimedByUser = u;
      }

      return NextResponse.json({
        success: false,
        error: 'Lead already claimed',
        claimedBy: claimedByUser ? `${claimedByUser.firstName} ${claimedByUser.lastName}` : 'Unknown',
        claimedAt: lead.claimedAt,
      }, { status: 409 });
    }

    // Check if lead is expired
    if (lead.status === 'expired') {
      return NextResponse.json({ error: 'Lead has expired' }, { status: 400 });
    }

    // Claim the lead
    const [updated] = await db
      .update(leadQueueEntries)
      .set({
        status: 'claimed',
        claimedBy: userId,
        claimedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(leadQueueEntries.id, leadId))
      .returning();

    // Log activity
    await db.insert(leadClaimActivity).values({
      tenantId,
      leadId,
      userId,
      action: 'claimed',
      metadata: { previousStatus: lead.status },
    });

    // Get user info for response
    const [user] = await db
      .select({ firstName: users.firstName, lastName: users.lastName, email: users.email })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    return NextResponse.json({
      success: true,
      lead: updated,
      claimedBy: user,
    });
  } catch (error) {
    console.error('Lead claim error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Claim failed' },
      { status: 500 }
    );
  }
}
