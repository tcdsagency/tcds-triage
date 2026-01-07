// =============================================================================
// API Route: /api/transcripts/stats
// Transcript Statistics
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { getMSSQLTranscriptsClient } from "@/lib/api/mssql-transcripts";

// =============================================================================
// GET /api/transcripts/stats - Get transcript statistics
// =============================================================================
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    // Parse date range
    const startDate = searchParams.get("startDate")
      ? new Date(searchParams.get("startDate")!)
      : undefined;
    const endDate = searchParams.get("endDate")
      ? new Date(searchParams.get("endDate")!)
      : undefined;

    // Get MSSQL client
    const client = await getMSSQLTranscriptsClient();

    if (!client) {
      return NextResponse.json({
        success: true,
        configured: false,
        message: "MSSQL transcripts database not configured",
        stats: {
          totalCalls: 0,
          totalDuration: 0,
          avgDuration: 0,
          inboundCalls: 0,
          outboundCalls: 0,
        },
      });
    }

    // Get stats
    const stats = await client.getStats(startDate, endDate);

    return NextResponse.json({
      success: true,
      configured: true,
      stats,
    });
  } catch (error) {
    console.error("Transcripts stats error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Stats fetch failed",
      },
      { status: 500 }
    );
  }
}
