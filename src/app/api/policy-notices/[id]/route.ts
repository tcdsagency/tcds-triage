/**
 * API Route: /api/policy-notices/[id]
 * ====================================
 * Get, update, and perform actions on individual policy notices.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { policyNotices, users, customers, policies } from "@/db/schema";
import { eq, and } from "drizzle-orm";

type RouteContext = { params: Promise<{ id: string }> };

// =============================================================================
// GET - Get Single Notice
// =============================================================================

export async function GET(
  request: NextRequest,
  { params }: RouteContext
) {
  try {
    const { id } = await params;
    const tenantId = process.env.DEFAULT_TENANT_ID;

    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    const [notice] = await db
      .select({
        id: policyNotices.id,
        tenantId: policyNotices.tenantId,
        adaptNoticeId: policyNotices.adaptNoticeId,
        noticeType: policyNotices.noticeType,
        urgency: policyNotices.urgency,
        policyNumber: policyNotices.policyNumber,
        insuredName: policyNotices.insuredName,
        carrier: policyNotices.carrier,
        lineOfBusiness: policyNotices.lineOfBusiness,
        customerId: policyNotices.customerId,
        policyId: policyNotices.policyId,
        title: policyNotices.title,
        description: policyNotices.description,
        amountDue: policyNotices.amountDue,
        dueDate: policyNotices.dueDate,
        gracePeriodEnd: policyNotices.gracePeriodEnd,
        claimNumber: policyNotices.claimNumber,
        claimDate: policyNotices.claimDate,
        claimStatus: policyNotices.claimStatus,
        reviewStatus: policyNotices.reviewStatus,
        assignedToId: policyNotices.assignedToId,
        assignedAt: policyNotices.assignedAt,
        reviewedById: policyNotices.reviewedById,
        reviewedAt: policyNotices.reviewedAt,
        reviewNotes: policyNotices.reviewNotes,
        actionTaken: policyNotices.actionTaken,
        actionDetails: policyNotices.actionDetails,
        actionedAt: policyNotices.actionedAt,
        zapierWebhookSent: policyNotices.zapierWebhookSent,
        zapierWebhookSentAt: policyNotices.zapierWebhookSentAt,
        zapierWebhookStatus: policyNotices.zapierWebhookStatus,
        rawPayload: policyNotices.rawPayload,
        noticeDate: policyNotices.noticeDate,
        fetchedAt: policyNotices.fetchedAt,
        createdAt: policyNotices.createdAt,
        updatedAt: policyNotices.updatedAt,
      })
      .from(policyNotices)
      .where(
        and(eq(policyNotices.id, id), eq(policyNotices.tenantId, tenantId))
      )
      .limit(1);

    if (!notice) {
      return NextResponse.json({ error: "Notice not found" }, { status: 404 });
    }

    // Fetch related data
    let assignedTo = null;
    let reviewedBy = null;
    let customer = null;
    let policy = null;

    if (notice.assignedToId) {
      const [user] = await db
        .select({
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email,
        })
        .from(users)
        .where(eq(users.id, notice.assignedToId));
      assignedTo = user;
    }

    if (notice.reviewedById) {
      const [user] = await db
        .select({
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email,
        })
        .from(users)
        .where(eq(users.id, notice.reviewedById));
      reviewedBy = user;
    }

    if (notice.customerId) {
      const [cust] = await db
        .select({
          id: customers.id,
          firstName: customers.firstName,
          lastName: customers.lastName,
          email: customers.email,
          phone: customers.phone,
          agencyzoomId: customers.agencyzoomId,
        })
        .from(customers)
        .where(eq(customers.id, notice.customerId));
      customer = cust;
    }

    if (notice.policyId) {
      const [pol] = await db
        .select({
          id: policies.id,
          policyNumber: policies.policyNumber,
          carrier: policies.carrier,
          type: policies.lineOfBusiness,
          status: policies.status,
        })
        .from(policies)
        .where(eq(policies.id, notice.policyId));
      policy = pol;
    }

    return NextResponse.json({
      success: true,
      notice: {
        ...notice,
        assignedTo,
        reviewedBy,
        customer,
        policy,
      },
    });
  } catch (error) {
    console.error("Error fetching policy notice:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch notice" },
      { status: 500 }
    );
  }
}

// =============================================================================
// PATCH - Update Notice
// =============================================================================

export async function PATCH(
  request: NextRequest,
  { params }: RouteContext
) {
  try {
    const { id } = await params;
    const tenantId = process.env.DEFAULT_TENANT_ID;

    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    const body = await request.json();

    // Validate notice exists
    const [existing] = await db
      .select({ id: policyNotices.id })
      .from(policyNotices)
      .where(
        and(eq(policyNotices.id, id), eq(policyNotices.tenantId, tenantId))
      );

    if (!existing) {
      return NextResponse.json({ error: "Notice not found" }, { status: 404 });
    }

    // Build update object
    const updateData: Partial<typeof policyNotices.$inferInsert> = {
      updatedAt: new Date(),
    };

    // Allow updating these fields
    if (body.urgency !== undefined) {
      updateData.urgency = body.urgency;
    }
    if (body.reviewNotes !== undefined) {
      updateData.reviewNotes = body.reviewNotes;
    }
    if (body.customerId !== undefined) {
      updateData.customerId = body.customerId;
    }
    if (body.policyId !== undefined) {
      updateData.policyId = body.policyId;
    }

    const [updated] = await db
      .update(policyNotices)
      .set(updateData)
      .where(eq(policyNotices.id, id))
      .returning();

    return NextResponse.json({ success: true, notice: updated });
  } catch (error) {
    console.error("Error updating policy notice:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update notice" },
      { status: 500 }
    );
  }
}

// =============================================================================
// POST - Perform Actions
// =============================================================================

interface ActionRequest {
  action: 'assign' | 'review' | 'action' | 'dismiss' | 'reopen';
  userId?: string;
  reviewNotes?: string;
  actionTaken?: string;
  actionDetails?: string;
}

export async function POST(
  request: NextRequest,
  { params }: RouteContext
) {
  try {
    const { id } = await params;
    const tenantId = process.env.DEFAULT_TENANT_ID;

    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    const body: ActionRequest = await request.json();

    if (!body.action) {
      return NextResponse.json({ error: "Action is required" }, { status: 400 });
    }

    // Validate notice exists
    const [existing] = await db
      .select()
      .from(policyNotices)
      .where(
        and(eq(policyNotices.id, id), eq(policyNotices.tenantId, tenantId))
      );

    if (!existing) {
      return NextResponse.json({ error: "Notice not found" }, { status: 404 });
    }

    const now = new Date();
    let updateData: Partial<typeof policyNotices.$inferInsert> = {
      updatedAt: now,
    };

    switch (body.action) {
      case 'assign':
        if (!body.userId) {
          return NextResponse.json(
            { error: "userId is required for assign action" },
            { status: 400 }
          );
        }
        updateData = {
          ...updateData,
          reviewStatus: 'assigned',
          assignedToId: body.userId,
          assignedAt: now,
        };
        break;

      case 'review':
        if (!body.userId) {
          return NextResponse.json(
            { error: "userId is required for review action" },
            { status: 400 }
          );
        }
        updateData = {
          ...updateData,
          reviewStatus: 'reviewed',
          reviewedById: body.userId,
          reviewedAt: now,
          reviewNotes: body.reviewNotes || existing.reviewNotes,
        };
        break;

      case 'action':
        if (!body.userId || !body.actionTaken) {
          return NextResponse.json(
            { error: "userId and actionTaken are required for action" },
            { status: 400 }
          );
        }
        updateData = {
          ...updateData,
          reviewStatus: 'actioned',
          reviewedById: body.userId,
          reviewedAt: existing.reviewedAt || now,
          actionTaken: body.actionTaken,
          actionDetails: body.actionDetails,
          actionedAt: now,
        };
        break;

      case 'dismiss':
        if (!body.userId) {
          return NextResponse.json(
            { error: "userId is required for dismiss action" },
            { status: 400 }
          );
        }
        updateData = {
          ...updateData,
          reviewStatus: 'dismissed',
          reviewedById: body.userId,
          reviewedAt: now,
          reviewNotes: body.reviewNotes || existing.reviewNotes,
        };
        break;

      case 'reopen':
        updateData = {
          ...updateData,
          reviewStatus: 'pending',
          assignedToId: null,
          assignedAt: null,
          reviewedById: null,
          reviewedAt: null,
          actionTaken: null,
          actionDetails: null,
          actionedAt: null,
          zapierWebhookSent: false,
          zapierWebhookSentAt: null,
          zapierWebhookStatus: null,
        };
        break;

      default:
        return NextResponse.json(
          { error: `Unknown action: ${body.action}` },
          { status: 400 }
        );
    }

    const [updated] = await db
      .update(policyNotices)
      .set(updateData)
      .where(eq(policyNotices.id, id))
      .returning();

    return NextResponse.json({
      success: true,
      action: body.action,
      notice: updated,
    });
  } catch (error) {
    console.error("Error performing action on policy notice:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to perform action" },
      { status: 500 }
    );
  }
}
