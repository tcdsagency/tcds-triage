// =============================================================================
// MSSQL Transcripts Client - Post-Call Transcript Storage
// =============================================================================
// Connects to SQL Server database containing VoIPTools transcripts.
// Used for retrieving completed call transcripts after they've been processed.
// =============================================================================

import { db } from "@/db";
import { tenants } from "@/db/schema";
import { eq } from "drizzle-orm";

// =============================================================================
// Types
// =============================================================================

export interface MSSQLConfig {
  server: string;         // SQL Server host
  port: number;           // SQL Server port (default 1433)
  database: string;       // Database name (e.g., transcription_db)
  user: string;           // SQL user
  password: string;       // SQL password
  encrypt: boolean;       // Use TLS encryption
  trustServerCertificate: boolean;
}

export interface TranscriptRecord {
  id: string;
  callId: string;
  externalCallId?: string;  // 3CX call ID
  extension: string;
  agentName?: string;
  callerNumber: string;
  calledNumber: string;
  direction: "inbound" | "outbound";
  startTime: Date;
  endTime: Date;
  duration: number;         // seconds
  transcript: string;       // Full transcript text
  transcriptJson?: TranscriptSegment[];  // Parsed segments
  sentiment?: {
    overall: "positive" | "neutral" | "negative";
    score: number;
  };
  keywords?: string[];
  summary?: string;
  createdAt: Date;
  updatedAt?: Date;
}

export interface TranscriptSegment {
  speaker: "agent" | "customer" | "unknown";
  text: string;
  startTime: number;
  endTime: number;
  confidence?: number;
}

export interface TranscriptSearchParams {
  extension?: string;
  callerNumber?: string;
  startDate?: Date;
  endDate?: Date;
  direction?: "inbound" | "outbound";
  searchText?: string;
  limit?: number;
  offset?: number;
}

export interface TranscriptStats {
  totalCalls: number;
  totalDuration: number;
  avgDuration: number;
  inboundCalls: number;
  outboundCalls: number;
  avgSentiment?: number;
}

// =============================================================================
// MSSQL Transcripts Client
// =============================================================================

export class MSSQLTranscriptsClient {
  private config: MSSQLConfig;
  private tenantId: string;
  private pool: any = null;
  private mssql: any = null;

  constructor(tenantId: string, config: MSSQLConfig) {
    this.tenantId = tenantId;
    this.config = config;
  }

  // ---------------------------------------------------------------------------
  // Static Factory Method
  // ---------------------------------------------------------------------------

  static async fromTenant(tenantId: string): Promise<MSSQLTranscriptsClient | null> {
    const [tenant] = await db
      .select({ integrations: tenants.integrations })
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);

    const integrations = (tenant?.integrations as Record<string, any>) || {};
    const mssqlConfig = integrations.mssql || {};

    // Check database config first, then environment variables
    const server = mssqlConfig.server || process.env.MSSQL_SERVER;
    const port = parseInt(mssqlConfig.port || process.env.MSSQL_PORT || "1433");
    const database = mssqlConfig.database || process.env.MSSQL_DATABASE;
    const user = mssqlConfig.user || process.env.MSSQL_USER;
    const password = mssqlConfig.password || process.env.MSSQL_PASSWORD;

    if (!server || !database || !user || !password) {
      return null;
    }

