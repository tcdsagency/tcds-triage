// =============================================================================
// Transcript Worker - Polls SQL Server for transcripts (Source of Truth)
// =============================================================================
// This cron job processes pending_transcript_jobs by:
// 1. Finding the transcript in SQL Server (3CX Recording Manager)
// 2. Running AI extraction on the SQL transcript
// 3. Updating wrapup_drafts with results
// 4. Posting to AgencyZoom
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { pendingTranscriptJobs, wrapupDrafts, calls, customers, users, tenants, serviceTickets } from "@/db/schema";
import { eq, lte, gte, and, sql, asc, or, ilike } from "drizzle-orm";
import { getMSSQLTranscriptsClient, TranscriptRecord } from "@/lib/api/mssql-transcripts";
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
import { processPendingQuoteTicketLinks } from "@/lib/quote-ticket-linker";
import { formatInboundCallDescription } from "@/lib/format-ticket-description";
import { outlookClient } from "@/lib/outlook";

// Retry schedule (flattened — most transcripts arrive within 1-2 minutes)
const RETRY_DELAYS = [
  15,    // Attempt 1: 15s
  15,    // Attempt 2: 15s
  30,    // Attempt 3: 30s
  30,    // Attempt 4: 30s
  60,    // Attempt 5: 1m
  60,    // Attempt 6: 1m
  60,    // Attempt 7: 1m
  120,   // Attempt 8: 2m
  120,   // Attempt 9: 2m
  120,   // Attempt 10: 2m
];

const MAX_ATTEMPTS = RETRY_DELAYS.length;

// =============================================================================
// AI Extraction
// =============================================================================

interface AIExtractionResult {
  customerName: string | null;
  policyNumbers: string[];
  insuranceType: string;
  requestType: string;
  summary: string;
  actionItems: string[];
  sentiment: "positive" | "neutral" | "negative";
  topics: string[];
  isHangup: boolean;
}

async function extractCallDataWithAI(
  transcript: string,
  context: { direction: string; agentExtension: string; callerNumber: string; duration?: string }
): Promise<AIExtractionResult> {
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) {
    throw new Error("OPENAI_API_KEY not configured");
  }

  // Check for hangup (short call with no real content)
  const durationSeconds = parseDuration(context.duration);
  if (durationSeconds < 35 && isAutoAttendantOnly(transcript)) {
    return {
      customerName: null,
      policyNumbers: [],
      insuranceType: "unknown",
      requestType: "hangup",
      summary: "Caller hung up without speaking to an agent.",
      actionItems: [],
      sentiment: "neutral",
      topics: [],
      isHangup: true,
    };
  }

  const systemPrompt = `You are an insurance call analyst. Analyze this call transcript and extract structured information.

Call Context:
- Direction: ${context.direction}
- Agent Extension: ${context.agentExtension}
- Caller Number: ${context.callerNumber}
- Duration: ${context.duration || "unknown"}

Extract the following in JSON format:
{
  "customerName": "string or null",
  "policyNumbers": ["array of policy numbers mentioned"],
  "insuranceType": "auto|home|life|commercial|toys|unknown",
  "requestType": "new_quote|policy_change|claim|billing_question|general_inquiry|hangup",
  "summary": "detailed paragraph summarizing what happened on the call",
  "actionItems": ["things that need to be done after this call"],
  "sentiment": "positive|neutral|negative",
  "topics": ["main topics discussed"],
  "isHangup": false
}

Respond with ONLY valid JSON, no markdown.`;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${openaiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: transcript },
      ],
      temperature: 0.3,
      max_tokens: 1000,
    }),
  });

  const result = await response.json();
  const content = result.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("No response from OpenAI");
  }

  try {
    const cleanContent = content.replace(/```json\n?|\n?```/g, "").trim();
    return JSON.parse(cleanContent);
  } catch {
    console.error("[TranscriptWorker] Failed to parse AI response:", content);
    return {
      customerName: null,
      policyNumbers: [],
      insuranceType: "unknown",
      requestType: "general_inquiry",
      summary: content.substring(0, 500),
      actionItems: [],
      sentiment: "neutral",
      topics: [],
      isHangup: false,
    };
  }
}

function parseDuration(duration?: string): number {
  if (!duration) return 0;
  const parts = duration.split(":").map(Number);
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  } else if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }
  return 0;
}

function isAutoAttendantOnly(transcript: string): boolean {
  const lower = transcript.toLowerCase();
  const autoAttendantPhrases = [
    "thank you for calling",
    "press 1 for",
    "press 2 for",
    "please hold",
    "your call is important",
    "all agents are busy",
  ];

  const hasConversation =
    lower.includes("hello") ||
    lower.includes("how can i help") ||
    lower.includes("my name is");

  return !hasConversation && autoAttendantPhrases.some((p) => lower.includes(p));
}

// =============================================================================
// AgencyZoom Writeback
// =============================================================================

async function writeToAgencyZoom(callId: string, aiResult: AIExtractionResult) {
  const hasCredentials =
    process.env.AGENCYZOOM_API_USERNAME && process.env.AGENCYZOOM_API_PASSWORD;
  if (!hasCredentials) {
    console.log("[TranscriptWorker] AgencyZoom credentials not configured");
    return;
  }

  // Get call with customer info
  const [call] = await db
    .select({
      id: calls.id,
      direction: calls.direction,
      durationSeconds: calls.durationSeconds,
      customerId: calls.customerId,
    })
    .from(calls)
    .where(eq(calls.id, callId))
    .limit(1);

  if (!call?.customerId) {
    console.log(`[TranscriptWorker] No customer linked to call ${callId}`);
    return;
  }

  // Get customer's AgencyZoom ID
  const [customer] = await db
    .select({
      agencyzoomId: customers.agencyzoomId,
      firstName: customers.firstName,
      lastName: customers.lastName,
    })
    .from(customers)
    .where(eq(customers.id, call.customerId))
    .limit(1);

  if (!customer?.agencyzoomId) {
    console.log(`[TranscriptWorker] Customer ${call.customerId} has no AgencyZoom ID`);
    return;
  }

  const durationMin = Math.floor((call.durationSeconds || 0) / 60);
  const durationSec = (call.durationSeconds || 0) % 60;

  const actionItemsList =
    aiResult.actionItems.length > 0
      ? `\n\nAction Items:\n${aiResult.actionItems.map((item) => `- ${item}`).join("\n")}`
      : "";

  const topicsList =
    aiResult.topics.length > 0 ? `\n\nTopics: ${aiResult.topics.join(", ")}` : "";

  const noteContent = `Call Summary (${call.direction === "inbound" ? "Inbound" : "Outbound"})
Duration: ${durationMin}m ${durationSec}s
Sentiment: ${aiResult.sentiment}

${aiResult.summary}${actionItemsList}${topicsList}

— Auto-generated by TCDS Triage (SQL Transcript)`;

  try {
    const azClient = getAgencyZoomClient();
    const azId = parseInt(customer.agencyzoomId, 10);

    if (isNaN(azId)) {
      console.error(`[TranscriptWorker] Invalid AgencyZoom ID: ${customer.agencyzoomId}`);
      return;
    }

    const result = await azClient.addNote(azId, noteContent);

    if (result.success) {
      await db
        .update(calls)
        .set({
          agencyzoomNoteId: result.id ? String(result.id) : null,
          agencyzoomSyncedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(calls.id, callId));

      console.log(`[TranscriptWorker] AgencyZoom note created for call ${callId}`);
    }
  } catch (error) {
    console.error(`[TranscriptWorker] AgencyZoom error:`, error);
  }
}

// =============================================================================
// Realtime Broadcast
// =============================================================================

async function broadcastTranscriptReady(callId: string, aiResult: AIExtractionResult) {
  const realtimeUrl = process.env.REALTIME_SERVER_URL;
  if (!realtimeUrl) return;

  try {
    await fetch(`${realtimeUrl}/api/broadcast`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": process.env.REALTIME_API_KEY || "",
      },
      body: JSON.stringify({
        type: "sql_transcript_ready",
        sessionId: callId,
        summary: aiResult.summary,
        sentiment: aiResult.sentiment,
        actionItems: aiResult.actionItems,
        topics: aiResult.topics,
        source: "mssql",
      }),
    });
  } catch (err) {
    console.error("[TranscriptWorker] Broadcast error:", err);
  }
}

// =============================================================================
// Process Single Job
// =============================================================================

