// API Route: /api/calls/active
// Returns the active call for a specific extension

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { calls, users } from "@/db/schema";
import { eq, and, or, desc } from "drizzle-orm";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const extension = searchParams.get("extension");

    if (!extension) {
      return NextResponse.json({ error: "Missing extension parameter" }, { status: 400 });
    }

    const tenantId = process.env.DEFAULT_TENANT_ID || "00000000-0000-0000-0000-000000000001";

    // Find the agent by extension
    const [agent] = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.tenantId, tenantId), eq(users.extension, extension)))
      .limit(1);

    if (!agent) {
      return NextResponse.json({ call: null, message: "Agent not found" });
    }

    // Find active call (ringing or in_progress) for this agent
    const [activeCall] = await db
      .select()
      .from(calls)
      .where(
        and(
          eq(calls.tenantId, tenantId),
          eq(calls.agentId, agent.id),
          or(
            eq(calls.status, "ringing"),
            eq(calls.status, "in_progress")
          )
        )
      )
      .orderBy(desc(calls.startedAt))
      .limit(1);

    return NextResponse.json({
      call: activeCall || null,
      extension,
      agentId: agent.id,
    });
  } catch (error) {
    console.error("[Calls/Active] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch active call" },
      { status: 500 }
    );
  }
}
