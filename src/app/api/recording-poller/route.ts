// =============================================================================
// Recording Poller — 3CX XAPI
// =============================================================================
// Cron job (every 2 minutes via Vercel cron) that replaces the old transcript-worker.
// Polls the 3CX XAPI for new recordings, processes transcripts, creates wrapups,
// auto-creates service tickets (inbound) and auto-posts notes (outbound).
//
// Eliminates: MSSQL polling, pendingTranscriptJobs, VM Bridge, exponential retry
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import {
  calls,
  customers,
  users,
  tenants,
  serviceTickets,
  wrapupDrafts,
  threecxPollingState,
} from "@/db/schema";
import { eq, and, sql, or, ilike, gte, lte, lt, isNull } from "drizzle-orm";
import {
  fetchNewRecordings,
  mapRecordingToCallData,
  isInternalCall,
  type ThreeCXRecording,
} from "@/lib/api/threecx-xapi";
import { extractCallData, detectHangup, mapSentiment } from "@/lib/ai/light-extraction";
import { getAgencyZoomClient } from "@/lib/api/agencyzoom";
import {
  SERVICE_PIPELINES,
  PIPELINE_STAGES,
  SERVICE_CATEGORIES,
  SERVICE_PRIORITIES,
  SPECIAL_HOUSEHOLDS,
  EMPLOYEE_IDS,
  getDefaultDueDate,
} from "@/lib/api/agencyzoom-service-tickets";
import { formatInboundCallDescription, formatSentimentEmoji } from "@/lib/format-ticket-description";
import { addToRetryQueue } from "@/lib/api/retry-queue";

// =============================================================================
// Config
// =============================================================================

export const maxDuration = 300; // 5 minutes — matches other cron routes

const TENANT_ID = process.env.DEFAULT_TENANT_ID!;
const CRON_SECRET = process.env.CRON_SECRET;
const ALERT_WEBHOOK_URL = process.env.ALERT_WEBHOOK_URL;
const HANGUP_THRESHOLD_SECONDS = 35;
const STALE_CALL_MINUTES = 30;
const BACKLOG_THRESHOLD_HOURS = 1;
const PER_RECORDING_TIMEOUT_MS = 60_000; // 60 seconds
const OVERLAP_STALE_MINUTES = 5; // Lock older than this is considered stale
const OVERLAP_ACTIVE_MINUTES = 4; // Lock younger than this means still processing

// =============================================================================
// POST handler — called by Vercel cron every 2 minutes
// =============================================================================

