// API Route: /api/reviewed-items
// Fetch completed/reviewed wrapups for the review log

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { wrapupDrafts, users } from "@/db/schema";
import { eq, desc, and, or, inArray, sql } from "drizzle-orm";

// =============================================================================
// TYPES
// =============================================================================

export interface ReviewedItem {
  id: string;
  callId: string | null;
  type: 'wrapup';
  direction: 'inbound' | 'outbound' | null;

  // Contact info
  customerName: string | null;
  customerPhone: string | null;
  customerEmail: string | null;

  // Review info
  status: string;
  outcome: string | null;
  isAutoVoided: boolean;
  autoVoidReason: string | null;

  // Reviewer info
  reviewerId: string | null;
  reviewerName: string | null;
  reviewedAt: string | null;
  completedAt: string | null;

  // Content
  summary: string | null;
  requestType: string | null;

  // Match info
  matchStatus: string | null;
  agencyzoomCustomerId: string | null;
  agencyzoomLeadId: string | null;
  agencyzoomNoteId: string | null;

  // Timestamps
  createdAt: string;
}

// =============================================================================
// GET - Fetch reviewed items
// =============================================================================

export async function GET(request: NextRequest) {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ success: false, error: "Tenant not configured" }, { status: 500 });
    }

    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");
    const filter = searchParams.get("filter"); // 'all', 'auto_voided', 'reviewed'

    // Build query conditions
    let conditions = and(
      eq(wrapupDrafts.tenantId, tenantId),
      eq(wrapupDrafts.status, "completed")
    );

    // Apply filter
    if (filter === 'auto_voided') {
      conditions = and(conditions, eq(wrapupDrafts.isAutoVoided, true));
    } else if (filter === 'reviewed') {
      conditions = and(conditions, eq(wrapupDrafts.isAutoVoided, false));
    }

    // Fetch completed wrapups
    const completedWrapups = await db
      .select({
        id: wrapupDrafts.id,
        callId: wrapupDrafts.callId,
        direction: wrapupDrafts.direction,
        customerName: wrapupDrafts.customerName,
        customerPhone: wrapupDrafts.customerPhone,
        customerEmail: wrapupDrafts.customerEmail,
        status: wrapupDrafts.status,
        outcome: wrapupDrafts.outcome,
        isAutoVoided: wrapupDrafts.isAutoVoided,
        autoVoidReason: wrapupDrafts.autoVoidReason,
        reviewerId: wrapupDrafts.reviewerId,
        reviewedAt: wrapupDrafts.reviewedAt,
        completedAt: wrapupDrafts.completedAt,
        summary: wrapupDrafts.aiCleanedSummary,
        requestType: wrapupDrafts.requestType,
        matchStatus: wrapupDrafts.matchStatus,
        agencyzoomNoteId: wrapupDrafts.agencyzoomNoteId,
        aiExtraction: wrapupDrafts.aiExtraction,
        createdAt: wrapupDrafts.createdAt,
      })
      .from(wrapupDrafts)
      .where(conditions)
      .orderBy(desc(wrapupDrafts.completedAt), desc(wrapupDrafts.createdAt))
      .limit(limit)
      .offset(offset);

    // Get reviewer names
    const reviewerIds = completedWrapups
      .map(w => w.reviewerId)
      .filter((id): id is string => id !== null);

    const reviewers = reviewerIds.length > 0
      ? await db
          .select({
            id: users.id,
            firstName: users.firstName,
            lastName: users.lastName,
          })
          .from(users)
          .where(inArray(users.id, reviewerIds))
      : [];

    const reviewerMap = new Map(reviewers.map(r => [r.id, `${r.firstName} ${r.lastName}`.trim()]));

    // Transform to response format
    const items: ReviewedItem[] = completedWrapups.map(w => {
      const extraction = w.aiExtraction as any || {};

      return {
        id: w.id,
        callId: w.callId,
        type: 'wrapup' as const,
        direction: w.direction?.toLowerCase() as 'inbound' | 'outbound' | null,
        customerName: w.customerName,
        customerPhone: w.customerPhone,
        customerEmail: w.customerEmail,
        status: w.status || 'completed',
        outcome: w.outcome,
        isAutoVoided: w.isAutoVoided || false,
        autoVoidReason: w.autoVoidReason,
        reviewerId: w.reviewerId,
        reviewerName: w.reviewerId ? reviewerMap.get(w.reviewerId) || null : null,
        reviewedAt: w.reviewedAt?.toISOString() || null,
        completedAt: w.completedAt?.toISOString() || null,
        summary: w.summary,
        requestType: w.requestType,
        matchStatus: w.matchStatus,
        agencyzoomCustomerId: extraction.agencyZoomCustomerId || null,
        agencyzoomLeadId: extraction.agencyZoomLeadId || null,
        agencyzoomNoteId: w.agencyzoomNoteId,
        createdAt: w.createdAt.toISOString(),
      };
    });

    // Get counts
    const totalCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(wrapupDrafts)
      .where(conditions);

    const autoVoidedCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(wrapupDrafts)
      .where(and(
        eq(wrapupDrafts.tenantId, tenantId),
        eq(wrapupDrafts.status, "completed"),
        eq(wrapupDrafts.isAutoVoided, true)
      ));

    const reviewedCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(wrapupDrafts)
      .where(and(
        eq(wrapupDrafts.tenantId, tenantId),
        eq(wrapupDrafts.status, "completed"),
        eq(wrapupDrafts.isAutoVoided, false)
      ));

    return NextResponse.json({
      success: true,
      items,
      counts: {
        total: Number(totalCount[0]?.count || 0),
        autoVoided: Number(autoVoidedCount[0]?.count || 0),
        reviewed: Number(reviewedCount[0]?.count || 0),
      },
      pagination: {
        limit,
        offset,
        hasMore: items.length === limit,
      },
    });
  } catch (error) {
    console.error("[Reviewed Items] Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch reviewed items" },
      { status: 500 }
    );
  }
}

