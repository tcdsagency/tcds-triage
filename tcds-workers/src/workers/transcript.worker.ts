/**
 * Transcript Processing Worker
 *
 * Critical worker that handles post-call transcript extraction and AI analysis.
 *
 * Flow:
 * 1. Query VoIPTools SQL Server for transcript (with retries for write delay)
 * 2. Run Claude AI extraction for summary, intent, sentiment, entities
 * 3. Save wrapup data to main app via API
 * 4. Update call status
 * 5. Create AgencyZoom note if substantive call
 */

import { Worker, Job } from 'bullmq';
import sql from 'mssql';
import Anthropic from '@anthropic-ai/sdk';
import { redis } from '../redis';
import { config } from '../config';
import { logger } from '../logger';
import { TranscriptJobData } from '../queues';

// =============================================================================
// SQL SERVER CONNECTION
// =============================================================================

let pool: sql.ConnectionPool | null = null;

/**
 * Get or create SQL Server connection pool
 */
async function getPool(): Promise<sql.ConnectionPool> {
  if (!pool || !pool.connected) {
    pool = await sql.connect({
      server: config.voiptools.server,
      database: config.voiptools.database,
      user: config.voiptools.user,
      password: config.voiptools.password,
      options: {
        encrypt: true,
        trustServerCertificate: true,
      },
      pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000,
      },
      requestTimeout: 30000,
    });
    logger.info('Connected to VoIPTools SQL Server');
  }
  return pool;
}

// =============================================================================
// CLAUDE CLIENT
// =============================================================================

const anthropic = new Anthropic({ apiKey: config.anthropic.apiKey });

// =============================================================================
// CONSTANTS
// =============================================================================

const MAX_SQL_ATTEMPTS = 10;

// =============================================================================
// MAIN WORKER
// =============================================================================

/**
 * Create and return the transcript processing worker
 */
