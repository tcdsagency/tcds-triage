// API Route: /api/calls/cleanup
// Clean up stale calls that don't have endedAt

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { calls } from "@/db/schema";
import { isNull, lt, and, eq } from "drizzle-orm";

export async function POST(request: NextRequest) {
  try {
    // Verify admin key for security
    const authHeader = request.headers.get("Authorization");
    const expectedKey = process.env.WEBHOOK_API_KEY || "tcds_vm_bridge_secret_2025";

    if (authHeader !== `Bearer ${expectedKey}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if a specific call ID was provided
    const body = await request.json().catch(() => ({}));
    if (body.callId) {
      // End a specific call
      await db
        .update(calls)
        .set({
          status: "completed",
          endedAt: new Date()
        })
        .where(eq(calls.id, body.callId));

      return NextResponse.json({
        success: true,
        message: `Ended call ${body.callId}`,
        cleaned: 1
      });
    }

    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);

    // Find stale calls (no endedAt, started more than 30 minutes ago)
    const staleCalls = await db
      .select({
        id: calls.id,
        startedAt: calls.startedAt,
        status: calls.status,
        fromNumber: calls.fromNumber,
        toNumber: calls.toNumber
      })
      .from(calls)
      .where(
        and(
          isNull(calls.endedAt),
          lt(calls.startedAt, thirtyMinutesAgo)
        )
      );

    if (staleCalls.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No stale calls found",
        cleaned: 0
      });
    }

    // Update them to completed with endedAt = now
    await db
      .update(calls)
      .set({
        status: "completed",
        endedAt: new Date()
      })
      .where(
        and(
          isNull(calls.endedAt),
          lt(calls.startedAt, thirtyMinutesAgo)
        )
      );

    return NextResponse.json({
      success: true,
      message: `Cleaned up ${staleCalls.length} stale calls`,
      cleaned: staleCalls.length,
      calls: staleCalls.map(c => ({
        id: c.id,
        status: c.status,
        from: c.fromNumber,
        to: c.toNumber,
        startedAt: c.startedAt
      }))
    });
  } catch (error) {
    console.error("[Cleanup] Error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to cleanup" },
      { status: 500 }
    );
  }
}
