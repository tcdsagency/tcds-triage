/**
 * API Route: /api/policy-notices
 * ==============================
 * List policy notices with filters for agent review queue.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { policyNotices, users, customers } from "@/db/schema";
import { eq, and, desc, sql, ilike, or } from "drizzle-orm";

// =============================================================================
// GET - List Policy Notices
// =============================================================================

export async function GET(request: NextRequest) {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);

    // Parse filters
    const status = searchParams.get("status"); // pending, assigned, reviewed, actioned, dismissed
    const type = searchParams.get("type"); // billing, policy, claim
    const urgency = searchParams.get("urgency"); // low, medium, high, urgent
    const assignedToId = searchParams.get("assignedToId");
    const carrier = searchParams.get("carrier");
    const search = searchParams.get("search");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = (page - 1) * limit;

    // Build where conditions
    const conditions = [eq(policyNotices.tenantId, tenantId)];

    if (status) {
      conditions.push(eq(policyNotices.reviewStatus, status as any));
    }

    if (type) {
      conditions.push(eq(policyNotices.noticeType, type as any));
    }

    if (urgency) {
      conditions.push(eq(policyNotices.urgency, urgency as any));
    }

    if (assignedToId) {
      conditions.push(eq(policyNotices.assignedToId, assignedToId));
    }

    if (carrier) {
      conditions.push(ilike(policyNotices.carrier, `%${carrier}%`));
    }

    if (search) {
      conditions.push(
        or(
          ilike(policyNotices.insuredName, `%${search}%`),
          ilike(policyNotices.policyNumber, `%${search}%`),
          ilike(policyNotices.title, `%${search}%`)
        )!
      );
    }

    // Execute query
    const notices = await db
      .select({
        id: policyNotices.id,
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
        noticeDate: policyNotices.noticeDate,
        createdAt: policyNotices.createdAt,
        updatedAt: policyNotices.updatedAt,
        // Join assignedTo user
        assignedToName: users.firstName,
        assignedToLastName: users.lastName,
        // Join customer
        customerFirstName: customers.firstName,
        customerLastName: customers.lastName,
        customerAgencyZoomId: customers.agencyzoomId,
      })
      .from(policyNotices)
      .leftJoin(users, eq(policyNotices.assignedToId, users.id))
      .leftJoin(customers, eq(policyNotices.customerId, customers.id))
      .where(and(...conditions))
      .orderBy(
        // Order by urgency first, then by notice date
        sql`CASE ${policyNotices.urgency}
          WHEN 'urgent' THEN 0
          WHEN 'high' THEN 1
          WHEN 'medium' THEN 2
          WHEN 'low' THEN 3
        END`,
        desc(policyNotices.noticeDate)
      )
      .limit(limit)
      .offset(offset);

    // Get total count for pagination
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(policyNotices)
      .where(and(...conditions));

    // Get stats for each status
    const stats = await db
      .select({
        status: policyNotices.reviewStatus,
        count: sql<number>`count(*)::int`,
      })
      .from(policyNotices)
      .where(eq(policyNotices.tenantId, tenantId))
      .groupBy(policyNotices.reviewStatus);

    const statusCounts: Record<string, number> = {
      pending: 0,
      assigned: 0,
      reviewed: 0,
      actioned: 0,
      dismissed: 0,
    };
    for (const stat of stats) {
      if (stat.status) {
        statusCounts[stat.status] = stat.count;
      }
    }

    // Format response
    const formattedNotices = notices.map((notice) => ({
      ...notice,
      assignedTo: notice.assignedToId
        ? {
            id: notice.assignedToId,
            name: `${notice.assignedToName || ''} ${notice.assignedToLastName || ''}`.trim(),
          }
        : null,
      customer: notice.customerId
        ? {
            id: notice.customerId,
            name: `${notice.customerFirstName || ''} ${notice.customerLastName || ''}`.trim(),
            agencyZoomId: notice.customerAgencyZoomId,
          }
        : null,
    }));

    // Deduplicate notices with same policy + title on same day
    const seenKeys = new Set<string>();
    const deduplicatedNotices = formattedNotices.filter((notice) => {
      const dateStr = notice.noticeDate
        ? new Date(notice.noticeDate).toISOString().split('T')[0]
        : notice.createdAt.toISOString().split('T')[0];
      const dedupKey = `${notice.policyNumber || ''}-${notice.title}-${dateStr}`;

      if (seenKeys.has(dedupKey)) {
        return false;
      }
      seenKeys.add(dedupKey);
      return true;
    });

    return NextResponse.json({
      success: true,
      notices: deduplicatedNotices,
      pagination: {
        page,
        limit,
        total: count,
        totalPages: Math.ceil(count / limit),
      },
      stats: statusCounts,
    });
  } catch (error) {
    console.error("Error fetching policy notices:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch notices" },
      { status: 500 }
    );
  }
}
