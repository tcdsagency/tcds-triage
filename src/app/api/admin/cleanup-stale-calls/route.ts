// API Route: /api/admin/cleanup-stale-calls
// Marks stale calls (ringing/in_progress for >30 minutes) as missed

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { calls } from "@/db/schema";
import { eq, and, or, lt } from "drizzle-orm";
import { sql } from "drizzle-orm";

export async function POST(request: NextRequest) {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID || "00000000-0000-0000-0000-000000000001";

    // Find calls that are ringing or in_progress for more than 30 minutes
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);

    // Get count first
    const staleCalls = await db
      .select({ id: calls.id, status: calls.status, startedAt: calls.startedAt })
      .from(calls)
      .where(
        and(
          eq(calls.tenantId, tenantId),
          or(
            eq(calls.status, "ringing"),
            eq(calls.status, "in_progress")
          ),
          lt(calls.startedAt, thirtyMinutesAgo)
        )
      );

    console.log(`[Cleanup] Found ${staleCalls.length} stale calls`);

    if (staleCalls.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No stale calls found",
        cleaned: 0,
      });
    }

    // Update all stale calls to "missed" status
    const result = await db
      .update(calls)
      .set({
        status: "missed",
        endedAt: new Date(),
      })
      .where(
        and(
          eq(calls.tenantId, tenantId),
          or(
            eq(calls.status, "ringing"),
            eq(calls.status, "in_progress")
          ),
          lt(calls.startedAt, thirtyMinutesAgo)
        )
      );

    console.log(`[Cleanup] Marked ${staleCalls.length} calls as missed`);

    return NextResponse.json({
      success: true,
      message: `Cleaned up ${staleCalls.length} stale calls`,
      cleaned: staleCalls.length,
      calls: staleCalls.map(c => ({
        id: c.id,
        previousStatus: c.status,
        startedAt: c.startedAt,
      })),
    });
  } catch (error) {
    console.error("[Cleanup] Error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Cleanup failed" },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    success: true,
    message: "POST to this endpoint to clean up stale calls",
    description: "Marks calls that are ringing/in_progress for >30 minutes as missed",
  });
}
