import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { leadQueueEntries, leadRoundRobinState, leadClaimActivity, users } from '@/db/schema';
import { eq, and, desc, asc, or, isNull, ne } from 'drizzle-orm';

// GET /api/leads - Get lead queue
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status'); // queued, notified, escalated, claimed, converted, expired
    const assignedTo = searchParams.get('assignedTo'); // user ID
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const tenantId = process.env.DEFAULT_TENANT_ID;

    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant not configured' }, { status: 500 });
    }

    // Build filters
    const filters = [eq(leadQueueEntries.tenantId, tenantId)];
    
    if (status) {
      filters.push(eq(leadQueueEntries.status, status));
    }
    
    if (assignedTo) {
      filters.push(eq(leadQueueEntries.assignedUserId, assignedTo));
    }

    // Get leads
    const leads = await db
      .select()
      .from(leadQueueEntries)
      .where(and(...filters))
      .orderBy(
        // Priority order: urgent > high > normal > low, then by created date
        asc(leadQueueEntries.status),
        desc(leadQueueEntries.createdAt)
      )
      .limit(limit);

    // Enrich with user info
    const enrichedLeads = await Promise.all(
      leads.map(async (lead) => {
        let assignedUser = null;
        let claimedByUser = null;

        if (lead.assignedUserId) {
          const [u] = await db
            .select({ id: users.id, firstName: users.firstName, lastName: users.lastName, email: users.email })
            .from(users)
            .where(eq(users.id, lead.assignedUserId))
            .limit(1);
          assignedUser = u;
        }

        if (lead.claimedBy) {
          const [u] = await db
            .select({ id: users.id, firstName: users.firstName, lastName: users.lastName, email: users.email })
            .from(users)
            .where(eq(users.id, lead.claimedBy))
            .limit(1);
          claimedByUser = u;
        }

        return {
          ...lead,
          assignedUser,
          claimedByUser,
        };
      })
    );

    // Get counts by status
    const allLeads = await db
      .select({ status: leadQueueEntries.status })
      .from(leadQueueEntries)
      .where(eq(leadQueueEntries.tenantId, tenantId));

    const counts = {
      total: allLeads.length,
      queued: allLeads.filter(l => l.status === 'queued').length,
      notified: allLeads.filter(l => l.status === 'notified').length,
      escalated: allLeads.filter(l => l.status === 'escalated').length,
      claimed: allLeads.filter(l => l.status === 'claimed').length,
      converted: allLeads.filter(l => l.status === 'converted').length,
      expired: allLeads.filter(l => l.status === 'expired').length,
    };

    return NextResponse.json({
      success: true,
      leads: enrichedLeads,
      counts,
    });
  } catch (error) {
    console.error('Lead queue fetch error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Fetch failed' },
      { status: 500 }
    );
  }
}

// POST /api/leads - Create a new lead in queue
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const tenantId = process.env.DEFAULT_TENANT_ID;

    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant not configured' }, { status: 500 });
    }

    const {
      source,
      sourceReference,
      contactName,
      contactPhone,
      contactEmail,
      contactAddress,
      insuranceType,
      leadNotes,
      priority = 'normal',
      createdByUserId, // If agent created it, auto-assign
      rawPayload,
    } = body;

    // Check if creator is a producer (role = 'agent')
    let assignedUserId = null;
    let status = 'queued';
    let bypassRoundRobin = false;

    if (createdByUserId) {
      const [creator] = await db
        .select({ id: users.id, role: users.role })
        .from(users)
        .where(eq(users.id, createdByUserId))
        .limit(1);

      if (creator && creator.role === 'agent') {
        // Producer created this lead - auto-assign to them
        assignedUserId = createdByUserId;
        status = 'claimed';
        bypassRoundRobin = true;
      }
    }

    // Create lead
    const [lead] = await db
      .insert(leadQueueEntries)
      .values({
        tenantId,
        source: source || 'manual',
        sourceReference,
        contactName,
        contactPhone,
        contactEmail,
        contactAddress,
        insuranceType,
        leadNotes,
        priority,
        status,
        assignedUserId,
        claimedBy: bypassRoundRobin ? assignedUserId : null,
        claimedAt: bypassRoundRobin ? new Date() : null,
        rawPayload,
      })
      .returning();

    // Log activity
    if (bypassRoundRobin) {
      await db.insert(leadClaimActivity).values({
        tenantId,
        leadId: lead.id,
        userId: assignedUserId,
        action: 'claimed',
        metadata: { reason: 'producer_created', source },
      });
    }

    return NextResponse.json({
      success: true,
      lead,
      bypassedRoundRobin: bypassRoundRobin,
    });
  } catch (error) {
    console.error('Lead create error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Create failed' },
      { status: 500 }
    );
  }
}