async function processJob(job: typeof pendingTranscriptJobs.$inferSelect) {
  console.log(`[TranscriptWorker] Processing job ${job.id} (attempt ${(job.attemptCount || 0) + 1})`);

  try {
    // Get MSSQL client
    const mssqlClient = await getMSSQLTranscriptsClient();
    if (!mssqlClient) {
      throw new Error("MSSQL client not available");
    }

    // Get SQL record IDs already claimed by other completed jobs to prevent
    // two different calls from matching the same VoIPTools recording
    const claimedJobs = await db
      .select({ sqlRecordId: pendingTranscriptJobs.sqlRecordId })
      .from(pendingTranscriptJobs)
      .where(
        and(
          eq(pendingTranscriptJobs.status, "completed"),
          sql`${pendingTranscriptJobs.sqlRecordId} IS NOT NULL`
        )
      );
    const excludeRecordIds = claimedJobs
      .map(j => j.sqlRecordId!)
      .filter(id => id > 0);

    // Find transcript in SQL Server — ordered by closest time match,
    // excluding already-claimed recordings
    const transcript = await mssqlClient.findTranscript({
      callerNumber: job.callerNumber || undefined,
      agentExtension: job.agentExtension || undefined,
      startTime: job.callStartedAt,
      endTime: job.callEndedAt,
      excludeRecordIds,
    });

    await mssqlClient.close();

    if (transcript && transcript.transcript) {
      // SUCCESS: Found transcript
      console.log(`[TranscriptWorker] Found SQL transcript for job ${job.id}`);

      // Determine direction from SQL data
      const direction = transcript.direction;

      // Run AI extraction on SQL transcript (source of truth)
      const aiResult = await extractCallDataWithAI(transcript.transcript, {
        direction,
        agentExtension: job.agentExtension || "",
        callerNumber: job.callerNumber || "",
        duration: transcript.duration,
      });

      // Create or update wrapup draft with SQL transcript data
      if (job.callId) {
        // Get call details for wrapup creation
        const [callDetails] = await db
          .select({
            tenantId: calls.tenantId,
            direction: calls.direction,
            agentId: calls.agentId,
            fromNumber: calls.fromNumber,
            toNumber: calls.toNumber,
            externalNumber: calls.externalNumber,
            durationSeconds: calls.durationSeconds,
          })
          .from(calls)
          .where(eq(calls.id, job.callId))
          .limit(1);

        // Prefer webhook direction (enhanced with AI detection) over MSSQL direction,
        // since MSSQL's determineDirection() is unreliable (CallerExt field is inconsistent)
        const callDirection = callDetails?.direction || direction || "inbound";

        // Use MSSQL callerNumber as fallback when call record has "Unknown" from 3CX WebSocket
        const mssqlCallerNumber = transcript.callerNumber && transcript.callerNumber !== "Unknown"
          ? transcript.callerNumber : null;
        const customerPhone = callDirection === "inbound"
          ? (callDetails?.externalNumber || (callDetails?.fromNumber !== "Unknown" ? callDetails?.fromNumber : null) || mssqlCallerNumber || job.callerNumber)
          : (callDetails?.externalNumber || callDetails?.toNumber);

        // If we discovered the real phone from MSSQL, update the call record
        if (mssqlCallerNumber && job.callId) {
          const fromIsUnknown = !callDetails?.fromNumber || callDetails.fromNumber === "Unknown";
          const extIsUnknown = !callDetails?.externalNumber || callDetails.externalNumber === "Unknown";
          if (fromIsUnknown || extIsUnknown) {
            await db.update(calls).set({
              ...(fromIsUnknown ? { fromNumber: mssqlCallerNumber } : {}),
              ...(extIsUnknown ? { externalNumber: mssqlCallerNumber } : {}),
              updatedAt: new Date(),
            }).where(eq(calls.id, job.callId));
            console.log(`[TranscriptWorker] Updated call ${job.callId} from_number/external_number from MSSQL: ${mssqlCallerNumber}`);
          }
        }

        // Use upsert to create if not exists, update if exists
        const [wrapup] = await db
          .insert(wrapupDrafts)
          .values({
            tenantId: callDetails?.tenantId || job.tenantId || process.env.DEFAULT_TENANT_ID!,
            callId: job.callId,
            status: "pending_review",
            summary: aiResult.summary,
            customerName: aiResult.customerName,
            customerPhone: customerPhone || null,
            policyNumbers: aiResult.policyNumbers,
            insuranceType: aiResult.insuranceType,
            requestType: aiResult.requestType,
            direction: (callDirection === "inbound" ? "Inbound" : "Outbound") as "Inbound" | "Outbound",
            agentExtension: job.agentExtension || null,
            matchStatus: "unmatched", // Will be updated during review
            aiExtraction: {
              ...aiResult,
              transcriptSource: "mssql",
              sqlRecordId: transcript.id,
            },
            aiProcessingStatus: "completed",
            aiProcessedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: wrapupDrafts.callId,
            set: {
              status: "pending_review",
              summary: aiResult.summary,
              customerName: aiResult.customerName,
              customerPhone: customerPhone || null,
              policyNumbers: aiResult.policyNumbers,
              insuranceType: aiResult.insuranceType,
              requestType: aiResult.requestType,
              aiExtraction: {
                ...aiResult,
                transcriptSource: "mssql",
                sqlRecordId: transcript.id,
              },
              aiProcessingStatus: "completed",
              aiProcessedAt: new Date(),
              direction: (callDirection === "inbound" ? "Inbound" : "Outbound") as "Inbound" | "Outbound",
              updatedAt: new Date(),
            },
          })
          .returning({ id: wrapupDrafts.id });

        // Update call with transcript, corrected direction and AI results
        await db
          .update(calls)
          .set({
            transcription: transcript.transcript, // Store the actual transcript
            transcriptionStatus: "completed",
            directionFinal: callDirection as "inbound" | "outbound",
            aiSummary: aiResult.summary,
            aiActionItems: aiResult.actionItems,
            aiSentiment: { overall: aiResult.sentiment, score: 0, timeline: [] },
            aiTopics: aiResult.topics,
            updatedAt: new Date(),
          })
          .where(eq(calls.id, job.callId));

        // Also update the wrapup's customerPhone if we enriched from MSSQL
        if (mssqlCallerNumber && wrapup?.id) {
          const existingWrapup = await db
            .select({ customerPhone: wrapupDrafts.customerPhone })
            .from(wrapupDrafts)
            .where(eq(wrapupDrafts.id, wrapup.id))
            .limit(1);

          if (existingWrapup[0]?.customerPhone === "Unknown" || !existingWrapup[0]?.customerPhone) {
            await db.update(wrapupDrafts).set({
              customerPhone: mssqlCallerNumber,
              updatedAt: new Date(),
            }).where(eq(wrapupDrafts.id, wrapup.id));
            console.log(`[TranscriptWorker] Updated wrapup ${wrapup.id} customerPhone from MSSQL: ${mssqlCallerNumber}`);
          }
        }

        // Auto-create service ticket for inbound calls
        if (callDirection === "inbound" && wrapup?.id && !aiResult.isHangup) {
          try {
            await createAutoTicketForPollCall({
              tenantId: callDetails?.tenantId || job.tenantId || process.env.DEFAULT_TENANT_ID!,
              callId: job.callId,
              agentId: callDetails?.agentId || null,
              customerPhone: customerPhone || null,
              customerName: aiResult.customerName,
              aiResult,
              transcript: transcript.transcript,
              durationSeconds: parseDuration(transcript.duration),
              wrapupId: wrapup.id,
            });
          } catch (ticketError) {
            console.error(`[TranscriptWorker] Auto-ticket failed for job ${job.id}:`, ticketError instanceof Error ? ticketError.message : ticketError);
          }
        }

        // Outbound calls: auto-complete (no ticket needed)
        if (callDirection === "outbound" && wrapup?.id) {
          try {
            await writeToAgencyZoom(job.callId, aiResult);
          } catch (err) {
            console.error(`[TranscriptWorker] AgencyZoom writeback failed:`, err instanceof Error ? err.message : err);
          }
        }
      }

      // Mark job complete
      await db
        .update(pendingTranscriptJobs)
        .set({
          status: "completed",
          completedAt: new Date(),
          sqlRecordId: parseInt(transcript.id, 10),
        })
        .where(eq(pendingTranscriptJobs.id, job.id));

      // Broadcast to UI
      if (job.callId) {
        await broadcastTranscriptReady(job.callId, aiResult);
      }

      return { success: true };
    } else {
      // NOT FOUND: Schedule retry or fail
      const attemptCount = (job.attemptCount || 0) + 1;

      if (attemptCount >= MAX_ATTEMPTS) {
        // Max attempts reached - mark as failed
        console.warn(`[TranscriptWorker] Job ${job.id} failed after ${attemptCount} attempts — no SQL transcript found`);

        // Get call details for manual review wrapup
        const [callDetails] = job.callId ? await db
          .select({
            tenantId: calls.tenantId,
            direction: calls.direction,
            fromNumber: calls.fromNumber,
            toNumber: calls.toNumber,
            externalNumber: calls.externalNumber,
          })
          .from(calls)
          .where(eq(calls.id, job.callId))
          .limit(1) : [];

        const callDirection = callDetails?.direction || "inbound";
        const customerPhone = callDirection === "inbound"
          ? (callDetails?.externalNumber || callDetails?.fromNumber || job.callerNumber)
          : (callDetails?.externalNumber || callDetails?.toNumber);

        await db
          .update(pendingTranscriptJobs)
          .set({
            status: "failed",
            failedAt: new Date(),
            error: "Max retry attempts reached - no transcript available from SQL Server",
            attemptCount,
          })
          .where(eq(pendingTranscriptJobs.id, job.id));

        // Send dead letter email notification
        try {
          const alertEmail = process.env.TRIAGE_ALERT_EMAIL || process.env.OUTLOOK_SENDER_EMAIL;
          if (alertEmail && outlookClient.isConfigured()) {
            const callTime = job.callStartedAt
              ? new Date(job.callStartedAt).toLocaleString("en-US", { timeZone: "America/Chicago" })
              : "Unknown";
            await outlookClient.sendEmail({
              to: alertEmail,
              subject: `[TCDS] Transcript failed after ${attemptCount} retries — ${job.callerNumber || "Unknown"}`,
              body: [
                `A transcript job exhausted all retries without finding a recording in SQL Server.`,
                ``,
                `<b>Job ID:</b> ${job.id}`,
                `<b>Call ID:</b> ${job.callId || "N/A"}`,
                `<b>Caller:</b> ${job.callerNumber || "Unknown"}`,
                `<b>Agent Ext:</b> ${job.agentExtension || "Unknown"}`,
                `<b>Call Time:</b> ${callTime}`,
                `<b>Attempts:</b> ${attemptCount}`,
                ``,
                `This call has been queued for manual review in the wrapup queue.`,
                ``,
                `— TCDS Transcript Worker`,
              ].join("<br/>"),
              isHtml: true,
            });
            console.log(`[TranscriptWorker] Dead letter email sent for job ${job.id}`);
          }
        } catch (emailErr) {
          console.error(`[TranscriptWorker] Failed to send dead letter email:`, emailErr instanceof Error ? emailErr.message : emailErr);
        }

        // Create wrapup draft for manual review
        if (job.callId) {
          await db
            .insert(wrapupDrafts)
            .values({
              tenantId: callDetails?.tenantId || job.tenantId || process.env.DEFAULT_TENANT_ID!,
              callId: job.callId,
              status: "pending_review",
              summary: "No transcript available - requires manual review.",
              customerPhone: customerPhone || null,
              direction: (callDirection === "inbound" ? "Inbound" : "Outbound") as "Inbound" | "Outbound",
              agentExtension: job.agentExtension || null,
              matchStatus: "unmatched",
              aiProcessingStatus: "failed",
            })
            .onConflictDoUpdate({
              target: wrapupDrafts.callId,
              set: {
                status: "pending_review",
                aiProcessingStatus: "failed",
                summary: "No transcript available - requires manual review.",
                updatedAt: new Date(),
              },
            });
        }

        return { success: false, error: "Max attempts reached" };
      } else {
        // Schedule retry
        const delaySeconds = RETRY_DELAYS[attemptCount - 1] || 600;
        const nextAttempt = new Date(Date.now() + delaySeconds * 1000);

        console.log(`[TranscriptWorker] Job ${job.id} retry ${attemptCount} in ${delaySeconds}s`);

        await db
          .update(pendingTranscriptJobs)
          .set({
            attemptCount,
            nextAttemptAt: nextAttempt,
            lastAttemptAt: new Date(),
          })
          .where(eq(pendingTranscriptJobs.id, job.id));

        return { success: false, retry: true, nextAttempt };
      }
    }
  } catch (error) {
    console.error(`[TranscriptWorker] Job ${job.id} error:`, error);

    // Mark job for retry
    const attemptCount = (job.attemptCount || 0) + 1;
    const delaySeconds = RETRY_DELAYS[attemptCount - 1] || 600;
    const nextAttempt = new Date(Date.now() + delaySeconds * 1000);

    await db
      .update(pendingTranscriptJobs)
      .set({
        attemptCount,
        nextAttemptAt: nextAttempt,
        lastAttemptAt: new Date(),
        error: error instanceof Error ? error.message : "Unknown error",
      })
      .where(eq(pendingTranscriptJobs.id, job.id));

    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

// =============================================================================
// Auto-Create Service Ticket for Poll-Discovered Calls
// Mirrors the call-completed webhook's auto-ticket logic (simplified)
// =============================================================================

async function createAutoTicketForPollCall(params: {
  tenantId: string;
  callId: string;
  agentId: string | null;
  customerPhone: string | null;
  customerName: string | null;
  aiResult: AIExtractionResult;
  transcript: string;
  durationSeconds: number;
  wrapupId: string;
}): Promise<void> {
  const { tenantId, callId, agentId, customerPhone, customerName, aiResult, transcript, durationSeconds, wrapupId } = params;

  try {
    // 1. Feature flag check
    const [tenantData] = await db
      .select({ features: tenants.features })
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);

    const features = tenantData?.features as Record<string, unknown> | undefined;
    if (features?.autoCreateServiceTickets === false) {
      console.log(`[TranscriptWorker] Auto-ticket feature not enabled, skipping`);
      return;
    }

    // 2. Phone validation - skip PlayFile/test calls, but allow Unknown if we have AI data
    const callerDigits = (customerPhone || '').replace(/\D/g, '');
    const isPlayFile = customerPhone === 'PlayFile' || (customerPhone || '').toLowerCase().includes('playfile');
    const hasValidPhone = customerPhone && customerPhone !== 'Unknown' && !isPlayFile
      && callerDigits.length >= 7 && callerDigits.length <= 11;
    const hasAIData = !!(customerName || (aiResult.summary && aiResult.summary.length > 50));

    if (isPlayFile) {
      console.log(`[TranscriptWorker] Skipping ticket for PlayFile/test call`);
      return;
    }

    if (!hasValidPhone && !hasAIData) {
      console.log(`[TranscriptWorker] Skipping ticket: no valid phone (${customerPhone}) and no AI data`);
      return;
    }

    // 3. Customer lookup - search local DB by last 10 digits (skip if no valid phone)
    const phoneSuffix = callerDigits.slice(-10);
    let matchedAzCustomerId: number | null = null;
    let localCustomerId: string | null = null;

    if (hasValidPhone && phoneSuffix.length >= 7) {
      const [foundCustomer] = await db
        .select({
          id: customers.id,
          agencyzoomId: customers.agencyzoomId,
        })
        .from(customers)
        .where(
          and(
            eq(customers.tenantId, tenantId),
            or(
              ilike(customers.phone, `%${phoneSuffix}`),
              ilike(customers.phoneAlt, `%${phoneSuffix}`)
            )
          )
        )
        .limit(1);

      if (foundCustomer?.agencyzoomId) {
        matchedAzCustomerId = parseInt(foundCustomer.agencyzoomId, 10);
        localCustomerId = foundCustomer.id;
        if (isNaN(matchedAzCustomerId) || matchedAzCustomerId <= 0) {
          matchedAzCustomerId = null;
        }
      }
    }

    const azCustomerId = matchedAzCustomerId || SPECIAL_HOUSEHOLDS.NCM_PLACEHOLDER;

    // 4. CSR assignment - prefer call's agent, fallback to AI Agent
    let assignedCsrId: number = EMPLOYEE_IDS.AI_AGENT;
    let assignedCsrName = 'AI Agent';

    if (agentId) {
      try {
        const [agentData] = await db
          .select({
            firstName: users.firstName,
            lastName: users.lastName,
            agencyzoomId: users.agencyzoomId,
          })
          .from(users)
          .where(eq(users.id, agentId))
          .limit(1);

        if (agentData?.agencyzoomId) {
          const azCsrId = parseInt(agentData.agencyzoomId, 10);
          if (!isNaN(azCsrId) && azCsrId > 0) {
            assignedCsrId = azCsrId;
            assignedCsrName = `${agentData.firstName || ''} ${agentData.lastName || ''}`.trim() || 'Agent';
          }
        }
      } catch (agentLookupError) {
        console.error(`[TranscriptWorker] Failed to look up agent CSR ID, using AI Agent:`, agentLookupError);
      }
    }

    // 5. Build subject from summary
    let callReason = aiResult.summary || '';
    const firstSentenceEnd = callReason.search(/[.!?]/);
    if (firstSentenceEnd > 0 && firstSentenceEnd < 80) {
      callReason = callReason.substring(0, firstSentenceEnd);
    } else if (callReason.length > 60) {
      callReason = callReason.substring(0, 60).replace(/\s+\S*$/, '');
    }
    callReason = callReason.trim().replace(/^(the\s+)?(caller\s+)?(called\s+)?(about\s+)?/i, '');
    if (!callReason || callReason.length < 5) {
      callReason = aiResult.requestType || 'general inquiry';
    }

    const isNCMTicket = !matchedAzCustomerId;
    const subjectSuffix = isNCMTicket
      ? ` - ${customerName || customerPhone || 'Unknown Caller'}`
      : '';
    const ticketSubject = `Inbound Call: ${callReason}${subjectSuffix}`;

    // 6. Build description
    const ticketDescription = formatInboundCallDescription({
      summary: aiResult.summary,
      actionItems: aiResult.actionItems,
      extractedData: {
        customerName: customerName || undefined,
        policyNumber: aiResult.policyNumbers.length > 0 ? aiResult.policyNumbers.join(', ') : undefined,
      },
      callerPhone: customerPhone || undefined,
      customerName: customerName || undefined,
      durationSeconds,
      transcript: transcript || undefined,
      isNCM: !matchedAzCustomerId,
    });

    // 7. Deduplication - check if ticket already exists for this wrapup
    const [existingTicket] = await db
      .select({ id: serviceTickets.id, azTicketId: serviceTickets.azTicketId })
      .from(serviceTickets)
      .where(eq(serviceTickets.wrapupDraftId, wrapupId))
      .limit(1);

    if (existingTicket) {
      console.log(`[TranscriptWorker] Ticket already exists for wrapup ${wrapupId} (AZ#${existingTicket.azTicketId}), skipping`);
      return;
    }

    // Also check if wrapup already has a ticket ID (set by webhook path)
    const [currentWrapup] = await db
      .select({ agencyzoomTicketId: wrapupDrafts.agencyzoomTicketId, status: wrapupDrafts.status })
      .from(wrapupDrafts)
      .where(eq(wrapupDrafts.id, wrapupId))
      .limit(1);

    if (currentWrapup?.agencyzoomTicketId) {
      console.log(`[TranscriptWorker] Wrapup ${wrapupId} already has ticket AZ#${currentWrapup.agencyzoomTicketId}, skipping`);
      return;
    }

    // Phone-based dedup: check if a ticket was already created for this phone in the last hour
    // This catches cross-wrapup duplicates where the webhook and SQL poll created separate wrapups
    if (hasValidPhone && phoneSuffix.length >= 7) {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const [recentPhoneTicket] = await db
        .select({ id: serviceTickets.id, azTicketId: serviceTickets.azTicketId, subject: serviceTickets.subject })
        .from(serviceTickets)
        .innerJoin(wrapupDrafts, eq(serviceTickets.wrapupDraftId, wrapupDrafts.id))
        .where(
          and(
            eq(serviceTickets.tenantId, tenantId),
            gte(serviceTickets.createdAt, oneHourAgo),
            ilike(wrapupDrafts.customerPhone, `%${phoneSuffix}`)
          )
        )
        .limit(1);

      if (recentPhoneTicket) {
        console.log(`[TranscriptWorker] Recent ticket already exists for phone ${phoneSuffix} (AZ#${recentPhoneTicket.azTicketId}: ${recentPhoneTicket.subject?.slice(0, 50)}), skipping duplicate`);
        return;
      }
    }

    // 8. Create ticket via AgencyZoom API
    const categoryId = SERVICE_CATEGORIES.GENERAL_SERVICE;
    const azClient = getAgencyZoomClient();
    const ticketResult = await azClient.createServiceTicket({
      subject: ticketSubject,
      description: ticketDescription,
      customerId: azCustomerId,
      pipelineId: SERVICE_PIPELINES.POLICY_SERVICE,
      stageId: PIPELINE_STAGES.POLICY_SERVICE_NEW,
      priorityId: SERVICE_PRIORITIES.STANDARD,
      categoryId: categoryId,
      csrId: assignedCsrId,
      dueDate: getDefaultDueDate(),
    });

    if (ticketResult.success || ticketResult.serviceTicketId) {
      const azTicketId = ticketResult.serviceTicketId;
      console.log(`[TranscriptWorker] Service ticket created: ${azTicketId} (assigned to ${assignedCsrName})`);

      // 8. Store ticket locally
      if (typeof azTicketId === 'number' && azTicketId > 0) {
        try {
          await db.insert(serviceTickets).values({
            tenantId,
            azTicketId: azTicketId,
            azHouseholdId: azCustomerId,
            wrapupDraftId: wrapupId,
            customerId: localCustomerId,
            subject: ticketSubject,
            description: ticketDescription,
            status: 'active',
            pipelineId: SERVICE_PIPELINES.POLICY_SERVICE,
            pipelineName: 'Policy Service',
            stageId: PIPELINE_STAGES.POLICY_SERVICE_NEW,
            stageName: 'New',
            categoryId: categoryId,
            categoryName: 'General Service',
            priorityId: SERVICE_PRIORITIES.STANDARD,
            priorityName: 'Standard',
            csrId: assignedCsrId,
            csrName: assignedCsrName,
            dueDate: getDefaultDueDate(),
            azCreatedAt: new Date(),
            source: 'mssql_poll',
            lastSyncedFromAz: new Date(),
          });
          console.log(`[TranscriptWorker] Ticket stored locally`);
        } catch (localDbError) {
          console.error(`[TranscriptWorker] Failed to store ticket locally:`, localDbError);
        }
      }

      // 9. Update wrapup - mark completed with ticket
      try {
        await db
          .update(wrapupDrafts)
          .set({
            status: 'completed',
            outcome: 'ticket',
            agencyzoomTicketId: azTicketId?.toString() || null,
            completedAt: new Date(),
          })
          .where(eq(wrapupDrafts.id, wrapupId));
        console.log(`[TranscriptWorker] Wrapup ${wrapupId} marked completed (auto-ticket created)`);
      } catch (wrapupUpdateError) {
        console.error(`[TranscriptWorker] Failed to mark wrapup completed:`, wrapupUpdateError);
      }
    } else {
      console.error(`[TranscriptWorker] Failed to create service ticket:`, ticketResult);
    }
  } catch (error) {
    console.error(`[TranscriptWorker] Auto-ticket creation failed for call ${callId}:`, error instanceof Error ? error.message : error);
  }
}

// =============================================================================
// Cleanup Stale Calls — Complete abandoned "active" calls stuck without dialog
// =============================================================================

async function cleanupStaleCalls(): Promise<number> {
  const tenantId = process.env.DEFAULT_TENANT_ID;
  if (!tenantId) return 0;

  const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);

  // Find calls stuck in active/in_progress state for > 30 minutes with no duration
  const staleCalls = await db
    .select({
      id: calls.id,
      extension: calls.extension,
      fromNumber: calls.fromNumber,
      externalNumber: calls.externalNumber,
      createdAt: calls.createdAt,
    })
    .from(calls)
    .where(
      and(
        eq(calls.tenantId, tenantId),
        or(
          eq(calls.transcriptionStatus, "active"),
          eq(calls.status, "in_progress"),
        ),
        lte(calls.createdAt, thirtyMinutesAgo),
        sql`${calls.durationSeconds} IS NULL`,
      )
    )
    .limit(20);

  if (staleCalls.length === 0) return 0;

  console.log(`[TranscriptWorker] Found ${staleCalls.length} stale call(s) to clean up`);

  let cleaned = 0;
  for (const stale of staleCalls) {
    // Mark call as completed
    await db
      .update(calls)
      .set({
        status: "completed",
        transcriptionStatus: "failed",
        transcriptionError: "stale_cleanup",
        endedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(calls.id, stale.id));

    // Queue a transcript job — MSSQL may have the recording
    const nextAttemptAt = new Date(Date.now() + 30 * 1000);
    await db
      .insert(pendingTranscriptJobs)
      .values({
        tenantId,
        callId: stale.id,
        callerNumber: stale.externalNumber || stale.fromNumber || null,
        agentExtension: stale.extension || null,
        callStartedAt: stale.createdAt || new Date(),
        callEndedAt: new Date(),
        status: "pending",
        nextAttemptAt,
        attemptCount: 0,
      })
      .catch(() => {});

    console.log(`[TranscriptWorker] Cleaned up stale call ${stale.id.slice(0, 8)} (ext=${stale.extension})`);
    cleaned++;
  }
  return cleaned;
}

// =============================================================================
// Poll SQL Server for Missed Calls (catches outbound calls not in webhook flow)
// =============================================================================

async function pollSQLForMissedCalls(): Promise<{ found: number; processed: number }> {
  const tenantId = process.env.DEFAULT_TENANT_ID;
  if (!tenantId) return { found: 0, processed: 0 };

  try {
    const mssqlClient = await getMSSQLTranscriptsClient();
    if (!mssqlClient) {
      console.log("[TranscriptWorker] MSSQL client not available for polling");
      return { found: 0, processed: 0 };
    }

    // Get transcripts from the last 2 hours
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const { records } = await mssqlClient.searchTranscripts({
      startDate: twoHoursAgo,
      limit: 50,
    });
    await mssqlClient.close();

    if (records.length === 0) {
      return { found: 0, processed: 0 };
    }

    console.log(`[TranscriptWorker] Found ${records.length} recent SQL transcripts to check`);

    // Get existing wrapups with SQL record IDs
    const existingWrapups = await db
      .select({ aiExtraction: wrapupDrafts.aiExtraction })
      .from(wrapupDrafts)
      .where(eq(wrapupDrafts.tenantId, tenantId));

    const existingSqlIds = new Set<string>();
    for (const w of existingWrapups) {
      const extraction = w.aiExtraction as { sqlRecordId?: string } | null;
      if (extraction?.sqlRecordId) {
        existingSqlIds.add(extraction.sqlRecordId);
      }
    }

    // Find transcripts without wrapups (by sqlRecordId)
    let missedTranscripts = records.filter(r => !existingSqlIds.has(r.id));

    if (missedTranscripts.length === 0) {
      return { found: records.length, processed: 0 };
    }

    // Secondary deduplication: check for existing calls with matching phone + timestamp
    // This catches calls already processed by the webhook (which don't have sqlRecordId)
    const furtherFiltered: typeof missedTranscripts = [];
    for (const transcript of missedTranscripts) {
      const customerPhone = transcript.direction === "inbound"
        ? transcript.callerNumber
        : transcript.calledNumber;
      const phoneSuffix = (customerPhone || '').replace(/\D/g, '').slice(-10);

      if (phoneSuffix.length >= 7) {
        // Check if a call already exists from this phone within ±15 minutes of the recording
        // (SQL Server recording timestamps can drift significantly from webhook call times)
        const windowMs = 15 * 60 * 1000;
        const windowStart = new Date(transcript.recordingDate.getTime() - windowMs);
        const windowEnd = new Date(transcript.recordingDate.getTime() + windowMs);

        const [existingCall] = await db
          .select({ id: calls.id })
          .from(calls)
          .where(
            and(
              eq(calls.tenantId, tenantId),
              gte(calls.startedAt, windowStart),
              lte(calls.startedAt, windowEnd),
              or(
                sql`${calls.fromNumber} LIKE ${'%' + phoneSuffix}`,
                sql`${calls.toNumber} LIKE ${'%' + phoneSuffix}`,
                sql`${calls.externalNumber} LIKE ${'%' + phoneSuffix}`
              )
            )
          )
          .limit(1);

        if (existingCall) {
          console.log(`[TranscriptWorker] Call already exists for ${phoneSuffix} at ${transcript.recordingDate.toISOString()} (call ${existingCall.id.slice(0, 8)}), skipping SQL record ${transcript.id}`);
          continue;
        }
      }

      // Also check by extension + time window (catches calls with "Unknown" phone from 3CX WebSocket)
      if (transcript.extension) {
        const windowMs = 15 * 60 * 1000;
        const windowStart = new Date(transcript.recordingDate.getTime() - windowMs);
        const windowEnd = new Date(transcript.recordingDate.getTime() + windowMs);

        const [extMatch] = await db
          .select({ id: calls.id, fromNumber: calls.fromNumber })
          .from(calls)
          .where(
            and(
              eq(calls.tenantId, tenantId),
              eq(calls.extension, transcript.extension),
              gte(calls.startedAt, windowStart),
              lte(calls.startedAt, windowEnd),
            )
          )
          .limit(1);

        if (extMatch) {
          // Enrich the existing call with the real phone from MSSQL
          const customerPhone = transcript.direction === "inbound"
            ? transcript.callerNumber
            : transcript.calledNumber;
          const realPhone = (customerPhone || '').replace(/\D/g, '');
          if (extMatch.fromNumber === "Unknown" && realPhone.length >= 7) {
            await db.update(calls).set({
              fromNumber: customerPhone,
              externalNumber: customerPhone,
              updatedAt: new Date(),
            }).where(eq(calls.id, extMatch.id));
            console.log(`[TranscriptWorker] Enriched call ${extMatch.id.slice(0, 8)} with phone ${customerPhone} from MSSQL`);
          }

          // Check if this call already has a wrapup with completed AI processing
          const [existingWrapup] = await db
            .select({ id: wrapupDrafts.id, aiProcessingStatus: wrapupDrafts.aiProcessingStatus })
            .from(wrapupDrafts)
            .where(eq(wrapupDrafts.callId, extMatch.id))
            .limit(1);

          if (existingWrapup && existingWrapup.aiProcessingStatus === "completed") {
            console.log(`[TranscriptWorker] Call exists with completed wrapup for ${transcript.extension} (call ${extMatch.id.slice(0, 8)}), skipping SQL record ${transcript.id}`);
            continue;
          }

          // Call exists but has no wrapup (or wrapup has failed AI) — process the transcript
          console.log(`[TranscriptWorker] Call ${extMatch.id.slice(0, 8)} exists but needs wrapup — processing SQL record ${transcript.id}`);

          // Store transcript on call record
          await db.update(calls).set({
            transcription: transcript.transcript,
            transcriptionStatus: "completed",
            directionFinal: transcript.direction as "inbound" | "outbound",
            updatedAt: new Date(),
          }).where(eq(calls.id, extMatch.id));

          // Run AI extraction
          const aiResult = await extractCallDataWithAI(transcript.transcript, {
            direction: transcript.direction,
            agentExtension: transcript.extension,
            callerNumber: transcript.callerNumber,
            duration: transcript.duration,
          });

          if (aiResult.isHangup) {
            console.log(`[TranscriptWorker] Hangup detected for call ${extMatch.id.slice(0, 8)}, skipping wrapup`);
            continue;
          }

          // Update call with AI results
          await db.update(calls).set({
            aiSummary: aiResult.summary,
            aiActionItems: aiResult.actionItems,
            aiSentiment: { overall: aiResult.sentiment, score: 0, timeline: [] },
            aiTopics: aiResult.topics,
            updatedAt: new Date(),
          }).where(eq(calls.id, extMatch.id));

          // Create/update wrapup
          const resolvedPhone = realPhone.length >= 7 ? customerPhone : extMatch.fromNumber;
          const [wrapup] = await db
            .insert(wrapupDrafts)
            .values({
              tenantId,
              callId: extMatch.id,
              status: "pending_review" as const,
              summary: aiResult.summary,
              customerName: aiResult.customerName,
              customerPhone: resolvedPhone || null,
              policyNumbers: aiResult.policyNumbers,
              insuranceType: aiResult.insuranceType,
              requestType: aiResult.requestType,
              direction: (transcript.direction === "inbound" ? "Inbound" : "Outbound") as "Inbound" | "Outbound",
              agentExtension: transcript.extension || null,
              matchStatus: "unmatched",
              aiExtraction: {
                ...aiResult,
                transcriptSource: "mssql_poll_enriched",
                sqlRecordId: transcript.id,
                polledAt: new Date().toISOString(),
              },
              aiProcessingStatus: "completed",
              aiProcessedAt: new Date(),
            })
            .onConflictDoUpdate({
              target: wrapupDrafts.callId,
              set: {
                summary: aiResult.summary,
                customerName: aiResult.customerName,
                customerPhone: resolvedPhone || null,
                aiExtraction: {
                  ...aiResult,
                  transcriptSource: "mssql_poll_enriched",
                  sqlRecordId: transcript.id,
                  polledAt: new Date().toISOString(),
                },
                aiProcessingStatus: "completed",
                aiProcessedAt: new Date(),
                status: "pending_review",
                updatedAt: new Date(),
              },
            })
            .returning({ id: wrapupDrafts.id });

          console.log(`[TranscriptWorker] Created wrapup ${wrapup.id} for existing call ${extMatch.id.slice(0, 8)} from MSSQL poll`);

          // Auto-create service ticket for inbound calls
          if (transcript.direction === "inbound" && wrapup?.id) {
            try {
              const [agent] = transcript.extension ? await db
                .select({ id: users.id })
                .from(users)
                .where(eq(users.extension, transcript.extension))
                .limit(1) : [];

              await createAutoTicketForPollCall({
                tenantId,
                callId: extMatch.id,
                agentId: agent?.id || null,
                customerPhone: resolvedPhone || null,
                customerName: aiResult.customerName || null,
                aiResult,
                transcript: transcript.transcript,
                wrapupId: wrapup.id,
                durationSeconds: parseDuration(transcript.duration),
              });
            } catch (ticketError) {
              console.error(`[TranscriptWorker] Failed to create auto-ticket for enriched call:`, ticketError instanceof Error ? ticketError.message : ticketError);
            }
          }

          continue;
        }
      }

      furtherFiltered.push(transcript);
    }

    missedTranscripts = furtherFiltered;

    if (missedTranscripts.length === 0) {
      console.log(`[TranscriptWorker] All missed transcripts already have matching calls, nothing to process`);
      return { found: records.length, processed: 0 };
    }

    console.log(`[TranscriptWorker] Found ${missedTranscripts.length} missed calls to process`);

    let processed = 0;
    for (const transcript of missedTranscripts) {
      try {
        // Determine customer phone based on direction
        const customerPhone = transcript.direction === "inbound"
          ? transcript.callerNumber
          : transcript.calledNumber;

        // Run AI extraction
        const aiResult = await extractCallDataWithAI(transcript.transcript, {
          direction: transcript.direction,
          agentExtension: transcript.extension,
          callerNumber: transcript.callerNumber,
          duration: transcript.duration,
        });

        // Skip hangups
        if (aiResult.isHangup) {
          console.log(`[TranscriptWorker] Skipping hangup call from SQL: ${transcript.id}`);
          continue;
        }

        // Look up agent by extension
        const [agent] = transcript.extension ? await db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.extension, transcript.extension))
          .limit(1) : [];

        // Create a real call record for this missed call
        const isOutbound = transcript.direction === "outbound";
        const [newCall] = await db
          .insert(calls)
          .values({
            tenantId,
            direction: isOutbound ? "outbound" : "inbound",
            status: "completed",
            fromNumber: isOutbound ? transcript.extension : transcript.callerNumber,
            toNumber: isOutbound ? transcript.calledNumber : transcript.extension,
            externalNumber: customerPhone,
            agentId: agent?.id || null,
            extension: transcript.extension,
            transcription: transcript.transcript,
            transcriptionStatus: "completed",
            startedAt: transcript.recordingDate,
            answeredAt: transcript.recordingDate,
            endedAt: new Date(transcript.recordingDate.getTime() + parseDuration(transcript.duration) * 1000),
            durationSeconds: parseDuration(transcript.duration),
            aiSummary: aiResult.summary,
            aiActionItems: aiResult.actionItems,
            aiSentiment: { overall: aiResult.sentiment, score: 0, timeline: [] },
            aiTopics: aiResult.topics,
          })
          .returning();

        console.log(`[TranscriptWorker] Created call record ${newCall.id} from SQL poll (${transcript.direction})`);

        // Create wrapup draft linked to the real call
        const wrapupValues = {
          tenantId,
          callId: newCall.id, // Use real call ID
          status: "pending_review" as const,
          summary: aiResult.summary,
          customerName: aiResult.customerName,
          customerPhone: customerPhone || null,
          policyNumbers: aiResult.policyNumbers,
          insuranceType: aiResult.insuranceType,
          requestType: aiResult.requestType,
          direction: (transcript.direction === "inbound" ? "Inbound" : "Outbound") as "Inbound" | "Outbound",
          agentExtension: transcript.extension || null,
          matchStatus: "unmatched",
          aiExtraction: {
            ...aiResult,
            transcriptSource: "mssql_poll",
            sqlRecordId: transcript.id,
            polledAt: new Date().toISOString(),
          },
          aiProcessingStatus: "completed",
          aiProcessedAt: new Date(),
        };

        const [wrapup] = await db
          .insert(wrapupDrafts)
          .values(wrapupValues)
          .onConflictDoUpdate({
            target: wrapupDrafts.callId,
            set: {
              summary: wrapupValues.summary,
              customerName: wrapupValues.customerName,
              aiExtraction: wrapupValues.aiExtraction,
              aiProcessingStatus: wrapupValues.aiProcessingStatus,
              aiProcessedAt: wrapupValues.aiProcessedAt,
            },
          })
          .returning({ id: wrapupDrafts.id });

        console.log(`[TranscriptWorker] Created wrapup from SQL poll: ${transcript.id} (${transcript.direction})`);

        // Auto-create service ticket for inbound calls
        if (transcript.direction === "inbound" && wrapup?.id) {
          await createAutoTicketForPollCall({
            tenantId,
            callId: newCall.id,
            agentId: agent?.id || null,
            customerPhone,
            customerName: aiResult.customerName,
            aiResult,
            transcript: transcript.transcript,
            durationSeconds: parseDuration(transcript.duration),
            wrapupId: wrapup.id,
          });
        }

        // Outbound calls: auto-match + post note + complete (no ticket)
        if (transcript.direction === "outbound" && wrapup?.id && customerPhone) {
          try {
            const phoneSuffix = customerPhone.replace(/\D/g, '').slice(-10);
            const [foundCustomer] = phoneSuffix.length >= 7 ? await db
              .select({ id: customers.id, agencyzoomId: customers.agencyzoomId })
              .from(customers)
              .where(
                and(
                  eq(customers.tenantId, tenantId),
                  or(
                    ilike(customers.phone, `%${phoneSuffix}`),
                    ilike(customers.phoneAlt, `%${phoneSuffix}`)
                  )
                )
              )
              .limit(1) : [];

            if (foundCustomer?.agencyzoomId) {
              const azCustomerId = parseInt(foundCustomer.agencyzoomId, 10);
              if (!isNaN(azCustomerId) && azCustomerId > 0) {
                // Post note to AgencyZoom
                const azClient = getAgencyZoomClient();
                const now = new Date();
                const formattedDate = now.toLocaleDateString("en-US", { month: "numeric", day: "numeric", year: "numeric" });
                const formattedTime = now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
                const agentName = agent ? transcript.extension || "Agent" : "Unknown Agent";
                const noteText = `📞 Outbound Call - ${formattedDate} ${formattedTime}\n\n${aiResult.summary}\n\nAgent: ${agentName}`;
                const noteResult = await azClient.addNote(azCustomerId, noteText);

                await db.update(wrapupDrafts).set({
                  status: "completed",
                  matchStatus: "matched",
                  noteAutoPosted: noteResult.success || false,
                  noteAutoPostedAt: noteResult.success ? now : undefined,
                  completionAction: noteResult.success ? "posted" : "auto_completed",
                  completedAt: now,
                  agencyzoomNoteId: noteResult.id?.toString() || null,
                }).where(eq(wrapupDrafts.id, wrapup.id));

                // Link customer to call
                await db.update(calls).set({ customerId: foundCustomer.id }).where(eq(calls.id, newCall.id));
                console.log(`[TranscriptWorker] Outbound call: matched + note posted to AZ customer ${azCustomerId}`);
              } else {
                // Matched but no valid AZ ID - auto-complete
                await db.update(wrapupDrafts).set({
                  status: "completed",
                  completionAction: "auto_completed",
                  completedAt: new Date(),
                  autoVoidReason: "outbound_unmatched",
                }).where(eq(wrapupDrafts.id, wrapup.id));
                console.log(`[TranscriptWorker] Outbound call: customer found but no AZ ID, auto-completed`);
              }
            } else {
              // No match - auto-complete outbound wrapup
              await db.update(wrapupDrafts).set({
                status: "completed",
                completionAction: "auto_completed",
                completedAt: new Date(),
                autoVoidReason: "outbound_unmatched",
              }).where(eq(wrapupDrafts.id, wrapup.id));
              console.log(`[TranscriptWorker] Outbound call: no customer match, auto-completed`);
            }
          } catch (outboundErr) {
            // Non-fatal - at worst the wrapup stays pending_review
            console.error(`[TranscriptWorker] Outbound auto-post failed:`, outboundErr);
          }
        }

        processed++;
      } catch (err) {
        console.error(`[TranscriptWorker] Error processing SQL transcript ${transcript.id}:`, err);
      }
    }

    return { found: records.length, processed };
  } catch (error) {
    console.error("[TranscriptWorker] SQL poll error:", error);
    return { found: 0, processed: 0 };
  }
}

