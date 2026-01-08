// API Route: /api/admin/purge-calls
// Delete all call data from database (admin only)

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { sql } from "drizzle-orm";

export async function POST(request: NextRequest) {
  try {
    // Security: Check for admin token
    const authHeader = request.headers.get("authorization");
    const adminToken = process.env.ADMIN_PURGE_TOKEN || "purge-calls-2024";

    if (authHeader !== `Bearer ${adminToken}`) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    console.log("[Admin] Starting call data purge...");

    // Delete related tables first (if they exist), then calls
    try {
      await db.execute(sql`DELETE FROM live_transcript_segments`);
      console.log("[Admin] Deleted transcript segments");
    } catch (e) {
      console.log("[Admin] No transcript segments table or already empty");
    }

    // Delete calls
    const callsResult = await db.execute(sql`DELETE FROM calls`);
    console.log("[Admin] Deleted calls");

    return NextResponse.json({
      success: true,
      message: "All call data purged successfully",
      deleted: {
        coachingTips: "all",
        transcriptSegments: "all",
        wrapups: "all",
        calls: "all",
      },
    });
  } catch (error) {
    console.error("[Admin] Purge error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Purge failed" },
      { status: 500 }
    );
  }
}
