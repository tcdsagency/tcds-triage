// =============================================================================
// MSSQL Transcripts Client - VoIPTools 3CX Recording Manager
// =============================================================================
// Connects to SQL Server database containing VoIPTools call recordings/transcripts.
// Table: dbo.Recordings
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
  database: string;       // Database name (e.g., 3CX Recording Manager)
  user: string;           // SQL user
  password: string;       // SQL password
  encrypt: boolean;       // Use TLS encryption
  trustServerCertificate: boolean;
}

// VoIPTools Recording record from dbo.Recordings table
export interface TranscriptRecord {
  id: string;                 // RecordId
  extension: string;          // Ext - agent extension
  callerName?: string;        // CallerName - caller ID name
  callerNumber: string;       // CallerExt - number that initiated call
  calledNumber: string;       // DialedNum - number that was dialed
  direction: "inbound" | "outbound";  // Derived from CallerExt/DialedNum
  recordingDate: Date;        // RecordingDate
  duration: string;           // Duration (format: "00:05:32")
  durationSeconds: number;    // Computed from duration
  transcript: string;         // Transcription text
  score?: number;             // Score (sentiment/quality)
  fileName?: string;          // FileName
  archive?: string;           // Archive path
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
  avgScore?: number;
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
    const port = parseInt(mssqlConfig.port || process.env.MSSQL_PORT || "1433", 10);
    const database = mssqlConfig.database || process.env.MSSQL_DATABASE;
    const user = mssqlConfig.user || process.env.MSSQL_USER;
    const password = mssqlConfig.password || process.env.MSSQL_PASSWORD;
    const encrypt = (mssqlConfig.encrypt || process.env.MSSQL_ENCRYPT) === "true";
    const trustServerCertificate =
      (mssqlConfig.trustServerCertificate || process.env.MSSQL_TRUST_SERVER_CERTIFICATE) !== "false";

    if (!server || !database || !user || !password) {
      return null;
    }