    return new MSSQLTranscriptsClient(tenantId, {
      server,
      port,
      database,
      user,
      password,
      encrypt: mssqlConfig.encrypt ?? (process.env.MSSQL_ENCRYPT === "true"),
      trustServerCertificate: mssqlConfig.trustServerCertificate ??
        (process.env.MSSQL_TRUST_SERVER_CERTIFICATE === "true"),
    });
  }

  // ---------------------------------------------------------------------------
  // Connection Management
  // ---------------------------------------------------------------------------

  private async getPool(): Promise<any> {
    if (this.pool) return this.pool;

    try {
      // Dynamic import to avoid issues if mssql package not installed
      // Uses require to avoid TypeScript compilation issues
      try {
        this.mssql = require("mssql");
      } catch {
        throw new Error(
          "MSSQL package not installed. Run: npm install mssql"
        );
      }

      const config = {
        server: this.config.server,
        port: this.config.port,
        database: this.config.database,
        user: this.config.user,
        password: this.config.password,
        options: {
          encrypt: this.config.encrypt,
          trustServerCertificate: this.config.trustServerCertificate,
          enableArithAbort: true,
        },
        pool: {
          max: 10,
          min: 0,
          idleTimeoutMillis: 30000,
        },
      };

      this.pool = await this.mssql.connect(config);
      return this.pool;
    } catch (error) {
      console.error("MSSQL connection error:", error);
      throw new Error(
        error instanceof Error ? error.message : "Failed to connect to MSSQL database"
      );
    }
  }

  async close(): Promise<void> {
    if (this.pool) {
      await this.pool.close();
      this.pool = null;
    }
  }

  // ---------------------------------------------------------------------------
  // Transcript Retrieval
  // ---------------------------------------------------------------------------

  /**
   * Get transcript by call ID
   */
  async getTranscriptByCallId(callId: string): Promise<TranscriptRecord | null> {
    const pool = await this.getPool();

    const result = await pool.request()
      .input("callId", this.mssql.VarChar, callId)
      .query(`
        SELECT
          id, call_id, external_call_id, extension, agent_name,
          caller_number, called_number, direction,
          start_time, end_time, duration_seconds,
          transcript_text, transcript_json, sentiment, keywords, summary,
          created_at, updated_at
        FROM transcripts
        WHERE call_id = @callId OR external_call_id = @callId
      `);

    if (result.recordset.length === 0) return null;

    return this.mapRecordToTranscript(result.recordset[0]);
  }

  /**
   * Get transcript by database ID
   */
  async getTranscriptById(id: string): Promise<TranscriptRecord | null> {
    const pool = await this.getPool();

    const result = await pool.request()
      .input("id", this.mssql.VarChar, id)
      .query(`
        SELECT
          id, call_id, external_call_id, extension, agent_name,
          caller_number, called_number, direction,
          start_time, end_time, duration_seconds,
          transcript_text, transcript_json, sentiment, keywords, summary,
          created_at, updated_at
        FROM transcripts
        WHERE id = @id
      `);

    if (result.recordset.length === 0) return null;

    return this.mapRecordToTranscript(result.recordset[0]);
  }

  /**
   * Search transcripts with various filters
   */
  async searchTranscripts(params: TranscriptSearchParams): Promise<{
    records: TranscriptRecord[];
    total: number;
  }> {
    const pool = await this.getPool();
    const request = pool.request();

    let whereConditions: string[] = ["1=1"];
    let countWhere: string[] = ["1=1"];

    if (params.extension) {
      request.input("extension", this.mssql.VarChar, params.extension);
      whereConditions.push("extension = @extension");
      countWhere.push("extension = @extension");
    }

    if (params.callerNumber) {
      request.input("callerNumber", this.mssql.VarChar, `%${params.callerNumber}%`);
      whereConditions.push("(caller_number LIKE @callerNumber OR called_number LIKE @callerNumber)");
      countWhere.push("(caller_number LIKE @callerNumber OR called_number LIKE @callerNumber)");
    }

    if (params.startDate) {
      request.input("startDate", this.mssql.DateTime, params.startDate);
      whereConditions.push("start_time >= @startDate");
      countWhere.push("start_time >= @startDate");
    }

    if (params.endDate) {
      request.input("endDate", this.mssql.DateTime, params.endDate);
      whereConditions.push("start_time <= @endDate");
      countWhere.push("start_time <= @endDate");
    }

    if (params.direction) {
      request.input("direction", this.mssql.VarChar, params.direction);
      whereConditions.push("direction = @direction");
      countWhere.push("direction = @direction");
    }

    if (params.searchText) {
      request.input("searchText", this.mssql.VarChar, `%${params.searchText}%`);
      whereConditions.push("transcript_text LIKE @searchText");
      countWhere.push("transcript_text LIKE @searchText");
    }

    const limit = params.limit || 50;
    const offset = params.offset || 0;

    // Get total count
    const countResult = await request.query(`
      SELECT COUNT(*) as total FROM transcripts WHERE ${countWhere.join(" AND ")}
    `);
    const total = countResult.recordset[0].total;

    // Get paginated results
    const result = await pool.request()
      .input("extension", this.mssql.VarChar, params.extension)
      .input("callerNumber", this.mssql.VarChar, params.callerNumber ? `%${params.callerNumber}%` : null)
      .input("startDate", this.mssql.DateTime, params.startDate)
      .input("endDate", this.mssql.DateTime, params.endDate)
      .input("direction", this.mssql.VarChar, params.direction)
      .input("searchText", this.mssql.VarChar, params.searchText ? `%${params.searchText}%` : null)
      .input("offset", this.mssql.Int, offset)
      .input("limit", this.mssql.Int, limit)
      .query(`
        SELECT
          id, call_id, external_call_id, extension, agent_name,
          caller_number, called_number, direction,
          start_time, end_time, duration_seconds,
          transcript_text, transcript_json, sentiment, keywords, summary,
          created_at, updated_at
        FROM transcripts
        WHERE ${whereConditions.join(" AND ")}
        ORDER BY start_time DESC
        OFFSET @offset ROWS
        FETCH NEXT @limit ROWS ONLY
      `);

    return {
      records: result.recordset.map(this.mapRecordToTranscript),
      total,
    };
  }

  /**
   * Get transcripts for an extension within a date range
   */
  async getTranscriptsByExtension(
    extension: string,
    startDate?: Date,
    endDate?: Date,
    limit: number = 100
  ): Promise<TranscriptRecord[]> {
    const result = await this.searchTranscripts({
      extension,
      startDate,
      endDate,
      limit,
    });
    return result.records;
  }

  /**
   * Get most recent transcripts
   */
  async getRecentTranscripts(limit: number = 20): Promise<TranscriptRecord[]> {
    const pool = await this.getPool();

    const result = await pool.request()
      .input("limit", this.mssql.Int, limit)
      .query(`
        SELECT TOP (@limit)
          id, call_id, external_call_id, extension, agent_name,
          caller_number, called_number, direction,
          start_time, end_time, duration_seconds,
          transcript_text, transcript_json, sentiment, keywords, summary,
          created_at, updated_at
        FROM transcripts
        ORDER BY start_time DESC
      `);

    return result.recordset.map(this.mapRecordToTranscript);
  }

  // ---------------------------------------------------------------------------
  // Statistics
  // ---------------------------------------------------------------------------

  /**
   * Get transcript statistics for a date range
   */
  async getStats(startDate?: Date, endDate?: Date): Promise<TranscriptStats> {
    const pool = await this.getPool();
    const request = pool.request();

    let whereConditions = ["1=1"];

    if (startDate) {
      request.input("startDate", this.mssql.DateTime, startDate);
      whereConditions.push("start_time >= @startDate");
    }

    if (endDate) {
      request.input("endDate", this.mssql.DateTime, endDate);
      whereConditions.push("start_time <= @endDate");
    }

    const result = await request.query(`
      SELECT
        COUNT(*) as total_calls,
        SUM(duration_seconds) as total_duration,
        AVG(duration_seconds) as avg_duration,
        SUM(CASE WHEN direction = 'inbound' THEN 1 ELSE 0 END) as inbound_calls,
        SUM(CASE WHEN direction = 'outbound' THEN 1 ELSE 0 END) as outbound_calls,
        AVG(CASE WHEN sentiment IS NOT NULL THEN JSON_VALUE(sentiment, '$.score') ELSE NULL END) as avg_sentiment
      FROM transcripts
      WHERE ${whereConditions.join(" AND ")}
    `);

    const row = result.recordset[0];
    return {
      totalCalls: row.total_calls || 0,
      totalDuration: row.total_duration || 0,
      avgDuration: Math.round(row.avg_duration || 0),
      inboundCalls: row.inbound_calls || 0,
      outboundCalls: row.outbound_calls || 0,
      avgSentiment: row.avg_sentiment,
    };
  }

  // ---------------------------------------------------------------------------
  // Write Operations (if needed)
  // ---------------------------------------------------------------------------

  /**
   * Save a transcript to the database
   * Used when VM Bridge processes are complete
   */
  async saveTranscript(transcript: Omit<TranscriptRecord, "id" | "createdAt">): Promise<string> {
    const pool = await this.getPool();

    const result = await pool.request()
      .input("callId", this.mssql.VarChar, transcript.callId)
      .input("externalCallId", this.mssql.VarChar, transcript.externalCallId)
      .input("extension", this.mssql.VarChar, transcript.extension)
      .input("agentName", this.mssql.VarChar, transcript.agentName)
      .input("callerNumber", this.mssql.VarChar, transcript.callerNumber)
      .input("calledNumber", this.mssql.VarChar, transcript.calledNumber)
      .input("direction", this.mssql.VarChar, transcript.direction)
      .input("startTime", this.mssql.DateTime, transcript.startTime)
      .input("endTime", this.mssql.DateTime, transcript.endTime)
      .input("duration", this.mssql.Int, transcript.duration)
      .input("transcript", this.mssql.NVarChar, transcript.transcript)
      .input("transcriptJson", this.mssql.NVarChar,
        transcript.transcriptJson ? JSON.stringify(transcript.transcriptJson) : null)
      .input("sentiment", this.mssql.NVarChar,
        transcript.sentiment ? JSON.stringify(transcript.sentiment) : null)
      .input("keywords", this.mssql.NVarChar,
        transcript.keywords ? JSON.stringify(transcript.keywords) : null)
      .input("summary", this.mssql.NVarChar, transcript.summary)
      .query(`
        INSERT INTO transcripts (
          call_id, external_call_id, extension, agent_name,
          caller_number, called_number, direction,
          start_time, end_time, duration_seconds,
          transcript_text, transcript_json, sentiment, keywords, summary,
          created_at
        )
        OUTPUT INSERTED.id
        VALUES (
          @callId, @externalCallId, @extension, @agentName,
          @callerNumber, @calledNumber, @direction,
          @startTime, @endTime, @duration,
          @transcript, @transcriptJson, @sentiment, @keywords, @summary,
          GETDATE()
        )
      `);

    return result.recordset[0].id;
  }

  // ---------------------------------------------------------------------------
  // Health & Status
  // ---------------------------------------------------------------------------

  /**
   * Check if MSSQL is reachable
   */
  async healthCheck(): Promise<{
    connected: boolean;
    database?: string;
    recordCount?: number;
    error?: string;
  }> {
    try {
      const pool = await this.getPool();

      const result = await pool.request().query(`
        SELECT DB_NAME() as db_name, COUNT(*) as record_count FROM transcripts
      `);

      return {
        connected: true,
        database: result.recordset[0].db_name,
        recordCount: result.recordset[0].record_count,
      };
    } catch (error) {
      return {
        connected: false,
        error: error instanceof Error ? error.message : "Connection failed",
      };
    }
  }

  // ---------------------------------------------------------------------------
  // Private Helpers
  // ---------------------------------------------------------------------------

  private mapRecordToTranscript(row: any): TranscriptRecord {
    return {
      id: row.id,
      callId: row.call_id,
      externalCallId: row.external_call_id,
      extension: row.extension,
      agentName: row.agent_name,
      callerNumber: row.caller_number,
      calledNumber: row.called_number,
      direction: row.direction,
      startTime: new Date(row.start_time),
      endTime: new Date(row.end_time),
      duration: row.duration_seconds,
      transcript: row.transcript_text,
      transcriptJson: row.transcript_json ? JSON.parse(row.transcript_json) : undefined,
      sentiment: row.sentiment ? JSON.parse(row.sentiment) : undefined,
      keywords: row.keywords ? JSON.parse(row.keywords) : undefined,
      summary: row.summary,
      createdAt: new Date(row.created_at),
      updatedAt: row.updated_at ? new Date(row.updated_at) : undefined,
    };
  }

  // ---------------------------------------------------------------------------
  // Configuration Access
  // ---------------------------------------------------------------------------

  getServer(): string {
    return this.config.server;
  }

  getDatabase(): string {
    return this.config.database;
  }

  isConfigured(): boolean {
    return !!(
      this.config.server &&
      this.config.database &&
      this.config.user &&
      this.config.password
    );
  }
}

// =============================================================================
// Utility: Get client for current tenant
// =============================================================================

export async function getMSSQLTranscriptsClient(): Promise<MSSQLTranscriptsClient | null> {
  const tenantId = process.env.DEFAULT_TENANT_ID;
  if (!tenantId) return null;
  return MSSQLTranscriptsClient.fromTenant(tenantId);
}
