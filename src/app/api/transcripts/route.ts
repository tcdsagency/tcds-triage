// =============================================================================
// API Route: /api/transcripts
// Transcript Search & Retrieval from MSSQL Database
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { getMSSQLTranscriptsClient } from "@/lib/api/mssql-transcripts";

// =============================================================================
// GET /api/transcripts - Search and list transcripts
// =============================================================================
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    // Parse search parameters
    const extension = searchParams.get("extension") || undefined;
    const callerNumber = searchParams.get("phone") || searchParams.get("callerNumber") || undefined;
    const direction = searchParams.get("direction") as "inbound" | "outbound" | undefined;
    const searchText = searchParams.get("q") || searchParams.get("search") || undefined;
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
    const offset = parseInt(searchParams.get("offset") || "0");

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
      // Return empty results if MSSQL not configured
      return NextResponse.json({
        success: true,
        configured: false,
        message: "MSSQL transcripts database not configured",
        records: [],
        total: 0,
      });
    }

    // Search transcripts
    const { records, total } = await client.searchTranscripts({
      extension,
      callerNumber,
      direction,
      searchText,
      startDate,
      endDate,
      limit,
      offset,
    });

    return NextResponse.json({
      success: true,
      configured: true,
      records,
      total,
      limit,
      offset,
      hasMore: offset + records.length < total,
    });
  } catch (error) {
    console.error("Transcripts search error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Search failed",
      },
      { status: 500 }
    );
  }
}
