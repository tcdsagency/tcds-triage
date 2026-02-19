/**
 * 3CX XAPI Client
 * REST API client for 3CX phone system — fetches recordings, transcripts,
 * AI summaries, and sentiment scores directly from the 3CX XAPI.
 *
 * Replaces: MSSQL polling, VM Bridge live transcripts
 * Auth: Short-lived access tokens (60s) — cached with 55s TTL
 */

// =============================================================================
// Types
// =============================================================================

export interface ThreeCXRecording {
  Id: number;
  StartTime: string;           // ISO datetime UTC
  EndTime: string;             // ISO datetime UTC
  CallType: string;            // "InboundExternal", "OutboundExternal", "Internal", etc.
  FromDisplayName: string;
  FromDn: string;              // Originating extension (e.g. "101")
  FromDnType: number;          // 0 = Extension, 1 = Trunk
  FromCallerNumber: string;    // External phone or "Ext.101"
  ToDisplayName: string;
  ToDn: string;                // Destination extension
  ToDnType: number;            // 0 = Extension, 1 = Trunk
  ToCallerNumber: string;      // External phone or "Ext.101"
  Transcription: string | null; // Full transcript text (null if not yet available)
  Summary: string | null;      // 3CX-generated AI summary (null if not yet available)
  SentimentScore: number | null; // 1-5 scale (null if no summary)
  TranscriptionResult: number; // 1 = success
  RecordingUrl: string;        // Relative path to recording file
  IsTranscribed: boolean;      // Whether transcription is available
  CanBeTranscribed: boolean;   // Whether recording can be transcribed
  IsArchived: boolean;
  ArchivedUrl: string | null;
  RefParticipantId: number;
  FromIdParticipant: number;
  ToIdParticipant: number;
}

export interface ThreeCXCallData {
  threecxRecordingId: number;
  direction: 'inbound' | 'outbound';
  startedAt: Date;
  endedAt: Date;
  durationSeconds: number;
  fromNumber: string;
  toNumber: string;
  externalNumber: string;
  extension: string;
  callType: string;
  fromDn: string;
  toDn: string;
  fromCallerNumber: string;
  toCallerNumber: string;
  transcription: string;
  summary: string;
  sentimentScore: number;
  recordingUrl: string;
}

// =============================================================================
// Auth Token Cache
// =============================================================================

let cachedToken: string | null = null;
let tokenExpiresAt = 0;

const XAPI_BASE_URL = process.env.THREECX_XAPI_BASE_URL || 'https://tcds.al.3cx.us';
const XAPI_USERNAME = process.env.THREECX_XAPI_USERNAME || '';
const XAPI_PASSWORD = process.env.THREECX_XAPI_PASSWORD || '';

// Token TTL: 55s (tokens expire at 60s, refresh early)
const TOKEN_TTL_MS = 55_000;

/**
 * Get a valid access token, refreshing if expired.
 * 3CX tokens last 60 seconds — we cache with a 55s TTL.
 */
export async function getAccessToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && now < tokenExpiresAt) {
    return cachedToken;
  }

  const loginUrl = `${XAPI_BASE_URL}/webclient/api/Login/GetAccessToken`;

  const res = await fetch(loginUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      Password: XAPI_PASSWORD,
      Username: XAPI_USERNAME,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`3CX XAPI auth failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  const token = data.Token?.access_token || data.access_token || data.token;

  if (!token) {
    throw new Error('3CX XAPI auth response missing token');
  }

  cachedToken = token;
  tokenExpiresAt = now + TOKEN_TTL_MS;

  return token;
}

// =============================================================================
// Recording Fetch
// =============================================================================

/**
 * Fetch new recordings with Id > lastSeenId.
 * Uses OData filtering, ordered ascending by Id, max 50 per batch.
 */
export async function fetchNewRecordings(lastSeenId: number): Promise<ThreeCXRecording[]> {
  const token = await getAccessToken();

  const filter = encodeURIComponent(`Id gt ${lastSeenId} and IsTranscribed eq true`);
  const url = `${XAPI_BASE_URL}/xapi/v1/Recordings?$filter=${filter}&$orderby=Id asc&$top=50`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`3CX XAPI fetch recordings failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  return (data.value || data) as ThreeCXRecording[];
}