// =============================================================================
// Auto-Complete Pending Wrapup Drafts
// Catches wrapups where auto-completion failed or was skipped
// =============================================================================

function shouldDismissWrapup(wrapup: {
  requestType: string | null;
  summary: string | null;
  customerPhone: string | null;
  agentExtension: string | null;
  aiExtraction: unknown;
}): boolean {
  // Hangup or short call
  if (wrapup.requestType === 'hangup' || wrapup.requestType === 'short_call') {
    return true;
  }

  // PlayFile / system test
  if (
    wrapup.customerPhone === 'PlayFile' ||
    wrapup.customerPhone?.toLowerCase().includes('playfile')
  ) {
    return true;
  }

  // Internal call: both sides are short extensions (< 5 digits)
  const custDigits = (wrapup.customerPhone || '').replace(/\D/g, '');
  const agentDigits = (wrapup.agentExtension || '').replace(/\D/g, '');
  if (custDigits.length > 0 && custDigits.length < 5 && agentDigits.length > 0 && agentDigits.length < 5) {
    return true;
  }

  // No summary or very short (no real content)
  if (!wrapup.summary || wrapup.summary.length < 15) {
    return true;
  }

  // Voicemail indicators
  const lower = wrapup.summary.toLowerCase();
  const vmIndicators = [
    'left a voicemail',
    'left a voice mail',
    'voicemail was left',
    'went to voicemail',
    'reached voicemail',
    'mailbox is full',
    'not available',
    'no answer',
    'agent left a message',
    'left a message for',
    'left a message regarding',
    'left a message about',
  ];
  if (vmIndicators.some(v => lower.includes(v))) {
    return true;
  }

  // AI flagged as hangup
  const extraction = wrapup.aiExtraction as { isHangup?: boolean } | null;
  if (extraction?.isHangup) {
    return true;
  }

  return false;
}

