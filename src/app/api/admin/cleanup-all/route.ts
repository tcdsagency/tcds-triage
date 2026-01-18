// API Route: /api/admin/cleanup-all
// Clear all stale call data - auto-voided items, pending reviews, and active calls

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { calls, wrapupDrafts, messages } from "@/db/schema";
import { eq, and, or, sql } from "drizzle-orm";

export async function POST(request: NextRequest) {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID || "00000000-0000-0000-0000-000000000001";

    const results = {
      activeCalls: 0,
      autoVoidedWrapups: 0,
      pendingWrapups: 0,
      pendingMessages: 0,
    };

    // 1. Mark all active calls as missed
    const activeCalls = await db
      .select({ id: calls.id })
      .from(calls)
      .where(
        and(
          eq(calls.tenantId, tenantId),
          or(
            eq(calls.status, "ringing"),
            eq(calls.status, "in_progress")
          )
        )
      );

    if (activeCalls.length > 0) {
      await db
        .update(calls)
        .set({ status: "missed", endedAt: new Date() })
        .where(
          and(
            eq(calls.tenantId, tenantId),
            or(
              eq(calls.status, "ringing"),
              eq(calls.status, "in_progress")
            )
          )
        );
      results.activeCalls = activeCalls.length;
    }

    // 2. Delete auto-voided wrapups
    const autoVoidedCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(wrapupDrafts)
      .where(and(
        eq(wrapupDrafts.tenantId, tenantId),
        eq(wrapupDrafts.status, "completed"),
        eq(wrapupDrafts.isAutoVoided, true)
      ));

    results.autoVoidedWrapups = Number(autoVoidedCount[0]?.count || 0);

    if (results.autoVoidedWrapups > 0) {
      await db
        .delete(wrapupDrafts)
        .where(and(
          eq(wrapupDrafts.tenantId, tenantId),
          eq(wrapupDrafts.status, "completed"),
          eq(wrapupDrafts.isAutoVoided, true)
        ));
    }

    // 3. Delete pending review wrapups
    const pendingWrapupCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(wrapupDrafts)
      .where(and(
        eq(wrapupDrafts.tenantId, tenantId),
        eq(wrapupDrafts.status, "pending_review")
      ));

    results.pendingWrapups = Number(pendingWrapupCount[0]?.count || 0);

    if (results.pendingWrapups > 0) {
      await db
        .delete(wrapupDrafts)
        .where(and(
          eq(wrapupDrafts.tenantId, tenantId),
          eq(wrapupDrafts.status, "pending_review")
        ));
    }

    // 4. Delete pending messages (unread inbound)
    const pendingMessageCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(messages)
      .where(and(
        eq(messages.tenantId, tenantId),
        eq(messages.direction, "inbound"),
        eq(messages.isAcknowledged, false)
      ));

    results.pendingMessages = Number(pendingMessageCount[0]?.count || 0);

    if (results.pendingMessages > 0) {
      await db
        .delete(messages)
        .where(and(
          eq(messages.tenantId, tenantId),
          eq(messages.direction, "inbound"),
          eq(messages.isAcknowledged, false)
        ));
    }

    const total = results.activeCalls + results.autoVoidedWrapups + results.pendingWrapups + results.pendingMessages;

    console.log(`[Cleanup All] Cleared: ${results.activeCalls} active calls, ${results.autoVoidedWrapups} auto-voided, ${results.pendingWrapups} pending wrapups, ${results.pendingMessages} pending messages`);

    return NextResponse.json({
      success: true,
      message: `Cleared ${total} items total`,
      deleted: results,
    });
  } catch (error) {
    console.error("[Cleanup All] Error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Cleanup failed" },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    success: true,
    message: "POST to this endpoint to clear all stale data",
    description: "Clears: active calls (marks missed), auto-voided wrapups, pending wrapups, pending messages",
  });
}