// =============================================================================
// POST - Re-submit item for review or reverse completion
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ success: false, error: "Tenant not configured" }, { status: 500 });
    }

    const body = await request.json();
    const { id, action } = body;

    if (!id || !action) {
      return NextResponse.json({ success: false, error: "Missing id or action" }, { status: 400 });
    }

    if (action === 'resubmit') {
      // Re-submit for review - reset status to pending_review
      const [updated] = await db
        .update(wrapupDrafts)
        .set({
          status: "pending_review",
          outcome: null,
          isAutoVoided: false,
          autoVoidReason: null,
          reviewerId: null,
          reviewedAt: null,
          completedAt: null,
          agencyzoomNoteId: null,
          noteAutoPosted: false,
          noteAutoPostedAt: null,
        })
        .where(and(
          eq(wrapupDrafts.id, id),
          eq(wrapupDrafts.tenantId, tenantId)
        ))
        .returning({ id: wrapupDrafts.id });

      if (!updated) {
        return NextResponse.json({ success: false, error: "Item not found" }, { status: 404 });
      }

      return NextResponse.json({ success: true, message: "Item re-submitted for review" });
    }

    return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("[Reviewed Items] POST Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to process action" },
      { status: 500 }
    );
  }
}

// =============================================================================
// DELETE - Clear auto-voided items or all completed items
// =============================================================================

export async function DELETE(request: NextRequest) {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ success: false, error: "Tenant not configured" }, { status: 500 });
    }

    const searchParams = request.nextUrl.searchParams;
    const filter = searchParams.get("filter"); // 'auto_voided', 'all'

    let conditions = and(
      eq(wrapupDrafts.tenantId, tenantId),
      eq(wrapupDrafts.status, "completed")
    );

    // Only clear auto-voided by default unless 'all' is specified
    if (filter === 'auto_voided' || !filter) {
      conditions = and(conditions, eq(wrapupDrafts.isAutoVoided, true));
    }

    // Get count before delete
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(wrapupDrafts)
      .where(conditions);

    const count = Number(countResult[0]?.count || 0);

    if (count === 0) {
      return NextResponse.json({
        success: true,
        message: "No items to clear",
        deleted: 0,
      });
    }

    // Delete the items
    await db
      .delete(wrapupDrafts)
      .where(conditions);

    console.log(`[Reviewed Items] Deleted ${count} ${filter === 'all' ? 'completed' : 'auto-voided'} items`);

    return NextResponse.json({
      success: true,
      message: `Cleared ${count} ${filter === 'all' ? 'completed' : 'auto-voided'} items`,
      deleted: count,
    });
  } catch (error) {
    console.error("[Reviewed Items] DELETE Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to clear items" },
      { status: 500 }
    );
  }
}