/**
 * Fetch a single recording by Id.
 */
export async function fetchRecordingById(id: number): Promise<ThreeCXRecording> {
  const token = await getAccessToken();

  const url = `${XAPI_BASE_URL}/xapi/v1/Recordings(${id})`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`3CX XAPI fetch recording ${id} failed (${res.status}): ${text}`);
  }

  return (await res.json()) as ThreeCXRecording;
}

// =============================================================================
// Direction Logic
// =============================================================================

/**
 * Determine call direction from 3CX CallType field.
 * CallType contains "Inbound", "Outbound", "Internal" — map directly.
 */
function determineDirection(callType: string): 'inbound' | 'outbound' {
  const ct = (callType || '').toLowerCase();
  if (ct.includes('outbound')) return 'outbound';
  // Inbound and internal both treated as inbound for triage purposes
  return 'inbound';
}

/**
 * Determine which number is the external (non-extension) party,
 * and which extension handled the call.
 */
function resolveParties(rec: ThreeCXRecording): {
  externalNumber: string;
  extension: string;
} {
  const direction = determineDirection(rec.CallType);

  if (direction === 'inbound') {
    return {
      externalNumber: rec.FromCallerNumber || rec.FromDn,
      extension: rec.ToDn || rec.ToCallerNumber,
    };
  }

  // Outbound: agent is From, external is To
  return {
    externalNumber: rec.ToCallerNumber || rec.ToDn,
    extension: rec.FromDn || rec.FromCallerNumber,
  };
}

// =============================================================================
// Mapping
// =============================================================================

/**
 * Map a 3CX recording to our internal call data format.
 */
export function mapRecordingToCallData(rec: ThreeCXRecording): ThreeCXCallData {
  const direction = determineDirection(rec.CallType);
  const { externalNumber, extension } = resolveParties(rec);

  const startedAt = new Date(rec.StartTime);
  const endedAt = new Date(rec.EndTime);
  const durationSeconds = Math.round((endedAt.getTime() - startedAt.getTime()) / 1000);

  // Normalize phone numbers
  const fromNumber = direction === 'inbound'
    ? (rec.FromCallerNumber || rec.FromDn)
    : (rec.FromDn || rec.FromCallerNumber);
  const toNumber = direction === 'inbound'
    ? (rec.ToDn || rec.ToCallerNumber)
    : (rec.ToCallerNumber || rec.ToDn);

  return {
    threecxRecordingId: rec.Id,
    direction,
    startedAt,
    endedAt,
    durationSeconds,
    fromNumber,
    toNumber,
    externalNumber,
    extension,
    callType: rec.CallType,
    fromDn: rec.FromDn,
    toDn: rec.ToDn,
    fromCallerNumber: rec.FromCallerNumber,
    toCallerNumber: rec.ToCallerNumber,
    transcription: rec.Transcription || '',
    summary: rec.Summary || '',
    sentimentScore: rec.SentimentScore || 3,
    recordingUrl: rec.RecordingUrl || '',
  };
}

/**
 * Check if a recording is an internal call (both sides are extensions, no external number).
 */
export function isInternalCall(rec: ThreeCXRecording): boolean {
  const ct = (rec.CallType || '').toLowerCase();
  if (ct.includes('internal')) return true;

  // Both parties are short extension numbers (no 7+ digit phone)
  const fromDigits = (rec.FromCallerNumber || '').replace(/\D/g, '');
  const toDigits = (rec.ToCallerNumber || '').replace(/\D/g, '');
  const fromDnDigits = (rec.FromDn || '').replace(/\D/g, '');
  const toDnDigits = (rec.ToDn || '').replace(/\D/g, '');

  const hasExternalFrom = fromDigits.length >= 7 || fromDnDigits.length >= 7;
  const hasExternalTo = toDigits.length >= 7 || toDnDigits.length >= 7;

  return !hasExternalFrom && !hasExternalTo;
}
