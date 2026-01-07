// =============================================================================
// API Route: /api/transcripts/[callId]
// Get Single Transcript by Call ID
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { getMSSQLTranscriptsClient } from "@/lib/api/mssql-transcripts";

// =============================================================================
// GET /api/transcripts/[callId] - Get transcript by call ID
// =============================================================================
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ callId: string }> }
) {
  try {
    const { callId } = await params;

    if (!callId) {
      return NextResponse.json(
        { success: false, error: "Call ID required" },
        { status: 400 }
      );
    }

    // Get MSSQL client
    const client = await getMSSQLTranscriptsClient();

    if (!client) {
      return NextResponse.json({
        success: false,
        configured: false,
        error: "MSSQL transcripts database not configured",
      });
    }

    // Get transcript
    const transcript = await client.getTranscriptByCallId(callId);

    if (!transcript) {
      return NextResponse.json(
        { success: false, error: "Transcript not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      transcript,
    });
  } catch (error) {
    console.error("Transcript fetch error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Fetch failed",
      },
      { status: 500 }
    );
  }
}
