import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { leadQueueEntries, leadRoundRobinState, leadClaimActivity, users } from '@/db/schema';
import { eq, and, desc, asc, or, isNull, ne, sql, inArray, count } from 'drizzle-orm';

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

    // Batch-fetch all unique user IDs in a single query (fixes N+1)
    const userIds = new Set<string>();
    leads.forEach(lead => {
      if (lead.assignedUserId) userIds.add(lead.assignedUserId);
      if (lead.claimedBy) userIds.add(lead.claimedBy);
    });

    const usersMap = new Map<string, { id: string; firstName: string | null; lastName: string | null; email: string | null }>();
    if (userIds.size > 0) {
      const usersList = await db
        .select({ id: users.id, firstName: users.firstName, lastName: users.lastName, email: users.email })
        .from(users)
        .where(inArray(users.id, Array.from(userIds)));
      usersList.forEach(u => usersMap.set(u.id, u));
    }

    // Enrich leads with user info from the batch-fetched map
    const enrichedLeads = leads.map(lead => ({
      ...lead,
      assignedUser: lead.assignedUserId ? usersMap.get(lead.assignedUserId) || null : null,
      claimedByUser: lead.claimedBy ? usersMap.get(lead.claimedBy) || null : null,
    }));

    // Get counts by status using SQL GROUP BY (fixes full table scan)
    const statusCounts = await db
      .select({
        status: leadQueueEntries.status,
        count: count(),
      })
      .from(leadQueueEntries)
      .where(eq(leadQueueEntries.tenantId, tenantId))
      .groupBy(leadQueueEntries.status);

    const counts = {
      total: 0,
      queued: 0,
      notified: 0,
      escalated: 0,
      claimed: 0,
      converted: 0,
      expired: 0,
    };
    statusCounts.forEach(row => {
      const c = Number(row.count);
      counts.total += c;
      if (row.status && row.status in counts) {
        counts[row.status as keyof typeof counts] = c;
      }
    });

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
