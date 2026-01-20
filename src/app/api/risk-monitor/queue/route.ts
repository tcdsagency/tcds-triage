// API Route: /api/risk-monitor/queue
// Queue a risk monitor job to be processed by Railway workers

import { NextRequest, NextResponse } from "next/server";
import { queueRiskMonitorCheck } from "@/lib/queues/client";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { type = "full-scan", propertyIds } = body;

    const job = await queueRiskMonitorCheck({
      type: type as "full-scan" | "single-property" | "batch",
      propertyIds,
    });

    return NextResponse.json({
      success: true,
      jobId: job.id,
      message: `Risk monitor job queued: ${type}`,
    });
  } catch (error) {
    console.error("[Risk Monitor Queue] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to queue job",
      },
      { status: 500 }
    );
  }
}