function getDismissReason(wrapup: {
  requestType: string | null;
  summary: string | null;
  customerPhone: string | null;
  agentExtension: string | null;
  aiExtraction: unknown;
}): string {
  if (wrapup.requestType === 'hangup') return 'hangup';
  if (wrapup.requestType === 'short_call') return 'short_call';
  if (wrapup.customerPhone === 'PlayFile' || wrapup.customerPhone?.toLowerCase().includes('playfile')) return 'playfile';

  const custDigits = (wrapup.customerPhone || '').replace(/\D/g, '');
  const agentDigits = (wrapup.agentExtension || '').replace(/\D/g, '');
  if (custDigits.length > 0 && custDigits.length < 5 && agentDigits.length > 0 && agentDigits.length < 5) return 'internal_call';

  if (!wrapup.summary || wrapup.summary.length < 15) return 'no_content';

  const lower = (wrapup.summary || '').toLowerCase();
  if (lower.includes('voicemail') || lower.includes('voice mail') || lower.includes('mailbox')) return 'voicemail';
  if (lower.includes('not available') || lower.includes('no answer')) return 'no_answer';
  if (lower.includes('left a message for') || lower.includes('left a message regarding') || lower.includes('left a message about')) return 'voicemail';

  const extraction = wrapup.aiExtraction as { isHangup?: boolean } | null;
  if (extraction?.isHangup) return 'hangup';

  return 'auto_dismissed';
}