export async function POST(req: NextRequest) {
  const startMs = Date.now();

  // CRON_SECRET auth — allow Vercel cron header or Bearer token
  if (CRON_SECRET) {
    const authHeader = req.headers.get('authorization');
    const isVercelCron = req.headers.get('x-vercel-cron') === '1';
    if (!isVercelCron && authHeader !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  try {
    // 1. Get or create polling state
    const pollingState = await getOrCreatePollingState();

    // 2. Overlap protection — prevent concurrent invocations
    if (pollingState.processingStartedAt) {
      const lockAgeMs = Date.now() - pollingState.processingStartedAt.getTime();
      const lockAgeMinutes = lockAgeMs / 60_000;

      if (lockAgeMinutes < OVERLAP_ACTIVE_MINUTES) {
        return NextResponse.json({
          success: true,
          skipped: true,
          reason: 'already_processing',
          lockAgeSeconds: Math.round(lockAgeMs / 1000),
        });
      }

      // Lock is stale (> 5 min) — dead process, proceed and take over
      if (lockAgeMinutes >= OVERLAP_STALE_MINUTES) {
        console.warn(`[recording-poller] Stale lock detected (${Math.round(lockAgeMinutes)}m old), taking over`);
      }
    }

    // Set processing lock
    await db.update(threecxPollingState).set({
      processingStartedAt: new Date(),
    }).where(eq(threecxPollingState.id, pollingState.id));

    // 3. Fetch new recordings from 3CX XAPI
    let recordings: ThreeCXRecording[];
    try {
      recordings = await fetchNewRecordings(pollingState.lastSeenId);
    } catch (error) {
      await updatePollingError(pollingState.id, error);
      await clearProcessingLock(pollingState.id);
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch recordings from 3CX XAPI',
        details: error instanceof Error ? error.message : String(error),
      }, { status: 502 });
    }

    if (recordings.length === 0) {
      await updatePollingSuccess(pollingState.id, pollingState.lastSeenId);
      return NextResponse.json({
        success: true,
        processed: 0,
        elapsed: Date.now() - startMs,
      });
    }

    // 4. Process each recording
    const results = {
      processed: 0,
      skipped: 0,
      ticketsCreated: 0,
      notesPosted: 0,
      autoVoided: 0,
      awaitingTranscription: 0,
      errors: 0,
      errorSamples: [] as string[],
    };

    let highestId = pollingState.lastSeenId;

    for (const rec of recordings) {
      // Fix 2: Transcription gap prevention
      if (!rec.IsTranscribed) {
        if (!rec.CanBeTranscribed) {
          // Permanently untranscribable — skip and advance
          results.skipped++;
          if (rec.Id > highestId) {
            highestId = rec.Id;
            await updatePollingSuccess(pollingState.id, highestId);
          }
          continue;
        }

        const recAge = Date.now() - new Date(rec.StartTime).getTime();
        const recAgeHours = recAge / (60 * 60_000);

        if (recAgeHours > 24) {
          // Stale untranscribed — give up waiting, skip and advance
          console.warn(`[recording-poller] Rec ${rec.Id} untranscribed after 24h, skipping`);
          results.skipped++;
          if (rec.Id > highestId) {
            highestId = rec.Id;
            await updatePollingSuccess(pollingState.id, highestId);
          }
          continue;
        }

        // Fresh untranscribed — skip but do NOT advance highestId (retry next poll)
        results.awaitingTranscription++;
        continue;
      }

      try {
        const outcome = await withTimeout(
          processRecording(rec),
          PER_RECORDING_TIMEOUT_MS,
          `Rec ${rec.Id}`,
        );
        if (outcome === 'processed') results.processed++;
        else if (outcome === 'ticket') { results.processed++; results.ticketsCreated++; }
        else if (outcome === 'note') { results.processed++; results.notesPosted++; }
        else if (outcome === 'voided') { results.processed++; results.autoVoided++; }
        else results.skipped++;
      } catch (error) {
        const errMsg = `Rec ${rec.Id}: ${error instanceof Error ? error.message : String(error)}`;
        console.error(`[recording-poller] ${errMsg}`);
        results.errors++;
        if (results.errorSamples.length < 3) results.errorSamples.push(errMsg);
      }

      // Always advance past this recording (success or error)
      if (rec.Id > highestId) {
        highestId = rec.Id;
        await updatePollingSuccess(pollingState.id, highestId);
      }
    }

    // 5. Cleanup stale calls
    await cleanupStaleCalls();

    // 6. Proactive alerting on high error batches
    if (results.errors >= 3) {
      await sendAlert(`[recording-poller] ${results.errors} errors in batch. Samples: ${results.errorSamples.join('; ')}`);
    }

    return NextResponse.json({
      success: true,
      ...results,
      lastSeenId: highestId,
      elapsed: Date.now() - startMs,
    });
  } catch (error) {
    console.error('[recording-poller] Fatal error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

// Allow GET for health check
export async function GET() {
  const [state] = await db
    .select()
    .from(threecxPollingState)
    .where(eq(threecxPollingState.tenantId, TENANT_ID))
    .limit(1);

  const minutesSincePoll = state?.lastPolledAt
    ? Math.round((Date.now() - state.lastPolledAt.getTime()) / 60_000)
    : null;
  const isStale = minutesSincePoll !== null && minutesSincePoll > 10;
  const isProcessing = !!state?.processingStartedAt;

  // Proactive alerting on stale + errors
  if (isStale && (state?.pollErrors ?? 0) >= 3) {
    await sendAlert(`[recording-poller] Health check: stale (${minutesSincePoll}m) with ${state!.pollErrors} errors. Last: ${state!.lastError}`);
  }

  return NextResponse.json({
    status: isStale ? 'stale' : 'ok',
    lastSeenId: state?.lastSeenId ?? 0,
    lastPolledAt: state?.lastPolledAt?.toISOString() ?? null,
    minutesSincePoll,
    pollErrors: state?.pollErrors ?? 0,
    lastError: state?.lastError ?? null,
    isProcessing,
    processingStartedAt: state?.processingStartedAt?.toISOString() ?? null,
  });
}

// =============================================================================
// Per-Recording Timeout
// =============================================================================

// Note: timeout does not cancel the underlying promise. The work may complete
// in background, which is acceptable — DB unique constraints prevent duplicates.
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout after ${ms}ms: ${label}`)), ms)
    ),
  ]);
}

// =============================================================================
// Recording Processing Pipeline
// =============================================================================

type ProcessOutcome = 'skipped' | 'processed' | 'ticket' | 'note' | 'voided';

async function processRecording(rec: ThreeCXRecording): Promise<ProcessOutcome> {
  // Skip internal calls
  if (isInternalCall(rec)) return 'skipped';

  // Skip if already processed (UNIQUE constraint on threecx_recording_id)
  const [existing] = await db
    .select({ id: calls.id })
    .from(calls)
    .where(eq(calls.threecxRecordingId, rec.Id))
    .limit(1);

  if (existing) return 'skipped';

  // Map 3CX recording to our format
  const callData = mapRecordingToCallData(rec);

  // Run light AI extraction
  const aiResult = await extractCallData({
    transcript: callData.transcription,
    summary: callData.summary,
    sentimentScore: callData.sentimentScore,
    direction: callData.direction,
    agentExtension: callData.extension,
    callerNumber: callData.externalNumber,
    durationSeconds: callData.durationSeconds,
  });

  // Check for auto-void (hangup, short call, etc.)
  const shouldVoid = shouldDismissWrapup(aiResult, callData);
  const voidReason = shouldVoid ? getDismissReason(aiResult, callData) : null;

  // Match to existing call record by extension + time window (±5min)
  const matchedCall = await matchExistingCall(callData);

  // Create or update the call record
  const callId = matchedCall
    ? await updateExistingCall(matchedCall.id, rec, callData, aiResult)
    : await createNewCall(rec, callData, aiResult);

  // Create wrapup draft
  const wrapupId = await createWrapupDraft(callId, callData, aiResult, shouldVoid, voidReason, rec);

  if (shouldVoid) {
    return 'voided';
  }

  // Post-call business rules
  if (callData.direction === 'inbound') {
    const ticketCreated = await autoCompleteInbound(callId, wrapupId, callData, aiResult);
    return ticketCreated ? 'ticket' : 'processed';
  } else {
    const notePosted = await autoCompleteOutbound(callId, wrapupId, callData, aiResult);
    return notePosted ? 'note' : 'processed';
  }
}

// =============================================================================
// Call Matching
// =============================================================================

async function matchExistingCall(callData: ReturnType<typeof mapRecordingToCallData>) {
  const windowStart = new Date(callData.startedAt.getTime() - 5 * 60_000);
  const windowEnd = new Date(callData.startedAt.getTime() + 5 * 60_000);
  const phone = normalizePhone(callData.externalNumber);

  if (phone) {
    // Phone-based matching
    const phoneSuffix = `%${phone.slice(-10)}`;

    const [match] = await db
      .select({ id: calls.id })
      .from(calls)
      .where(and(
        eq(calls.tenantId, TENANT_ID),
        gte(calls.startedAt, windowStart),
        lte(calls.startedAt, windowEnd),
        or(
          ilike(calls.fromNumber, phoneSuffix),
          ilike(calls.toNumber, phoneSuffix),
          ilike(calls.externalNumber, phoneSuffix),
        ),
      ))
      .orderBy(sql`ABS(EXTRACT(EPOCH FROM ${calls.startedAt} - ${callData.startedAt}::timestamp))`)
      .limit(1);

    if (match) return match;
  }

  // Fallback: extension-based matching for calls with no/short phone (e.g. CDR "Unknown")
  if (callData.extension) {
    const [match] = await db
      .select({ id: calls.id })
      .from(calls)
      .where(and(
        eq(calls.tenantId, TENANT_ID),
        gte(calls.startedAt, windowStart),
        lte(calls.startedAt, windowEnd),
        isNull(calls.threecxRecordingId),
        or(
          eq(calls.extension, callData.extension),
          eq(calls.toNumber, callData.extension),
        ),
      ))
      .orderBy(sql`ABS(EXTRACT(EPOCH FROM ${calls.startedAt} - ${callData.startedAt}::timestamp))`)
      .limit(1);

    if (match) return match;
  }

  return null;
}

// =============================================================================
// Call Record Operations
// =============================================================================

async function createNewCall(
  rec: ThreeCXRecording,
  callData: ReturnType<typeof mapRecordingToCallData>,
  aiResult: Awaited<ReturnType<typeof extractCallData>>,
): Promise<string> {
  const phone = normalizePhone(callData.externalNumber);

  // Try to match customer by phone
  const customer = phone ? await findCustomerByPhone(phone) : null;

  // Try to match agent by extension
  const agent = callData.extension ? await findAgentByExtension(callData.extension) : null;

  const [newCall] = await db.insert(calls).values({
    tenantId: TENANT_ID,
    customerId: customer?.id ?? null,
    agentId: agent?.id ?? null,
    direction: callData.direction,
    directionFinal: callData.direction,
    status: 'completed',
    fromNumber: callData.fromNumber || 'Unknown',
    toNumber: callData.toNumber || 'Unknown',
    extension: callData.extension,
    externalNumber: callData.externalNumber,
    startedAt: callData.startedAt,
    answeredAt: callData.startedAt,
    endedAt: callData.endedAt,
    durationSeconds: callData.durationSeconds,
    recordingUrl: callData.recordingUrl,
    transcription: callData.transcription,
    transcriptionStatus: 'completed',
    aiSummary: aiResult.enhancedSummary,
    aiSentiment: {
      overall: aiResult.sentiment,
      score: callData.sentimentScore,
      timeline: [],
    },
    aiActionItems: aiResult.actionItems,
    aiTopics: aiResult.topics,
    predictedReason: aiResult.requestType,
    // 3CX XAPI fields
    threecxRecordingId: rec.Id,
    threecxSentimentScore: rec.SentimentScore,
    threecxSummary: rec.Summary,
    threecxTranscription: rec.Transcription,
    threecxRecordingUrl: rec.RecordingUrl,
    threecxCallType: rec.CallType,
    threecxFromDn: rec.FromDn,
    threecxToDn: rec.ToDn,
    threecxFromCallerNumber: rec.FromCallerNumber,
    threecxToCallerNumber: rec.ToCallerNumber,
    threecxPolledAt: new Date(),
  }).returning({ id: calls.id });

  return newCall.id;
}

async function updateExistingCall(
  callId: string,
  rec: ThreeCXRecording,
  callData: ReturnType<typeof mapRecordingToCallData>,
  aiResult: Awaited<ReturnType<typeof extractCallData>>,
): Promise<string> {
  const phone = normalizePhone(callData.externalNumber);
  const customer = phone ? await findCustomerByPhone(phone) : null;
  const agent = callData.extension ? await findAgentByExtension(callData.extension) : null;

  await db.update(calls).set({
    status: 'completed',
    directionFinal: callData.direction,
    ...(agent?.id && { agentId: agent.id }),
    ...(customer?.id && { customerId: customer.id }),
    ...(callData.extension && { extension: callData.extension }),
    ...(callData.externalNumber && { externalNumber: callData.externalNumber }),
    endedAt: callData.endedAt,
    durationSeconds: callData.durationSeconds,
    recordingUrl: callData.recordingUrl,
    transcription: callData.transcription,
    transcriptionStatus: 'completed',
    aiSummary: aiResult.enhancedSummary,
    aiSentiment: {
      overall: aiResult.sentiment,
      score: callData.sentimentScore,
      timeline: [],
    },
    aiActionItems: aiResult.actionItems,
    aiTopics: aiResult.topics,
    predictedReason: aiResult.requestType,
    threecxRecordingId: rec.Id,
    threecxSentimentScore: rec.SentimentScore,
    threecxSummary: rec.Summary,
    threecxTranscription: rec.Transcription,
    threecxRecordingUrl: rec.RecordingUrl,
    threecxCallType: rec.CallType,
    threecxFromDn: rec.FromDn,
    threecxToDn: rec.ToDn,
    threecxFromCallerNumber: rec.FromCallerNumber,
    threecxToCallerNumber: rec.ToCallerNumber,
    threecxPolledAt: new Date(),
    updatedAt: new Date(),
  }).where(eq(calls.id, callId));

  return callId;
}

// =============================================================================
// Wrapup Draft Creation
// =============================================================================

async function createWrapupDraft(
  callId: string,
  callData: ReturnType<typeof mapRecordingToCallData>,
  aiResult: Awaited<ReturnType<typeof extractCallData>>,
  shouldVoid: boolean,
  voidReason: string | null,
  rec: ThreeCXRecording,
): Promise<string> {
  // Check if wrapup already exists for this call
  const [existingWrapup] = await db
    .select({ id: wrapupDrafts.id })
    .from(wrapupDrafts)
    .where(eq(wrapupDrafts.callId, callId))
    .limit(1);

  if (existingWrapup) return existingWrapup.id;

  const phone = normalizePhone(callData.externalNumber);
  const agentName = callData.extension
    ? await getAgentNameByExtension(callData.extension)
    : null;

  const [wrapup] = await db.insert(wrapupDrafts).values({
    tenantId: TENANT_ID,
    callId,
    direction: callData.direction === 'inbound' ? 'Inbound' : 'Outbound',
    agentExtension: callData.extension,
    agentName,
    status: shouldVoid ? 'completed' : 'pending_review',
    customerName: aiResult.customerName,
    customerPhone: phone,
    policyNumbers: aiResult.policyNumbers.length > 0 ? aiResult.policyNumbers : null,
    insuranceType: aiResult.insuranceType,
    requestType: aiResult.requestType,
    summary: aiResult.enhancedSummary,
    aiCleanedSummary: aiResult.enhancedSummary,
    aiProcessingStatus: 'completed',
    aiProcessedAt: new Date(),
    aiExtraction: {
      ...aiResult,
      threecxRecordingId: rec.Id,
    },
    aiConfidence: '0.85',
    isAutoVoided: shouldVoid,
    autoVoidReason: voidReason,
    completionAction: shouldVoid ? 'skipped' : undefined,
    // 3CX fields
    threecxRecordingId: rec.Id,
    threecxSummary: rec.Summary,
    threecxSentimentScore: rec.SentimentScore,
    source: 'threecx',
  }).returning({ id: wrapupDrafts.id });

  return wrapup.id;
}

// =============================================================================
// Auto-Void Logic (carried forward from transcript-worker)
// =============================================================================

function shouldDismissWrapup(
  aiResult: Awaited<ReturnType<typeof extractCallData>>,
  callData: ReturnType<typeof mapRecordingToCallData>,
): boolean {
  // Hangup or short call
  if (aiResult.requestType === 'hangup') return true;
  if (aiResult.isHangup) return true;

  // PlayFile/test calls
  const phone = callData.externalNumber || '';
  if (phone === 'PlayFile' || phone.toLowerCase().includes('playfile')) return true;

  // Internal call (both sides are extensions)
  const fromDigits = (callData.fromCallerNumber || '').replace(/\D/g, '');
  const toDigits = (callData.toCallerNumber || '').replace(/\D/g, '');
  if (fromDigits.length < 5 && toDigits.length < 5 &&
      (callData.fromDn || '').length < 5 && (callData.toDn || '').length < 5) {
    return true;
  }

  // No summary or too short
  if (!aiResult.enhancedSummary || aiResult.enhancedSummary.length < 15) {
    if (!callData.transcription || callData.transcription.length < 20) {
      return true;
    }
  }

  // Short call (< 35 seconds)
  if (callData.durationSeconds < HANGUP_THRESHOLD_SECONDS) {
    return true;
  }

  return false;
}

function getDismissReason(
  aiResult: Awaited<ReturnType<typeof extractCallData>>,
  callData: ReturnType<typeof mapRecordingToCallData>,
): string {
  if (aiResult.requestType === 'hangup' || aiResult.isHangup) return 'hangup';
  const phone = callData.externalNumber || '';
  if (phone === 'PlayFile' || phone.toLowerCase().includes('playfile')) return 'playfile';
  const fromDigits = (callData.fromCallerNumber || '').replace(/\D/g, '');
  const toDigits = (callData.toCallerNumber || '').replace(/\D/g, '');
  if (fromDigits.length < 5 && toDigits.length < 5) return 'internal_call';
  if (!aiResult.enhancedSummary || aiResult.enhancedSummary.length < 15) return 'no_content';
  if (callData.durationSeconds < HANGUP_THRESHOLD_SECONDS) return 'short_call';
  return 'auto_dismissed';
}

// =============================================================================
// Inbound Auto-Complete (Service Ticket Creation)
// =============================================================================

async function autoCompleteInbound(
  callId: string,
  wrapupId: string,
  callData: ReturnType<typeof mapRecordingToCallData>,
  aiResult: Awaited<ReturnType<typeof extractCallData>>,
): Promise<boolean> {
  try {
    // Check feature flag
    const [tenant] = await db
      .select({ features: tenants.features })
      .from(tenants)
      .where(eq(tenants.id, TENANT_ID))
      .limit(1);

    const features = (tenant?.features as Record<string, unknown>) || {};
    if (features.autoCreateServiceTickets === false) {
      return false;
    }

    const phone = normalizePhone(callData.externalNumber);

    // Validate phone
    if (!phone || phone.length < 7) {
      // Allow if we have AI-extracted customer name or substantial summary
      if (!aiResult.customerName && (!aiResult.enhancedSummary || aiResult.enhancedSummary.length < 50)) {
        return false;
      }
    }

    // Customer lookup
    const customer = phone ? await findCustomerByPhone(phone) : null;
    const azCustomerId = customer?.agencyzoomId
      ? parseInt(customer.agencyzoomId, 10)
      : SPECIAL_HOUSEHOLDS.NCM_PLACEHOLDER;
    const isNCM = azCustomerId === SPECIAL_HOUSEHOLDS.NCM_PLACEHOLDER;

    // CSR assignment
    const csrInfo = await getCSRForCall(callId, callData.extension);

    // Subject generation
    const callReason = generateTicketSubject(aiResult);
    const subjectSuffix = isNCM
      ? ` - ${aiResult.customerName || phone || 'Unknown Caller'}`
      : '';
    const ticketSubject = `Inbound Call: ${callReason}${subjectSuffix}`;

    // Description
    const ticketDescription = formatInboundCallDescription({
      summary: aiResult.enhancedSummary,
      actionItems: aiResult.actionItems,
      extractedData: {
        customerName: aiResult.customerName || undefined,
        policyNumber: aiResult.policyNumbers[0],
      },
      callerPhone: phone || undefined,
      customerName: aiResult.customerName || undefined,
      durationSeconds: callData.durationSeconds,
      transcript: callData.transcription,
      isNCM,
      sentiment: aiResult.sentiment,
      sentimentScore: callData.sentimentScore,
    });

    // Deduplication
    const isDup = await checkTicketDedup(wrapupId, phone, customer?.id ?? null);
    if (isDup) {
      await markWrapupCompleted(wrapupId, 'skipped', 'dedup');
      return false;
    }

    // Create ticket in AgencyZoom
    const azClient = await getAgencyZoomClient();
    const ticketResult = await azClient.createServiceTicket({
      subject: ticketSubject,
      description: ticketDescription,
      customerId: azCustomerId,
      pipelineId: SERVICE_PIPELINES.POLICY_SERVICE,
      stageId: PIPELINE_STAGES.POLICY_SERVICE_NEW,
      priorityId: SERVICE_PRIORITIES.STANDARD,
      categoryId: SERVICE_CATEGORIES.GENERAL_SERVICE,
      csrId: csrInfo.csrId,
      dueDate: getDefaultDueDate(),
    });

    if (!ticketResult.success || !ticketResult.serviceTicketId) {
      const errorMsg = ticketResult.error || 'AZ ticket creation failed';
      console.error('[recording-poller] AZ ticket creation failed:', errorMsg);
      await addToRetryQueue(TENANT_ID, {
        operationType: 'agencyzoom_ticket',
        targetService: 'agencyzoom',
        requestPayload: {
          subject: ticketSubject,
          description: ticketDescription,
          customerId: azCustomerId,
          pipelineId: SERVICE_PIPELINES.POLICY_SERVICE,
          stageId: PIPELINE_STAGES.POLICY_SERVICE_NEW,
          priorityId: SERVICE_PRIORITIES.STANDARD,
          categoryId: SERVICE_CATEGORIES.GENERAL_SERVICE,
          csrId: csrInfo.csrId,
          dueDate: getDefaultDueDate(),
        },
        wrapupDraftId: wrapupId,
        callId,
      }, errorMsg);
      return false;
    }

    // Store ticket locally
    await db.insert(serviceTickets).values({
      tenantId: TENANT_ID,
      azTicketId: ticketResult.serviceTicketId,
      azHouseholdId: azCustomerId,
      wrapupDraftId: wrapupId,
      customerId: customer?.id ?? null,
      subject: ticketSubject,
      description: ticketDescription,
      status: 'active',
      pipelineId: SERVICE_PIPELINES.POLICY_SERVICE,
      pipelineName: 'Policy Service',
      stageId: PIPELINE_STAGES.POLICY_SERVICE_NEW,
      stageName: 'New',
      categoryId: SERVICE_CATEGORIES.GENERAL_SERVICE,
      categoryName: 'Service Question',
      priorityId: SERVICE_PRIORITIES.STANDARD,
      priorityName: 'Standard',
      csrId: csrInfo.csrId,
      csrName: csrInfo.csrName,
      source: 'wrapup',
      lastSyncedFromAz: new Date(),
    });

    // Update wrapup
    await markWrapupCompleted(wrapupId, 'ticket', String(ticketResult.serviceTicketId));

    // Link customer to call if matched
    if (customer?.id) {
      await db.update(calls).set({
        customerId: customer.id,
        updatedAt: new Date(),
      }).where(eq(calls.id, callId));
    }

    return true;
  } catch (error) {
    console.error('[recording-poller] autoCompleteInbound error:', error);
    return false;
  }
}

// =============================================================================
// Outbound Auto-Complete (Note Posting)
// =============================================================================

async function autoCompleteOutbound(
  callId: string,
  wrapupId: string,
  callData: ReturnType<typeof mapRecordingToCallData>,
  aiResult: Awaited<ReturnType<typeof extractCallData>>,
): Promise<boolean> {
  try {
    const phone = normalizePhone(callData.externalNumber);

    // Validate phone
    if (!phone || phone.length < 7) {
      await markWrapupAutoCompleted(wrapupId, 'outbound_unmatched');
      return false;
    }

    // Customer lookup
    const customer = phone ? await findCustomerByPhone(phone) : null;

    if (!customer?.agencyzoomId) {
      await markWrapupAutoCompleted(wrapupId, 'outbound_unmatched');
      return false;
    }

    const azCustomerId = parseInt(customer.agencyzoomId, 10);
    if (!azCustomerId || azCustomerId <= 0) {
      await markWrapupAutoCompleted(wrapupId, 'outbound_unmatched');
      return false;
    }

    // Get agent name
    const agentName = callData.extension
      ? await getAgentNameByExtension(callData.extension)
      : 'System';

    // Format note
    const callDate = callData.startedAt.toLocaleDateString('en-US', { timeZone: 'America/Chicago' });
    const callTime = callData.startedAt.toLocaleTimeString('en-US', { timeZone: 'America/Chicago', hour: 'numeric', minute: '2-digit' });

    const sentimentLine = formatSentimentEmoji(aiResult.sentiment, callData.sentimentScore);
    const noteLines = [
      `Outbound Call - ${callDate} ${callTime}`,
      '',
      aiResult.enhancedSummary || 'Outbound call completed.',
    ];
    if (sentimentLine) {
      noteLines.push(`Customer Sentiment: ${sentimentLine}`);
    }
    noteLines.push('', `Agent: ${agentName}`);
    const noteText = noteLines.join('\n');

    // Post note to AgencyZoom (use lead endpoint if customer is a lead)
    const azClient = getAgencyZoomClient();
    const noteResult = customer.isLead
      ? await azClient.addLeadNote(azCustomerId, noteText)
      : await azClient.addNote(azCustomerId, noteText);

    if (!noteResult.success) {
      const errorMsg = `AZ note posting failed for outbound call (${customer.isLead ? 'lead' : 'customer'} ${azCustomerId})`;
      console.error(`[recording-poller] ${errorMsg}`);
      await addToRetryQueue(TENANT_ID, {
        operationType: 'agencyzoom_note',
        targetService: 'agencyzoom',
        requestPayload: {
          customerId: azCustomerId,
          noteText,
        },
        wrapupDraftId: wrapupId,
        callId,
      }, errorMsg);
      return false;
    }

    // Link customer and mark completed
    await db.update(calls).set({
      customerId: customer.id,
      agencyzoomNoteId: noteResult.id ? String(noteResult.id) : null,
      agencyzoomSyncedAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(calls.id, callId));

    await db.update(wrapupDrafts).set({
      status: 'completed',
      matchStatus: 'matched',
      completionAction: 'posted',
      outcome: 'note_posted',
      agencyzoomNoteId: noteResult.id ? String(noteResult.id) : null,
      noteAutoPosted: true,
      noteAutoPostedAt: new Date(),
      completedAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(wrapupDrafts.id, wrapupId));

    return true;
  } catch (error) {
    console.error('[recording-poller] autoCompleteOutbound error:', error);
    return false;
  }
}

// =============================================================================
// Ticket Subject Generation (from transcript-worker)
// =============================================================================

function generateTicketSubject(aiResult: Awaited<ReturnType<typeof extractCallData>>): string {
  const summary = aiResult.enhancedSummary || '';

  // Try first sentence
  const firstSentence = summary.split(/[.!?]\s/)[0] || '';
  let subject = firstSentence;

  if (subject.length > 80) {
    // Truncate at word boundary within 60 chars
    subject = summary.slice(0, 60).replace(/\s+\S*$/, '');
  }

  // Remove common prefixes
  subject = subject
    .replace(/^(the\s+)?caller\s+(called\s+)?(about\s+)?/i, '')
    .replace(/^(the\s+)?customer\s+(called\s+)?(about\s+)?/i, '')
    .trim();

  // Capitalize first letter
  if (subject.length > 0) {
    subject = subject.charAt(0).toUpperCase() + subject.slice(1);
  }

  // Fallback to request type
  if (subject.length < 5) {
    subject = aiResult.requestType?.replace(/_/g, ' ') || 'Service request';
    subject = subject.charAt(0).toUpperCase() + subject.slice(1);
  }

  return subject;
}

// =============================================================================
// Ticket Deduplication (from transcript-worker)
// =============================================================================

async function checkTicketDedup(wrapupId: string, phone: string | null, customerId: string | null): Promise<boolean> {
  // Check 1: Wrapup already has ticket
  const [existingWrapup] = await db
    .select({ ticketId: wrapupDrafts.agencyzoomTicketId })
    .from(wrapupDrafts)
    .where(eq(wrapupDrafts.id, wrapupId))
    .limit(1);

  if (existingWrapup?.ticketId) return true;

  // Check 2: Service ticket already linked to this wrapup
  const [existingTicket] = await db
    .select({ id: serviceTickets.id })
    .from(serviceTickets)
    .where(eq(serviceTickets.wrapupDraftId, wrapupId))
    .limit(1);

  if (existingTicket) return true;

  // Check 3: Customer-based dedup (same customer in last hour)
  if (customerId) {
    const oneHourAgo = new Date(Date.now() - 60 * 60_000);

    const [recentTicket] = await db
      .select({ id: serviceTickets.id })
      .from(serviceTickets)
      .where(and(
        eq(serviceTickets.tenantId, TENANT_ID),
        eq(serviceTickets.customerId, customerId),
        gte(serviceTickets.createdAt, oneHourAgo),
      ))
      .limit(1);

    if (recentTicket) return true;
  }

  return false;
}

// =============================================================================
// Stale Call Cleanup
// =============================================================================

async function cleanupStaleCalls() {
  const staleThreshold = new Date(Date.now() - STALE_CALL_MINUTES * 60_000);

  const staleCalls = await db
    .select({ id: calls.id })
    .from(calls)
    .where(and(
      eq(calls.tenantId, TENANT_ID),
      or(
        eq(calls.status, 'ringing'),
        eq(calls.status, 'in_progress'),
      ),
      lt(calls.startedAt, staleThreshold),
      isNull(calls.durationSeconds),
    ))
    .limit(20);

  for (const staleCall of staleCalls) {
    await db.update(calls).set({
      status: 'completed',
      endedAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(calls.id, staleCall.id));
  }

  if (staleCalls.length > 0) {
    console.log(`[recording-poller] Cleaned up ${staleCalls.length} stale calls`);
  }
}

// =============================================================================
// Helper: Polling State
// =============================================================================

async function getOrCreatePollingState() {
  const [existing] = await db
    .select()
    .from(threecxPollingState)
    .where(eq(threecxPollingState.tenantId, TENANT_ID))
    .limit(1);

  if (existing) return existing;

  const [created] = await db.insert(threecxPollingState).values({
    tenantId: TENANT_ID,
    lastSeenId: 0,
  }).returning();

  return created;
}

async function updatePollingSuccess(stateId: string, lastSeenId: number) {
  await db.update(threecxPollingState).set({
    lastSeenId,
    lastPolledAt: new Date(),
    pollErrors: 0,
    lastError: null,
    processingStartedAt: null,
  }).where(eq(threecxPollingState.id, stateId));
}

async function clearProcessingLock(stateId: string) {
  await db.update(threecxPollingState).set({
    processingStartedAt: null,
  }).where(eq(threecxPollingState.id, stateId));
}

async function updatePollingError(stateId: string, error: unknown) {
  await db.update(threecxPollingState).set({
    lastPolledAt: new Date(),
    pollErrors: sql`${threecxPollingState.pollErrors} + 1`,
    lastError: error instanceof Error ? error.message : String(error),
  }).where(eq(threecxPollingState.id, stateId));
}

// =============================================================================
// Helper: Customer Lookup
// =============================================================================

async function findCustomerByPhone(phone: string) {
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 7) return null;

  const suffix = `%${digits.slice(-10)}`;

  const [customer] = await db
    .select({
      id: customers.id,
      agencyzoomId: customers.agencyzoomId,
      firstName: customers.firstName,
      lastName: customers.lastName,
      isLead: customers.isLead,
    })
    .from(customers)
    .where(and(
      eq(customers.tenantId, TENANT_ID),
      or(
        ilike(customers.phone, suffix),
        ilike(customers.phoneAlt, suffix),
      ),
    ))
    .limit(1);

  return customer ?? null;
}

// =============================================================================
// Helper: Agent Lookup
// =============================================================================

async function findAgentByExtension(extension: string) {
  if (!extension || extension.length > 5) return null;

  const [agent] = await db
    .select({
      id: users.id,
      firstName: users.firstName,
      lastName: users.lastName,
      agencyzoomId: users.agencyzoomId,
    })
    .from(users)
    .where(and(
      eq(users.tenantId, TENANT_ID),
      eq(users.extension, extension),
    ))
    .limit(1);

  return agent ?? null;
}

async function getAgentNameByExtension(extension: string): Promise<string | null> {
  const agent = await findAgentByExtension(extension);
  if (!agent) return null;
  return [agent.firstName, agent.lastName].filter(Boolean).join(' ') || null;
}

// =============================================================================
// Helper: CSR Assignment
// =============================================================================

async function getCSRForCall(
  callId: string,
  extension?: string,
): Promise<{ csrId: number; csrName: string }> {
  // Try to get agent from call record
  const [call] = await db
    .select({ agentId: calls.agentId })
    .from(calls)
    .where(eq(calls.id, callId))
    .limit(1);

  if (call?.agentId) {
    const [agent] = await db
      .select({
        agencyzoomId: users.agencyzoomId,
        firstName: users.firstName,
        lastName: users.lastName,
      })
      .from(users)
      .where(eq(users.id, call.agentId))
      .limit(1);

    if (agent?.agencyzoomId) {
      const azId = parseInt(agent.agencyzoomId, 10);
      if (azId > 0) {
        const name = [agent.firstName, agent.lastName].filter(Boolean).join(' ');
        return { csrId: azId, csrName: name || 'Agent' };
      }
    }
  }

  // Fallback: try extension
  if (extension) {
    const agent = await findAgentByExtension(extension);
    if (agent?.agencyzoomId) {
      const azId = parseInt(agent.agencyzoomId, 10);
      if (azId > 0) {
        const name = [agent.firstName, agent.lastName].filter(Boolean).join(' ');
        return { csrId: azId, csrName: name || 'Agent' };
      }
    }
  }

  // Fallback to AI Agent
  return { csrId: EMPLOYEE_IDS.AI_AGENT, csrName: 'AI Agent' };
}

// =============================================================================
// Helper: Wrapup Completion Shortcuts
// =============================================================================

async function markWrapupCompleted(wrapupId: string, action: string, ticketId?: string) {
  await db.update(wrapupDrafts).set({
    status: 'completed',
    completionAction: action,
    outcome: action === 'ticket' ? 'ticket_created' : action,
    agencyzoomTicketId: ticketId || undefined,
    completedAt: new Date(),
    updatedAt: new Date(),
  }).where(eq(wrapupDrafts.id, wrapupId));
}

async function markWrapupAutoCompleted(wrapupId: string, reason: string) {
  await db.update(wrapupDrafts).set({
    status: 'completed',
    completionAction: 'skipped',
    outcome: reason,
    autoVoidReason: reason,
    isAutoVoided: true,
    completedAt: new Date(),
    updatedAt: new Date(),
  }).where(eq(wrapupDrafts.id, wrapupId));
}

// =============================================================================
// Helper: Phone Normalization
// =============================================================================

function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 7) return null;
  return digits.slice(-10);
}

// =============================================================================
// Helper: Alerting
// =============================================================================

async function sendAlert(message: string): Promise<void> {
  if (!ALERT_WEBHOOK_URL) return;

  try {
    await fetch(ALERT_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: message }),
    });
  } catch (error) {
    // Fire-and-forget — don't let alert failure break the poller
    console.error('[recording-poller] Alert send failed:', error);
  }
}
