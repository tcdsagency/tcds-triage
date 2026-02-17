/**
 * API Route: /api/ai/assistant/sessions
 * List and create assistant chat sessions
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { assistantSessions } from "@/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";

export async function GET(request: NextRequest) {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    const userId = request.headers.get("x-user-id") || "default";

    const sessions = await db
      .select({
        id: assistantSessions.id,
        title: assistantSessions.title,
        mode: assistantSessions.mode,
        createdAt: assistantSessions.createdAt,
        updatedAt: assistantSessions.updatedAt,
        messageCount: sql<number>`(
          SELECT COUNT(*)::int FROM assistant_messages
          WHERE session_id = "assistant_sessions"."id"
        )`,
      })
      .from(assistantSessions)
      .where(
        and(
          eq(assistantSessions.tenantId, tenantId),
          eq(assistantSessions.userId, userId)
        )
      )
      .orderBy(desc(assistantSessions.updatedAt))
      .limit(50);

    return NextResponse.json({ success: true, sessions });
  } catch (error) {
    console.error("[Assistant Sessions] GET error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to list sessions" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    const userId = request.headers.get("x-user-id") || "default";
    const body = await request.json();
    const { title, mode = "general" } = body;

    const [session] = await db
      .insert(assistantSessions)
      .values({
        tenantId,
        userId,
        title: title || "New Chat",
        mode,
      })
      .returning();

    return NextResponse.json({ success: true, session });
  } catch (error) {
    console.error("[Assistant Sessions] POST error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create session" },
      { status: 500 }
    );
  }
}
