// API Route: /api/messages/:id/read
// Acknowledge a single message

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { messages } from "@/db/schema";
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

    // Update message
    const [updated] = await db
      .update(messages)
      .set({
        isAcknowledged: true,
        acknowledgedAt: new Date(),
        // TODO: Set acknowledgedById from auth context
      })
      .where(and(eq(messages.id, id), eq(messages.tenantId, tenantId)))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: updated,
    });
  } catch (error) {
    console.error("Acknowledge message error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Update failed" },
      { status: 500 }
    );
  }
}
