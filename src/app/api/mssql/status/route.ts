// =============================================================================
// MSSQL Status Endpoint - Health check for SQL Server connection
// =============================================================================

import { NextResponse } from "next/server";
import { getMSSQLTranscriptsClient } from "@/lib/api/mssql-transcripts";

export async function GET() {
  try {
    const client = await getMSSQLTranscriptsClient();

    if (!client) {
      return NextResponse.json({
        status: "error",
        connected: false,
        message: "MSSQL client not configured (missing tenant or credentials)",
      }, { status: 503 });
    }

    const health = await client.healthCheck();

    if (!health.connected) {
      return NextResponse.json({
        status: "error",
        connected: false,
        message: health.error || "Cannot connect to SQL Server",
        server: process.env.MSSQL_SERVER,
      }, { status: 503 });
    }

    // Get recent transcripts for verification
    const recent = await client.getRecentTranscripts(5);
    await client.close();

    return NextResponse.json({
      status: "ok",
      connected: true,
      server: process.env.MSSQL_SERVER,
      database: health.database,
      recordCount: health.recordCount,
      recentCount: recent.length,
      mostRecent: recent[0] ? {
        recordId: recent[0].id,
        extension: recent[0].extension,
        date: recent[0].recordingDate,
        hasTranscript: !!recent[0].transcript,
        duration: recent[0].duration,
      } : null,
    });
  } catch (error) {
    return NextResponse.json({
      status: "error",
      connected: false,
      message: error instanceof Error ? error.message : "Unknown error",
    }, { status: 500 });
  }
}