    return new MSSQLTranscriptsClient(tenantId, {
      server,
      port,
      database,
      user,
      password,
      encrypt,
      trustServerCertificate,
    });
  }

  // ---------------------------------------------------------------------------
  // Connection Management
  // ---------------------------------------------------------------------------

  private async getPool() {
    if (this.pool) return this.pool;

    // Dynamic import to avoid issues if mssql not installed
    try {
      this.mssql = require("mssql");
    } catch {
      throw new Error(
        "MSSQL package not installed. Run: npm install mssql"
      );
    }

    const poolConfig = {
      server: this.config.server,
      port: this.config.port,
      database: this.config.database,
      user: this.config.user,
      password: this.config.password,
      options: {
        encrypt: this.config.encrypt,
        trustServerCertificate: this.config.trustServerCertificate,
      },
      pool: {
        max: 5,
        min: 0,
        idleTimeoutMillis: 30000,
      },
      connectionTimeout: 15000,
      requestTimeout: 15000,
    };

    try {
      this.pool = await this.mssql.connect(poolConfig);
      return this.pool;
    } catch (error) {
      console.error("MSSQL connection error:", error);
      throw new Error(
        error instanceof Error ? error.message : "Failed to connect to MSSQL database"
      );
    }
  }

  async close() {
    if (this.pool) {
      await this.pool.close();
      this.pool = null;
    }
  }

  // ---------------------------------------------------------------------------
  // Direction Detection (from VoIPTools schema)
  // ---------------------------------------------------------------------------

  private determineDirection(callerExt: string, dialedNum: string, agentExt: string): "inbound" | "outbound" {
    // Rule 1: CallerExt is external (10+ digits) → INBOUND
    if (callerExt && callerExt.replace(/\D/g, "").length >= 10) {
      return "inbound";
    }

    // Rule 2: CallerExt matches agent → OUTBOUND
    if (callerExt === agentExt) {
      return "outbound";
    }

    // Rule 3: DialedNum matches agent → INBOUND
    if (dialedNum === agentExt) {
      return "inbound";
    }

    // Rule 4: Short caller + long dialed → OUTBOUND
    if (callerExt && callerExt.length <= 4 && dialedNum && dialedNum.replace(/\D/g, "").length >= 10) {
      return "outbound";
    }

    // Default: INBOUND
    return "inbound";
  }

  private parseDuration(duration: string): number {
    // Parse "HH:MM:SS" format to seconds
    if (!duration) return 0;
    const parts = duration.split(":").map(Number);
    if (parts.length === 3) {
      return parts[0] * 3600 + parts[1] * 60 + parts[2];
    }
    if (parts.length === 2) {
      return parts[0] * 60 + parts[1];
    }
    return parseInt(duration, 10) || 0;
  }

  // ---------------------------------------------------------------------------
  // Record Mapping
  // ---------------------------------------------------------------------------

  private mapRecordToTranscript(record: any): TranscriptRecord {
    const direction = this.determineDirection(
      record.CallerExt || "",
      record.DialedNum || "",
      record.Ext || ""
    );

    return {
      id: String(record.RecordId),
      extension: record.Ext || "",
      callerName: record.CallerName || undefined,
      callerNumber: record.CallerExt || "",
      calledNumber: record.DialedNum || "",
      direction,
      recordingDate: record.RecordingDate ? new Date(record.RecordingDate) : new Date(),
      duration: record.Duration || "00:00:00",
      durationSeconds: this.parseDuration(record.Duration),
      transcript: record.Transcription || "",
      score: record.Score ? Number(record.Score) : undefined,
      fileName: record.FileName || undefined,
      archive: record.Archive || undefined,
    };
  }

  // ---------------------------------------------------------------------------
  // Transcript Retrieval
  // ---------------------------------------------------------------------------

  /**
   * Get transcript by Record ID
   */
  async getTranscriptById(id: string): Promise<TranscriptRecord | null> {
    const pool = await this.getPool();

    const result = await pool.request()
      .input("id", this.mssql.Int, parseInt(id, 10))
      .query(`
        SELECT RecordId, Ext, CallerName, CallerExt, DialedNum,
               RecordingDate, Duration, Transcription, Score, FileName, Archive
        FROM Recordings
        WHERE RecordId = @id
      `);

    if (result.recordset.length === 0) return null;

    return this.mapRecordToTranscript(result.recordset[0]);
  }

  /**
   * Find transcript by phone number, extension, and time window
   */
  async findTranscript(params: {
    callerNumber?: string;
    agentExtension?: string;
    startTime?: Date;
    endTime?: Date;
  }): Promise<TranscriptRecord | null> {
    const pool = await this.getPool();
    const request = pool.request();

    const whereConditions: string[] = ["Transcription IS NOT NULL"];

    if (params.callerNumber) {
      const phone = params.callerNumber.replace(/\D/g, "");
      request.input("phone", this.mssql.VarChar, `%${phone.slice(-10)}%`);
      whereConditions.push("(CallerExt LIKE @phone OR DialedNum LIKE @phone)");
    }

    if (params.agentExtension) {
      request.input("ext", this.mssql.VarChar, params.agentExtension);
      whereConditions.push("Ext = @ext");
    }

    if (params.startTime) {
      // Add 5 minute buffer before
      const bufferedStart = new Date(params.startTime.getTime() - 5 * 60 * 1000);
      request.input("startTime", this.mssql.DateTime, bufferedStart);
      whereConditions.push("RecordingDate >= @startTime");
    }

    if (params.endTime) {
      // Add 5 minute buffer after
      const bufferedEnd = new Date(params.endTime.getTime() + 5 * 60 * 1000);
      request.input("endTime", this.mssql.DateTime, bufferedEnd);
      whereConditions.push("RecordingDate <= @endTime");
    }

    const result = await request.query(`
      SELECT TOP 1 RecordId, Ext, CallerName, CallerExt, DialedNum,
             RecordingDate, Duration, Transcription, Score, FileName, Archive
      FROM Recordings
      WHERE ${whereConditions.join(" AND ")}
      ORDER BY RecordingDate DESC
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

    const whereConditions: string[] = ["Transcription IS NOT NULL"];

    // Build WHERE conditions
    if (params.extension) {
      whereConditions.push(`Ext = '${params.extension.replace(/'/g, "''")}'`);
    }

    if (params.callerNumber) {
      const phone = params.callerNumber.replace(/\D/g, "");
      whereConditions.push(`(CallerExt LIKE '%${phone}%' OR DialedNum LIKE '%${phone}%')`);
    }

    if (params.startDate) {
      whereConditions.push(`RecordingDate >= '${params.startDate.toISOString()}'`);
    }

    if (params.endDate) {
      whereConditions.push(`RecordingDate <= '${params.endDate.toISOString()}'`);
    }

    if (params.searchText) {
      whereConditions.push(`Transcription LIKE '%${params.searchText.replace(/'/g, "''")}%'`);
    }

    const whereClause = whereConditions.join(" AND ");
    const limit = params.limit || 50;
    const offset = params.offset || 0;

    // Get total count
    const countResult = await pool.request().query(`
      SELECT COUNT(*) as total FROM Recordings WHERE ${whereClause}
    `);
    const total = countResult.recordset[0].total;

    // Get paginated results
    const result = await pool.request().query(`
      SELECT RecordId, Ext, CallerName, CallerExt, DialedNum,
             RecordingDate, Duration, Transcription, Score, FileName, Archive
      FROM Recordings
      WHERE ${whereClause}
      ORDER BY RecordingDate DESC
      OFFSET ${offset} ROWS
      FETCH NEXT ${limit} ROWS ONLY
    `);

    // Filter by direction after fetching (since it's computed)
    let records = result.recordset.map((r: any) => this.mapRecordToTranscript(r));

    if (params.direction) {
      records = records.filter((r: TranscriptRecord) => r.direction === params.direction);
    }

    return { records, total };
  }

  /**
   * Get most recent transcripts
   */
  async getRecentTranscripts(limit: number = 20): Promise<TranscriptRecord[]> {
    const pool = await this.getPool();

    const result = await pool.request().query(`
      SELECT TOP ${limit} RecordId, Ext, CallerName, CallerExt, DialedNum,
             RecordingDate, Duration, Transcription, Score, FileName, Archive
      FROM Recordings
      WHERE Transcription IS NOT NULL
      ORDER BY RecordingDate DESC
    `);

    return result.recordset.map((r: any) => this.mapRecordToTranscript(r));
  }

  /**
   * Get transcripts for an extension within a date range
   */
  async getTranscriptsByExtension(
    extension: string,
    startDate?: Date,
    endDate?: Date,
    limit: number = 50
  ): Promise<TranscriptRecord[]> {
    return (await this.searchTranscripts({
      extension,
      startDate,
      endDate,
      limit,
    })).records;
  }

  /**
   * Get statistics for transcripts
   */
  async getStats(startDate?: Date, endDate?: Date): Promise<TranscriptStats> {
    const pool = await this.getPool();

    const whereConditions = ["Transcription IS NOT NULL"];
    if (startDate) {
      whereConditions.push(`RecordingDate >= '${startDate.toISOString()}'`);
    }
    if (endDate) {
      whereConditions.push(`RecordingDate <= '${endDate.toISOString()}'`);
    }

    const whereClause = whereConditions.join(" AND ");

    const result = await pool.request().query(`
      SELECT
        COUNT(*) as totalCalls,
        AVG(Score) as avgScore
      FROM Recordings
      WHERE ${whereClause}
    `);

    // Get all records to compute direction counts and duration
    const records = await pool.request().query(`
      SELECT Ext, CallerExt, DialedNum, Duration
      FROM Recordings
      WHERE ${whereClause}
    `);

    let totalDuration = 0;
    let inboundCalls = 0;
    let outboundCalls = 0;

    for (const record of records.recordset) {
      totalDuration += this.parseDuration(record.Duration);
      const direction = this.determineDirection(record.CallerExt, record.DialedNum, record.Ext);
      if (direction === "inbound") inboundCalls++;
      else outboundCalls++;
    }

    const totalCalls = result.recordset[0].totalCalls || 0;

    return {
      totalCalls,
      totalDuration,
      avgDuration: totalCalls > 0 ? Math.round(totalDuration / totalCalls) : 0,
      inboundCalls,
      outboundCalls,
      avgScore: result.recordset[0].avgScore || undefined,
    };
  }

  /**
   * Health check - verify connection and get basic info
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
        SELECT DB_NAME() as db_name, COUNT(*) as record_count FROM Recordings
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
}

// =============================================================================
// Utility: Get client for current tenant
// =============================================================================

export async function getMSSQLTranscriptsClient(): Promise<MSSQLTranscriptsClient | null> {
  const tenantId = process.env.DEFAULT_TENANT_ID;
  if (!tenantId) return null;
  return MSSQLTranscriptsClient.fromTenant(tenantId);
}
