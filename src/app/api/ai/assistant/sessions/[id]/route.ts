/**
 * API Route: /api/ai/assistant/sessions/[id]
 * Get session with messages, update session title
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { assistantSessions, assistantMessages } from "@/db/schema";
import { eq, and, asc } from "drizzle-orm";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    const userId = request.headers.get("x-user-id") || "default";

    const [session] = await db
      .select()
      .from(assistantSessions)
      .where(
        and(
          eq(assistantSessions.id, id),
          eq(assistantSessions.tenantId, tenantId),
          eq(assistantSessions.userId, userId)
        )
      )
      .limit(1);

    if (!session) {
      return NextResponse.json(
        { success: false, error: "Session not found" },
        { status: 404 }
      );
    }

    const messages = await db
      .select()
      .from(assistantMessages)
      .where(eq(assistantMessages.sessionId, id))
      .orderBy(asc(assistantMessages.createdAt));

    return NextResponse.json({ success: true, session, messages });
  } catch (error) {
    console.error("[Assistant Session] GET error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch session" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    const userId = request.headers.get("x-user-id") || "default";
    const body = await request.json();
    const { title } = body;

    const [updated] = await db
      .update(assistantSessions)
      .set({ title, updatedAt: new Date() })
      .where(
        and(
          eq(assistantSessions.id, id),
          eq(assistantSessions.tenantId, tenantId),
          eq(assistantSessions.userId, userId)
        )
      )
      .returning();

    if (!updated) {
      return NextResponse.json(
        { success: false, error: "Session not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, session: updated });
  } catch (error) {
    console.error("[Assistant Session] PATCH error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update session" },
      { status: 500 }
    );
  }
}
