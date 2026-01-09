// API Route: /api/messages
// Get messages - supports filtering by unread, recent

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { messages } from "@/db/schema";
import { eq, and, desc, gte, sql, or, isNull } from "drizzle-orm";

// =============================================================================
// GET - Fetch Messages
// =============================================================================

export async function GET(request: NextRequest) {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID;

    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    const searchParams = request.nextUrl.searchParams;
    const filter = searchParams.get("filter"); // 'unread', 'all', 'incoming', 'outgoing'
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    // Build query conditions
    // Exclude after-hours messages - they belong in Pending Review, not SMS conversations
    const conditions = [
      eq(messages.tenantId, tenantId),
      or(eq(messages.isAfterHours, false), isNull(messages.isAfterHours)),
    ];

    if (filter === "unread") {
      conditions.push(eq(messages.isAcknowledged, false));
      conditions.push(eq(messages.direction, "inbound"));
    } else if (filter === "incoming") {
      conditions.push(eq(messages.direction, "inbound"));
    } else if (filter === "outgoing") {
      conditions.push(eq(messages.direction, "outbound"));
    }

    // Query messages
    const messageList = await db
      .select({
        id: messages.id,
        type: messages.type,
        direction: messages.direction,
        fromNumber: messages.fromNumber,
        toNumber: messages.toNumber,
        body: messages.body,
        mediaUrls: messages.mediaUrls,
        externalId: messages.externalId,
        status: messages.status,
        contactId: messages.contactId,
        contactName: messages.contactName,
        contactType: messages.contactType,
        isAcknowledged: messages.isAcknowledged,
        acknowledgedAt: messages.acknowledgedAt,
        isAfterHours: messages.isAfterHours,
        sentAt: messages.sentAt,
        createdAt: messages.createdAt,
      })
      .from(messages)
      .where(and(...conditions))
      .orderBy(desc(messages.createdAt))
      .limit(limit)
      .offset(offset);

    // Get unread count (excluding after-hours messages which are in Pending Review)
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(messages)
      .where(
        and(
          eq(messages.tenantId, tenantId),
          eq(messages.isAcknowledged, false),
          eq(messages.direction, "inbound"),
          or(eq(messages.isAfterHours, false), isNull(messages.isAfterHours))
        )
      );

    return NextResponse.json({
      success: true,
      messages: messageList,
      unreadCount: count,
      total: messageList.length,
    });
  } catch (error) {
    console.error("Messages fetch error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Fetch failed" },
      { status: 500 }
    );
  }
}
