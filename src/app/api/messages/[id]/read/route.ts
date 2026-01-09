// API Route: /api/messages/:id/read
// Acknowledge a single message

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { messages, users } from "@/db/schema";
import { eq, and } from "drizzle-orm";

// =============================================================================
// POST - Acknowledge Single Message
// =============================================================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID;
    const { id } = await params;

    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    if (!id) {
      return NextResponse.json({ error: "Message ID required" }, { status: 400 });
    }

    // Get user ID from request body if provided
    let userId: string | null = null;
    try {
      const body = await request.json();
      userId = body.userId || null;
    } catch {
      // No body provided, that's ok
    }

    // Update message with acknowledgement info
    const [updated] = await db
      .update(messages)
      .set({
        isAcknowledged: true,
        acknowledgedAt: new Date(),
        acknowledgedById: userId,
      })
      .where(and(eq(messages.id, id), eq(messages.tenantId, tenantId)))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }

    // Fetch user name if we have a userId
    let acknowledgedByName: string | null = null;
    if (userId) {
      const [user] = await db
        .select({ firstName: users.firstName, lastName: users.lastName })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (user) {
        acknowledgedByName = `${user.firstName} ${user.lastName}`.trim();
      }
    }

    return NextResponse.json({
      success: true,
      message: {
        ...updated,
        acknowledgedByName,
      },
    });
  } catch (error) {
    console.error("Acknowledge message error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Update failed" },
      { status: 500 }
    );
  }
}
