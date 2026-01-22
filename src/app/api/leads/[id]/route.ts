import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { leadQueueEntries, leadClaimActivity, users, customers } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { getAgencyZoomClient } from '@/lib/api/agencyzoom';

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

// PATCH /api/leads/[id] - Update lead (assign, convert, etc.) or customer details for pipeline
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
      // Customer/Pipeline lead fields (when no action specified)
      firstName,
      lastName,
      email,
      phone,
      quotedPremium,
      producerId,
    } = body;

    // If no action specified, this is a customer detail update (for pipeline leads)
    if (!action) {
      return handleCustomerUpdate(id, tenantId, {
        firstName,
        lastName,
        email,
        phone,
        quotedPremium,
        producerId,
      });
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

// =============================================================================
// Helper: Update customer details (for pipeline leads)
// =============================================================================

interface CustomerUpdateData {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  quotedPremium?: number | null;
  producerId?: string | null;
}

async function handleCustomerUpdate(
  id: string,
  tenantId: string,
  data: CustomerUpdateData
) {
  const { firstName, lastName, email, phone, quotedPremium, producerId } = data;

  // Get the current customer/lead
  const [customer] = await db
    .select({
      id: customers.id,
      agencyzoomId: customers.agencyzoomId,
      firstName: customers.firstName,
      lastName: customers.lastName,
      email: customers.email,
      phone: customers.phone,
      quotedPremium: customers.quotedPremium,
      producerId: customers.producerId,
    })
    .from(customers)
    .where(and(eq(customers.tenantId, tenantId), eq(customers.id, id)))
    .limit(1);

  if (!customer) {
    return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
  }

  // Build update object with only provided fields
  const updateData: Record<string, any> = {
    updatedAt: new Date(),
  };

  if (firstName !== undefined) updateData.firstName = firstName;
  if (lastName !== undefined) updateData.lastName = lastName;
  if (email !== undefined) updateData.email = email || null;
  if (phone !== undefined) updateData.phone = phone || null;
  if (quotedPremium !== undefined) updateData.quotedPremium = quotedPremium;
  if (producerId !== undefined) updateData.producerId = producerId;

  // Update local database
  const [updated] = await db
    .update(customers)
    .set(updateData)
    .where(eq(customers.id, id))
    .returning({
      id: customers.id,
      firstName: customers.firstName,
      lastName: customers.lastName,
      email: customers.email,
      phone: customers.phone,
      quotedPremium: customers.quotedPremium,
      producerId: customers.producerId,
    });

  // Push to AgencyZoom if customer has an agencyzoomId
  let azSyncResult = { success: true, error: null as string | null };

  if (customer.agencyzoomId) {
    try {
      const azClient = getAgencyZoomClient();

      // Build AgencyZoom update payload (only contact fields are synced)
      const azUpdate: Record<string, any> = {};
      if (firstName !== undefined) azUpdate.firstName = firstName;
      if (lastName !== undefined) azUpdate.lastName = lastName;
      if (email !== undefined) azUpdate.email = email || null;
      if (phone !== undefined) azUpdate.phone = phone || null;

      // Only sync if there are fields to update in AgencyZoom
      if (Object.keys(azUpdate).length > 0) {
        await azClient.updateLead(parseInt(customer.agencyzoomId), azUpdate);
        console.log(
          `[Lead Update] Pushed updates to AgencyZoom for lead ${customer.agencyzoomId}:`,
          azUpdate
        );
      }
    } catch (azError: any) {
      console.error(
        `[Lead Update] Failed to push to AgencyZoom for lead ${customer.agencyzoomId}:`,
        azError
      );
      azSyncResult = {
        success: false,
        error: azError.message || 'Failed to sync with AgencyZoom',
      };
    }
  }

  return NextResponse.json({
    success: true,
    lead: updated,
    agencyzoomSync: azSyncResult,
    message: azSyncResult.success
      ? 'Lead updated successfully'
      : 'Lead updated locally, but AgencyZoom sync failed',
  });
}
