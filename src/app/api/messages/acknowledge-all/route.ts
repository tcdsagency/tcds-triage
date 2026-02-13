// API Route: /api/messages/acknowledge-all
// Bulk acknowledge all unread messages

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { messages } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";

// =============================================================================
// POST - Acknowledge All Unread Messages
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID;

    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    // Optional: Get specific message IDs from body
    let messageIds: string[] | undefined;
    try {
      const body = await request.json();
      messageIds = body.messageIds;
    } catch {
      // No body provided, acknowledge all
    }

    let updatedCount: number;

    if (messageIds && messageIds.length > 0) {
      // Acknowledge specific messages
      const updated = await db
        .update(messages)
        .set({
          isAcknowledged: true,
          acknowledgedAt: new Date(),
        })
        .where(
          and(
            eq(messages.tenantId, tenantId),
            eq(messages.isAcknowledged, false),
            sql`${messages.id} = ANY(${messageIds})`
          )
        )
        .returning({ id: messages.id });

      updatedCount = updated.length;
    } else {
      // Acknowledge all unread incoming messages
      const updated = await db
        .update(messages)
        .set({
          isAcknowledged: true,
          acknowledgedAt: new Date(),
        })
        .where(
          and(
            eq(messages.tenantId, tenantId),
            eq(messages.isAcknowledged, false),
            eq(messages.direction, "inbound")
          )
        )
        .returning({ id: messages.id });

      updatedCount = updated.length;
    }

    return NextResponse.json({
      success: true,
      message: "All messages acknowledged",
      count: updatedCount,
    });
  } catch (error) {
    console.error("Bulk acknowledge error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Update failed" },
      { status: 500 }
    );
  }
}
