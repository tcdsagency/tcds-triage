/**
 * API Route: /api/retry-queue/process
 * Process pending items in the retry queue
 * Should be called by a cron job or manually triggered
 */

import { NextRequest, NextResponse } from "next/server";
import { processRetryQueue, getRetryQueueStats } from "@/lib/api/retry-queue";

// POST - Process pending retry items
export async function POST(request: NextRequest) {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    // Optional: limit from query params
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get("limit") || "10");

    const result = await processRetryQueue(tenantId, limit);

    return NextResponse.json({
      success: true,
      ...result,
      message: `Processed ${result.processed} items: ${result.succeeded} succeeded, ${result.failed} failed`,
    });
  } catch (error) {
    console.error("[RetryQueue] Process error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Process failed" },
      { status: 500 }
    );
  }
}

// GET - Get queue statistics
export async function GET() {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    const stats = await getRetryQueueStats(tenantId);

    return NextResponse.json({
      success: true,
      stats,
      message: `Queue has ${stats.pending} pending, ${stats.processing} processing, ${stats.failed} failed items`,
    });
  } catch (error) {
    console.error("[RetryQueue] Stats error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Stats failed" },
      { status: 500 }
    );
  }
}