async function autoCompletePendingWrapups(): Promise<number> {
  const tenantId = process.env.DEFAULT_TENANT_ID!;
  const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);

  // Find pending_review wrapups older than 2 min (give webhook time to auto-complete first)
  const pending = await db.select({
    id: wrapupDrafts.id,
    callId: wrapupDrafts.callId,
    direction: wrapupDrafts.direction,
    customerPhone: wrapupDrafts.customerPhone,
    customerName: wrapupDrafts.customerName,
    summary: wrapupDrafts.summary,
    requestType: wrapupDrafts.requestType,
    agentExtension: wrapupDrafts.agentExtension,
    agentName: wrapupDrafts.agentName,
    aiExtraction: wrapupDrafts.aiExtraction,
    agencyzoomTicketId: wrapupDrafts.agencyzoomTicketId,
    createdAt: wrapupDrafts.createdAt,
  })
  .from(wrapupDrafts)
  .where(and(
    eq(wrapupDrafts.tenantId, tenantId),
    eq(wrapupDrafts.status, "pending_review"),
    lte(wrapupDrafts.createdAt, twoMinutesAgo),
  ))
  .orderBy(asc(wrapupDrafts.createdAt))
  .limit(10); // Process 10 per cycle to stay within Vercel timeout

  if (pending.length === 0) return 0;

  console.log(`[TranscriptWorker] Found ${pending.length} pending wrapup(s) to auto-complete`);

  let completed = 0;
  for (const wrapup of pending) {
    try {
      // Skip if already has a ticket (race condition guard)
      if (wrapup.agencyzoomTicketId) {
        await db.update(wrapupDrafts).set({
          status: 'completed',
          completionAction: 'auto_completed',
          completedAt: new Date(),
          updatedAt: new Date(),
        }).where(eq(wrapupDrafts.id, wrapup.id));
        console.log(`[TranscriptWorker] Wrapup ${wrapup.id.slice(0, 8)} already has ticket, marking completed`);
        completed++;
        continue;
      }

      // Check if this is an old backlog wrapup (> 1 hour) — just clear it, don't create tickets/notes
      const ageMs = Date.now() - new Date(wrapup.createdAt).getTime();
      const isOldBacklog = ageMs > 60 * 60 * 1000; // 1 hour

      if (shouldDismissWrapup(wrapup)) {
        const reason = getDismissReason(wrapup);
        const isInbound = wrapup.direction === 'Inbound' || wrapup.direction === 'inbound';
        const isVoicemailDismiss = reason === 'voicemail' || reason === 'no_answer';

        if (isInbound && isVoicemailDismiss) {
          // Inbound voicemails = customer left a message for the agency → create ticket like any inbound call
          console.log(`[TranscriptWorker] Wrapup ${wrapup.id.slice(0, 8)} is inbound voicemail — routing to ticket creation`);
          await autoCompleteInboundWrapup(wrapup, tenantId);
        } else {
          // Auto-dismiss: hangup, outbound voicemail, internal, PlayFile, etc.
          await db.update(wrapupDrafts).set({
            status: 'completed',
            isAutoVoided: true,
            autoVoidReason: reason,
            completionAction: 'skipped',
            completedAt: new Date(),
            updatedAt: new Date(),
          }).where(eq(wrapupDrafts.id, wrapup.id));
          console.log(`[TranscriptWorker] Wrapup ${wrapup.id.slice(0, 8)} auto-dismissed: ${reason}`);
        }
      } else if (isOldBacklog) {
        // Old backlog — just clear without AZ actions
        await db.update(wrapupDrafts).set({
          status: 'completed',
          completionAction: 'auto_completed',
          autoVoidReason: 'backlog_cleared',
          completedAt: new Date(),
          updatedAt: new Date(),
        }).where(eq(wrapupDrafts.id, wrapup.id));
        console.log(`[TranscriptWorker] Wrapup ${wrapup.id.slice(0, 8)} backlog cleared (${Math.round(ageMs / 3600000)}h old)`);
      } else if (wrapup.direction === 'Inbound' || wrapup.direction === 'inbound') {
        await autoCompleteInboundWrapup(wrapup, tenantId);
      } else {
        await autoCompleteOutboundWrapup(wrapup, tenantId);
      }
      completed++;
    } catch (err) {
      console.error(`[TranscriptWorker] Failed to auto-complete wrapup ${wrapup.id.slice(0, 8)}:`, err instanceof Error ? err.message : err);
    }
  }

  return completed;
}