export function createTranscriptWorker(): Worker<TranscriptJobData> {
  return new Worker<TranscriptJobData>(
    'transcript-processing',
    async (job: Job<TranscriptJobData>) => {
      const {
        callId,
        externalCallId,
        extension,
        callerNumber,
        callerName,
        callStartedAt,
        callEndedAt,
      } = job.data;

      const attemptNumber = job.attemptsMade + 1;

      logger.info({
        event: 'transcript_job_start',
        callId,
        externalCallId,
        extension,
        callerNumber,
        attempt: attemptNumber,
      });

      // ========================================
      // Step 1: Query SQL Server for transcript
      // ========================================
      const dbPool = await getPool();
      const cleanNumber = callerNumber.replace(/\D/g, '').slice(-10);

      // Time window: 5 minutes before to 5 minutes after call times
      const startTime = new Date(new Date(callStartedAt).getTime() - 5 * 60000);
      const endTime = new Date(new Date(callEndedAt).getTime() + 5 * 60000);

      const result = await dbPool
        .request()
        .input('extension', sql.VarChar, extension)
        .input('callerNumber', sql.VarChar, `%${cleanNumber}%`)
        .input('startTime', sql.DateTime, startTime)
        .input('endTime', sql.DateTime, endTime)
        .query(`
          SELECT TOP 1
            RecordingID,
            Transcription,
            Duration,
            RecordingUrl,
            RecordingDate,
            CallerNum,
            DialedNum
          FROM dbo.Recordings
          WHERE Ext = @extension
            AND (CallerNum LIKE @callerNumber OR DialedNum LIKE @callerNumber)
            AND RecordingDate >= @startTime
            AND RecordingDate <= @endTime
            AND Transcription IS NOT NULL
            AND LEN(Transcription) > 50
          ORDER BY RecordingDate DESC
        `);

      // ========================================
      // Step 2: Handle not found (retry or fallback)
      // ========================================
      if (result.recordset.length === 0) {
        if (attemptNumber >= MAX_SQL_ATTEMPTS) {
          logger.warn(
            { callId, attempts: attemptNumber },
            'Max SQL attempts reached, falling back to live transcript'
          );
          return await processWithLiveTranscript(job.data);
        }

        // Throw error to trigger retry with exponential backoff
        throw new Error(
          `Transcript not found in SQL Server (attempt ${attemptNumber}/${MAX_SQL_ATTEMPTS})`
        );
      }

      const voiptoolsRecord = result.recordset[0];
      const transcript = voiptoolsRecord.Transcription;

      logger.info({
        event: 'transcript_found',
        callId,
        transcriptLength: transcript.length,
        recordingId: voiptoolsRecord.RecordingID,
        duration: voiptoolsRecord.Duration,
      });

      // ========================================
      // Step 3: Run AI extraction with Claude
      // ========================================
      const extraction = await extractCallData(transcript, callerNumber, callerName);

      logger.info({
        event: 'extraction_complete',
        callId,
        intent: extraction.intent,
        sentiment: extraction.sentiment,
        actionItemCount: extraction.actionItems?.length || 0,
      });

      // ========================================
      // Step 4: Save wrapup via Vercel API
      // ========================================
      await saveWrapup(callId, {
        transcript,
        transcriptSource: 'voiptools_sql',
        recordingUrl: voiptoolsRecord.RecordingUrl,
        recordingId: voiptoolsRecord.RecordingID,
        duration: voiptoolsRecord.Duration,
        summary: extraction.summary,
        intent: extraction.intent,
        sentiment: extraction.sentiment,
        entities: extraction.entities,
        actionItems: extraction.actionItems,
        topics: extraction.topics,
      });

      // ========================================
      // Step 5: Update call status
      // ========================================
      await updateCallStatus(callId, 'wrapped_up');

      // ========================================
      // Step 6: Create AgencyZoom note (if applicable)
      // ========================================
      if (extraction.shouldCreateNote) {
        await createAgencyZoomNote(callId, extraction);
      }

      logger.info({ event: 'transcript_job_complete', callId });

      return {
        success: true,
        transcriptSource: 'voiptools_sql',
        recordingId: voiptoolsRecord.RecordingID,
        intent: extraction.intent,
        sentiment: extraction.sentiment,
      };
    },
    {
      connection: redis,
      concurrency: 5,
      limiter: {
        max: 10,
        duration: 1000, // Max 10 jobs per second
      },
    }
  );
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Fallback: Process using live transcript segments from Supabase
 * Used when SQL Server transcript is not available after max retries
 */
async function processWithLiveTranscript(
  data: TranscriptJobData
): Promise<{ success: boolean; transcriptSource: string; intent?: string; note?: string }> {
  logger.info({ callId: data.callId }, 'Processing with live transcript fallback');

  try {
    // Fetch accumulated live segments from main app
    const response = await fetch(
      `${config.app.url}/api/calls/${data.callId}/transcription`,
      {
        headers: {
          Authorization: `Bearer ${config.app.internalKey}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch live transcript: ${response.status} ${response.statusText}`);
    }

    const responseData = await response.json() as { segments?: Array<{ speaker?: string; text: string }> };
    const { segments } = responseData;

    if (!segments || !Array.isArray(segments)) {
      throw new Error('Invalid segments response');
    }

    const liveTranscript = segments
      .map((s: { speaker?: string; text: string }) =>
        s.speaker ? `${s.speaker}: ${s.text}` : s.text
      )
      .join('\n')
      .trim();

    if (!liveTranscript || liveTranscript.length < 50) {
      // No usable transcript - mark as complete with no data
      await updateCallStatus(data.callId, 'completed_no_transcript');
      return {
        success: true,
        transcriptSource: 'none',
        note: 'No transcript available',
      };
    }

    // Extract data from live transcript
    const extraction = await extractCallData(liveTranscript, data.callerNumber, data.callerName);

    await saveWrapup(data.callId, {
      transcript: liveTranscript,
      transcriptSource: 'live_segments_fallback',
      summary: extraction.summary,
      intent: extraction.intent,
      sentiment: extraction.sentiment,
      entities: extraction.entities,
      actionItems: extraction.actionItems,
      topics: extraction.topics,
    });

    await updateCallStatus(data.callId, 'wrapped_up');

    if (extraction.shouldCreateNote) {
      await createAgencyZoomNote(data.callId, extraction);
    }

    return {
      success: true,
      transcriptSource: 'live_segments_fallback',
      intent: extraction.intent,
    };
  } catch (err) {
    logger.error({ callId: data.callId, error: err }, 'Live transcript fallback failed');

    // Mark as failed but don't throw - we've exhausted all options
    await updateCallStatus(data.callId, 'transcript_failed');

    return {
      success: false,
      transcriptSource: 'none',
      note: `Transcript extraction failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
    };
  }
}

/**
 * Extract structured data from transcript using Claude
 */
interface ExtractionResult {
  summary: string;
  intent: string;
  sentiment: string;
  entities: Record<string, unknown>;
  actionItems: string[];
  topics: string[];
  shouldCreateNote: boolean;
}

async function extractCallData(
  transcript: string,
  callerNumber: string,
  callerName?: string
): Promise<ExtractionResult> {
  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      system: `You are an expert at analyzing insurance agency call transcripts. You work for TCDS Insurance, an Alabama P&C insurance agency.

Extract the following from the transcript:
1. Summary: 2-3 sentence summary of what happened on the call
2. Intent: Primary caller intent (one of: new_quote, add_vehicle, remove_vehicle, add_driver, remove_driver, billing_inquiry, make_payment, policy_change, coverage_question, file_claim, claim_status, cancel_policy, general_inquiry, complaint, other)
3. Sentiment: Caller sentiment (positive, neutral, negative)
4. Entities: Extract any mentioned names, addresses, VINs, policy numbers, dates, dollar amounts, phone numbers, email addresses
5. Action Items: List any follow-up tasks mentioned or implied
6. Topics: List the main topics discussed

Return valid JSON only. Do not include markdown code blocks or any text outside the JSON.`,
      messages: [
        {
          role: 'user',
          content: `Analyze this call transcript:

Caller: ${callerName || callerNumber || 'Unknown'}

Transcript:
${transcript.slice(0, 8000)}

Return JSON with these fields:
- summary (string)
- intent (string)
- sentiment (string: positive/neutral/negative)
- entities (object with arrays for: names, addresses, vins, policyNumbers, dates, amounts, phones, emails)
- actionItems (array of strings)
- topics (array of strings)
- shouldCreateNote (boolean - true if this was a substantive call that warrants a CRM note)`,
        },
      ],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected Claude response type');
    }

    // Parse JSON response, handling potential markdown code blocks
    let jsonStr = content.text.trim();
    const jsonMatch = jsonStr.match(/```(?:json)?\n?([\s\S]*?)\n?```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1];
    }

    const parsed = JSON.parse(jsonStr);

    return {
      summary: parsed.summary || 'Unable to generate summary',
      intent: parsed.intent || 'other',
      sentiment: parsed.sentiment || 'neutral',
      entities: parsed.entities || {},
      actionItems: parsed.actionItems || [],
      topics: parsed.topics || [],
      shouldCreateNote: parsed.shouldCreateNote ?? true,
    };
  } catch (err) {
    logger.error({ error: err }, 'Failed to extract call data with Claude');

    // Return default values on failure
    return {
      summary: 'Unable to parse call summary',
      intent: 'other',
      sentiment: 'neutral',
      entities: {},
      actionItems: [],
      topics: [],
      shouldCreateNote: false,
    };
  }
}

/**
 * Save wrapup data to main app via API
 */
async function saveWrapup(callId: string, data: Record<string, unknown>): Promise<void> {
  const response = await fetch(`${config.app.url}/api/wrapups/${callId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.app.internalKey}`,
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to save wrapup: ${response.status} ${errorText}`);
  }

  logger.debug({ callId }, 'Wrapup saved successfully');
}

/**
 * Update call status in main app
 */
async function updateCallStatus(callId: string, status: string): Promise<void> {
  try {
    const response = await fetch(`${config.app.url}/api/calls/${callId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.app.internalKey}`,
      },
      body: JSON.stringify({
        status,
        wrapupCompletedAt: new Date().toISOString(),
      }),
    });

    if (!response.ok) {
      logger.warn({ callId, status, statusCode: response.status }, 'Failed to update call status');
    }
  } catch (err) {
    logger.warn({ callId, status, error: err }, 'Error updating call status');
  }
}

/**
 * Create a note in AgencyZoom for the customer
 */
async function createAgencyZoomNote(
  callId: string,
  extraction: ExtractionResult
): Promise<void> {
  try {
    const response = await fetch(`${config.app.url}/api/calls/${callId}/create-note`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.app.internalKey}`,
      },
      body: JSON.stringify({
        summary: extraction.summary,
        actionItems: extraction.actionItems,
        intent: extraction.intent,
        sentiment: extraction.sentiment,
      }),
    });

    if (response.ok) {
      logger.debug({ callId }, 'AgencyZoom note created');
    } else {
      logger.warn({ callId, status: response.status }, 'Failed to create AgencyZoom note');
    }
  } catch (err) {
    // Non-critical - log and continue
    logger.warn({ callId, error: err }, 'Error creating AgencyZoom note');
  }
}
