/**
 * Dismiss Item API for Triage Inbox
 * ==================================
 * Dismisses a wrapup item from the triage queue.
 *
 * POST /api/triage/[id]/dismiss
 * {
 *   reason: string,       // Reason for dismissal
 *   reviewerId?: string   // UUID of the reviewer
 * }
 *
 * Actions:
 * 1. Update wrapup_drafts: triage_decision='dismiss', status='completed'
 * 2. Record the dismissal reason
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { wrapupDrafts } from "@/db/schema";
import { eq, and } from "drizzle-orm";

// Common dismissal reasons
export const DISMISSAL_REASONS = {
  spam: "Spam / Telemarketing",
  wrong_number: "Wrong Number",
  hang_up: "Hang Up / No Conversation",
  already_resolved: "Already Resolved",
  duplicate: "Duplicate Entry",
  test_call: "Test Call",
  internal: "Internal Call",
  no_action_needed: "No Action Needed",
  other: "Other",
} as const;

interface DismissRequest {
  reason: string;
  reasonDetail?: string; // Additional context for "other" reason
  reviewerId?: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    const { id: itemId } = await params;
    const body: DismissRequest = await request.json();
    const { reason, reasonDetail, reviewerId } = body;

    if (!reason) {
      return NextResponse.json({ error: "reason is required" }, { status: 400 });
    }

    // Verify the wrapup draft exists
    const [wrapup] = await db
      .select({
        id: wrapupDrafts.id,
        status: wrapupDrafts.status,
      })
      .from(wrapupDrafts)
      .where(
        and(
          eq(wrapupDrafts.tenantId, tenantId),
          eq(wrapupDrafts.id, itemId)
        )
      )
      .limit(1);

    if (!wrapup) {
      return NextResponse.json({ error: "Wrapup draft not found" }, { status: 404 });
    }

    // Build the full reason string
    const fullReason = reasonDetail && reason === "other"
      ? `${reason}: ${reasonDetail}`
      : reason;

    // Update the wrapup draft
    // Ensure reviewerId is null if empty string (foreign key constraint)
    const validReviewerId = reviewerId && reviewerId.trim() ? reviewerId : null;

    await db
      .update(wrapupDrafts)
      .set({
        triageDecision: "dismiss",
        status: "completed",
        reviewerDecision: `dismissed: ${fullReason}`,
        reviewerId: validReviewerId,
        reviewedAt: new Date(),
        outcome: `Dismissed: ${fullReason}`,
      })
      .where(eq(wrapupDrafts.id, itemId));

    return NextResponse.json({
      success: true,
      message: "Item dismissed successfully",
      reason: fullReason,
    });
  } catch (error) {
    console.error("Dismiss item error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Dismiss failed" },
      { status: 500 }
    );
  }
}

// GET endpoint to return available dismissal reasons
export async function GET() {
  return NextResponse.json({
    success: true,
    reasons: Object.entries(DISMISSAL_REASONS).map(([key, label]) => ({
      key,
      label,
    })),
  });
}