async function autoCompleteInboundWrapup(
  wrapup: {
    id: string;
    callId: string;
    customerPhone: string | null;
    customerName: string | null;
    summary: string | null;
    aiExtraction: unknown;
  },
  tenantId: string,
): Promise<void> {
  // Get call details for agent info + transcript
  const [callData] = await db.select({
    agentId: calls.agentId,
    durationSeconds: calls.durationSeconds,
    transcription: calls.transcription,
  }).from(calls).where(eq(calls.id, wrapup.callId)).limit(1);

  const extraction = wrapup.aiExtraction as AIExtractionResult | null;
  const aiResult: AIExtractionResult = extraction || {
    customerName: wrapup.customerName,
    policyNumbers: [],
    insuranceType: 'unknown',
    requestType: 'general_inquiry',
    summary: wrapup.summary || 'Inbound call - no transcript available',
    actionItems: [],
    sentiment: 'neutral',
    topics: [],
    isHangup: false,
  };

  // Reuse createAutoTicketForPollCall which handles customer lookup, ticket creation, dedup
  await createAutoTicketForPollCall({
    tenantId,
    callId: wrapup.callId,
    agentId: callData?.agentId || null,
    customerPhone: wrapup.customerPhone,
    customerName: wrapup.customerName,
    aiResult,
    transcript: callData?.transcription || wrapup.summary || '',
    durationSeconds: callData?.durationSeconds || 0,
    wrapupId: wrapup.id,
  });

  // If createAutoTicketForPollCall succeeded, the wrapup is already marked completed.
  // If it returned early (dedup, feature flag off, etc.), ensure we still complete it.
  const [current] = await db.select({ status: wrapupDrafts.status })
    .from(wrapupDrafts).where(eq(wrapupDrafts.id, wrapup.id)).limit(1);

  if (current?.status === 'pending_review') {
    await db.update(wrapupDrafts).set({
      status: 'completed',
      completionAction: 'auto_completed',
      completedAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(wrapupDrafts.id, wrapup.id));
    console.log(`[TranscriptWorker] Inbound wrapup ${wrapup.id.slice(0, 8)} auto-completed (no ticket created)`);
  }
}

async function autoCompleteOutboundWrapup(
  wrapup: {
    id: string;
    callId: string;
    customerPhone: string | null;
    customerName: string | null;
    summary: string | null;
    agentExtension: string | null;
    agentName: string | null;
    aiExtraction: unknown;
  },
  tenantId: string,
): Promise<void> {
  const customerPhone = wrapup.customerPhone;
  if (!customerPhone) {
    await db.update(wrapupDrafts).set({
      status: 'completed',
      completionAction: 'auto_completed',
      completedAt: new Date(),
      autoVoidReason: 'outbound_unmatched',
      updatedAt: new Date(),
    }).where(eq(wrapupDrafts.id, wrapup.id));
    console.log(`[TranscriptWorker] Outbound wrapup ${wrapup.id.slice(0, 8)} auto-completed (no phone)`);
    return;
  }

  const phoneSuffix = customerPhone.replace(/\D/g, '').slice(-10);
  if (phoneSuffix.length < 7) {
    await db.update(wrapupDrafts).set({
      status: 'completed',
      completionAction: 'auto_completed',
      completedAt: new Date(),
      autoVoidReason: 'outbound_unmatched',
      updatedAt: new Date(),
    }).where(eq(wrapupDrafts.id, wrapup.id));
    console.log(`[TranscriptWorker] Outbound wrapup ${wrapup.id.slice(0, 8)} auto-completed (short phone)`);
    return;
  }

  // Customer lookup
  const [foundCustomer] = await db.select({
    id: customers.id,
    agencyzoomId: customers.agencyzoomId,
  }).from(customers).where(
    and(
      eq(customers.tenantId, tenantId),
      or(
        ilike(customers.phone, `%${phoneSuffix}`),
        ilike(customers.phoneAlt, `%${phoneSuffix}`)
      )
    )
  ).limit(1);

  if (foundCustomer?.agencyzoomId) {
    const azCustomerId = parseInt(foundCustomer.agencyzoomId, 10);
    if (!isNaN(azCustomerId) && azCustomerId > 0) {
      // Post note to AgencyZoom
      try {
        const azClient = getAgencyZoomClient();
        const now = new Date();
        const formattedDate = now.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' });
        const formattedTime = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
        const agentLabel = wrapup.agentName || wrapup.agentExtension || 'Agent';

        const extraction = wrapup.aiExtraction as AIExtractionResult | null;
        const summaryText = extraction?.summary || wrapup.summary || 'Outbound call';

        const noteText = `📞 Outbound Call - ${formattedDate} ${formattedTime}\n\n${summaryText}\n\nAgent: ${agentLabel}`;
        const noteResult = await azClient.addNote(azCustomerId, noteText);

        await db.update(wrapupDrafts).set({
          status: 'completed',
          matchStatus: 'matched',
          noteAutoPosted: noteResult.success || false,
          noteAutoPostedAt: noteResult.success ? now : undefined,
          completionAction: noteResult.success ? 'posted' : 'auto_completed',
          completedAt: now,
          agencyzoomNoteId: noteResult.id?.toString() || null,
          updatedAt: now,
        }).where(eq(wrapupDrafts.id, wrapup.id));

        // Link customer to call
        await db.update(calls).set({ customerId: foundCustomer.id }).where(eq(calls.id, wrapup.callId));
        console.log(`[TranscriptWorker] Outbound wrapup ${wrapup.id.slice(0, 8)} auto-completed: note posted to AZ#${azCustomerId}`);
      } catch (noteErr) {
        // Note posting failed - still complete the wrapup
        await db.update(wrapupDrafts).set({
          status: 'completed',
          completionAction: 'auto_completed',
          completedAt: new Date(),
          updatedAt: new Date(),
        }).where(eq(wrapupDrafts.id, wrapup.id));
        console.error(`[TranscriptWorker] Outbound note posting failed, wrapup ${wrapup.id.slice(0, 8)} auto-completed anyway:`, noteErr instanceof Error ? noteErr.message : noteErr);
      }
      return;
    }
  }

  // No customer match or no valid AZ ID - just complete
  await db.update(wrapupDrafts).set({
    status: 'completed',
    completionAction: 'auto_completed',
    completedAt: new Date(),
    autoVoidReason: 'outbound_unmatched',
    updatedAt: new Date(),
  }).where(eq(wrapupDrafts.id, wrapup.id));
  console.log(`[TranscriptWorker] Outbound wrapup ${wrapup.id.slice(0, 8)} auto-completed (no match)`);
}

// =============================================================================
// GET - Cron job entry point (triggered by Vercel cron)
// =============================================================================

export async function GET(request: NextRequest) {
  // Verify cron secret (optional but recommended)
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    // Allow without auth for now, but log warning
    console.warn("[TranscriptWorker] No valid cron auth header");
  }

  try {
    // First, poll SQL server for any missed calls (outbound calls, etc.)
    const pollResult = await pollSQLForMissedCalls();
    console.log(`[TranscriptWorker] SQL poll: found ${pollResult.found}, processed ${pollResult.processed} missed calls`);

    // Clean up stale calls stuck in active/in_progress state
    let staleCleaned = 0;
    try {
      staleCleaned = await cleanupStaleCalls();
      if (staleCleaned > 0) {
        console.log(`[TranscriptWorker] Cleaned up ${staleCleaned} stale call(s)`);
      }
    } catch (err) {
      console.error(`[TranscriptWorker] Stale call cleanup error:`, err);
    }

    // Process pending quote-ticket links (quotes submitted during calls that need AZ ticket notes)
    let quoteLinksProcessed = 0;
    try {
      quoteLinksProcessed = await processPendingQuoteTicketLinks();
      if (quoteLinksProcessed > 0) {
        console.log(`[TranscriptWorker] Linked ${quoteLinksProcessed} quote(s) to AZ tickets`);
      }
    } catch (err) {
      console.error(`[TranscriptWorker] Quote-ticket linking error:`, err);
    }

    // Auto-complete pending wrapups that nobody reviewed
    let wrapupsAutoCompleted = 0;
    try {
      wrapupsAutoCompleted = await autoCompletePendingWrapups();
      if (wrapupsAutoCompleted > 0) {
        console.log(`[TranscriptWorker] Auto-completed ${wrapupsAutoCompleted} pending wrapup(s)`);
      }
    } catch (err) {
      console.error(`[TranscriptWorker] Wrapup auto-complete error:`, err);
    }

    // Get pending jobs that are ready to process
    const jobs = await db
      .select()
      .from(pendingTranscriptJobs)
      .where(
        and(
          eq(pendingTranscriptJobs.status, "pending"),
          lte(pendingTranscriptJobs.nextAttemptAt, new Date())
        )
      )
      .orderBy(pendingTranscriptJobs.createdAt)
      .limit(10);

    if (jobs.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No pending jobs",
        processed: 0,
        sqlPoll: pollResult,
        staleCleaned,
        quoteLinksProcessed,
        wrapupsAutoCompleted,
      });
    }

    console.log(`[TranscriptWorker] Processing ${jobs.length} jobs`);

    const results = [];
    for (const job of jobs) {
      const result = await processJob(job);
      results.push({ jobId: job.id, ...result });
    }

    const successful = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success && !r.retry).length;
    const retrying = results.filter((r) => r.retry).length;

    return NextResponse.json({
      success: true,
      processed: jobs.length,
      successful,
      failed,
      retrying,
      results,
      sqlPoll: pollResult,
      staleCleaned,
      quoteLinksProcessed,
      wrapupsAutoCompleted,
    });
  } catch (error) {
    console.error("[TranscriptWorker] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Worker failed",
      },
      { status: 500 }
    );
  }
}

// =============================================================================
// POST - Manual trigger with optional filters
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { jobId, callId, forceAll } = body;

    let jobs;

    if (jobId) {
      // Process specific job
      jobs = await db
        .select()
        .from(pendingTranscriptJobs)
        .where(eq(pendingTranscriptJobs.id, jobId))
        .limit(1);
    } else if (callId) {
      // Process job for specific call
      jobs = await db
        .select()
        .from(pendingTranscriptJobs)
        .where(eq(pendingTranscriptJobs.callId, callId))
        .limit(1);
    } else if (forceAll) {
      // Process all pending (ignore nextAttemptAt)
      jobs = await db
        .select()
        .from(pendingTranscriptJobs)
        .where(eq(pendingTranscriptJobs.status, "pending"))
        .orderBy(pendingTranscriptJobs.createdAt)
        .limit(20);
    } else {
      // Normal processing
      jobs = await db
        .select()
        .from(pendingTranscriptJobs)
        .where(
          and(
            eq(pendingTranscriptJobs.status, "pending"),
            lte(pendingTranscriptJobs.nextAttemptAt, new Date())
          )
        )
        .orderBy(pendingTranscriptJobs.createdAt)
        .limit(10);
    }

    if (jobs.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No jobs to process",
        processed: 0,
      });
    }

    const results = [];
    for (const job of jobs) {
      const result = await processJob(job);
      results.push({ jobId: job.id, ...result });
    }

    return NextResponse.json({
      success: true,
      processed: jobs.length,
      results,
    });
  } catch (error) {
    console.error("[TranscriptWorker] POST error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Worker failed",
      },
      { status: 500 }
    );
  }
}
