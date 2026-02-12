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
import { pendingTranscriptJobs, wrapupDrafts, calls, customers, liveTranscriptSegments, users, tenants, serviceTickets } from "@/db/schema";
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

// Retry schedule (exponential backoff)
const RETRY_DELAYS = [
  30,    // Attempt 1: 30s
  60,    // Attempt 2: 1m
  60,    // Attempt 3: 1m
  120,   // Attempt 4: 2m
  120,   // Attempt 5: 2m
  180,   // Attempt 6: 3m
  180,   // Attempt 7: 3m
  300,   // Attempt 8: 5m
  300,   // Attempt 9: 5m
  600,   // Attempt 10: 10m
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
// Live Transcript Fallback - Consolidate segments when SQL Server unavailable
// =============================================================================

async function getLiveTranscriptFallback(callId: string): Promise<string | null> {
  try {
    const segments = await db
      .select({
        speaker: liveTranscriptSegments.speaker,
        text: liveTranscriptSegments.text,
        sequenceNumber: liveTranscriptSegments.sequenceNumber,
      })
      .from(liveTranscriptSegments)
      .where(eq(liveTranscriptSegments.callId, callId))
      .orderBy(asc(liveTranscriptSegments.sequenceNumber));

    if (segments.length === 0) {
      return null;
    }

    // Consolidate segments into a readable transcript
    const transcript = segments
      .map(s => {
        const speakerLabel = s.speaker === 'agent' ? 'Agent' : 'Customer';
        return `${speakerLabel}: ${s.text}`;
      })
      .join('\n');

    console.log(`[TranscriptWorker] Consolidated ${segments.length} live segments into transcript`);
    return transcript;
  } catch (error) {
    console.error(`[TranscriptWorker] Failed to get live transcript fallback:`, error);
    return null;
  }
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

    // Find transcript in SQL Server
    const transcript = await mssqlClient.findTranscript({
      callerNumber: job.callerNumber || undefined,
      agentExtension: job.agentExtension || undefined,
      startTime: job.callStartedAt,
      endTime: job.callEndedAt,
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
          })
          .from(calls)
          .where(eq(calls.id, job.callId))
          .limit(1);

        const callDirection = direction || callDetails?.direction || "inbound";
        const customerPhone = callDirection === "inbound"
          ? (callDetails?.externalNumber || callDetails?.fromNumber || job.callerNumber)
          : (callDetails?.externalNumber || callDetails?.toNumber);

        // Use upsert to create if not exists, update if exists
        await db
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
          });

        // Update call with transcript, corrected direction and AI results
        await db
          .update(calls)
          .set({
            transcription: transcript.transcript, // Store the actual transcript
            transcriptionStatus: "completed",
            directionFinal: direction as "inbound" | "outbound",
            aiSummary: aiResult.summary,
            aiActionItems: aiResult.actionItems,
            aiSentiment: { overall: aiResult.sentiment, score: 0, timeline: [] },
            aiTopics: aiResult.topics,
            updatedAt: new Date(),
          })
          .where(eq(calls.id, job.callId));
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

        // Write to AgencyZoom
        writeToAgencyZoom(job.callId, aiResult).catch((err) =>
          console.error(`[TranscriptWorker] AgencyZoom writeback failed:`, err.message)
        );
      }

      return { success: true };
    } else {
      // NOT FOUND: Schedule retry or fail
      const attemptCount = (job.attemptCount || 0) + 1;

      if (attemptCount >= MAX_ATTEMPTS) {
        // Max attempts reached - try live transcript fallback before failing
        console.warn(`[TranscriptWorker] Job ${job.id} SQL Server failed after ${attemptCount} attempts - trying live transcript fallback`);

        // Get call details first
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

        // Try live transcript fallback
        const liveTranscript = job.callId ? await getLiveTranscriptFallback(job.callId) : null;

        if (liveTranscript && liveTranscript.length > 50) {
          // SUCCESS: Use live transcript as fallback
          console.log(`[TranscriptWorker] Using live transcript fallback for job ${job.id}`);

          // Run AI extraction on live transcript
          const aiResult = await extractCallDataWithAI(liveTranscript, {
            direction: callDirection,
            agentExtension: job.agentExtension || "",
            callerNumber: job.callerNumber || "",
            duration: undefined,
          });

          // Create or update wrapup draft with live transcript data
          if (job.callId) {
            await db
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
                matchStatus: "unmatched",
                aiExtraction: {
                  ...aiResult,
                  transcriptSource: "live_fallback",
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
                  policyNumbers: aiResult.policyNumbers,
                  insuranceType: aiResult.insuranceType,
                  requestType: aiResult.requestType,
                  aiExtraction: {
                    ...aiResult,
                    transcriptSource: "live_fallback",
                  },
                  aiProcessingStatus: "completed",
                  aiProcessedAt: new Date(),
                  updatedAt: new Date(),
                },
              });

            // Update call with consolidated transcript
            await db
              .update(calls)
              .set({
                transcription: liveTranscript,
                transcriptionStatus: "completed",
                aiSummary: aiResult.summary,
                aiActionItems: aiResult.actionItems,
                aiSentiment: { overall: aiResult.sentiment, score: 0, timeline: [] },
                aiTopics: aiResult.topics,
                updatedAt: new Date(),
              })
              .where(eq(calls.id, job.callId));
          }

          // Mark job completed (with fallback)
          await db
            .update(pendingTranscriptJobs)
            .set({
              status: "completed",
              completedAt: new Date(),
              error: "Completed using live transcript fallback",
              attemptCount,
            })
            .where(eq(pendingTranscriptJobs.id, job.id));

          // Broadcast to UI
          if (job.callId) {
            await broadcastTranscriptReady(job.callId, aiResult);
          }

          return { success: true, source: "live_fallback" };
        }

        // No live transcript available either - mark as failed
        await db
          .update(pendingTranscriptJobs)
          .set({
            status: "failed",
            failedAt: new Date(),
            error: "Max retry attempts reached - no transcript available from SQL Server or live segments",
            attemptCount,
          })
          .where(eq(pendingTranscriptJobs.id, job.id));

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
    if (features?.autoCreateServiceTickets !== true) {
      console.log(`[TranscriptWorker] Auto-ticket feature not enabled, skipping`);
      return;
    }

    // 2. Phone validation - skip internal/test calls
    const callerDigits = (customerPhone || '').replace(/\D/g, '');
    if (
      !customerPhone ||
      customerPhone === 'Unknown' ||
      customerPhone === 'PlayFile' ||
      customerPhone.toLowerCase().includes('playfile') ||
      callerDigits.length < 7 ||
      callerDigits.length > 11
    ) {
      console.log(`[TranscriptWorker] Skipping ticket for invalid phone: ${customerPhone}`);
      return;
    }

    // 3. Customer lookup - search local DB by last 10 digits
    const phoneSuffix = callerDigits.slice(-10);
    let matchedAzCustomerId: number | null = null;
    let localCustomerId: string | null = null;

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
    let ticketDescription = `Inbound Call - AI Processed (SQL Poll)\n\n`;
    ticketDescription += `Summary: ${aiResult.summary || 'No summary available'}\n\n`;

    if (aiResult.actionItems && aiResult.actionItems.length > 0) {
      ticketDescription += `Action Items:\n`;
      aiResult.actionItems.forEach((item: string) => {
        ticketDescription += `- ${item}\n`;
      });
      ticketDescription += '\n';
    }

    if (customerName) ticketDescription += `Customer: ${customerName}\n`;
    if (aiResult.policyNumbers.length > 0) ticketDescription += `Policy: ${aiResult.policyNumbers.join(', ')}\n`;

    ticketDescription += `\nCall Duration: ${durationSeconds}s`;
    ticketDescription += `\nCaller: ${customerPhone || 'Unknown'}`;

    if (!matchedAzCustomerId && customerPhone) {
      ticketDescription += `\n\n--- Original Caller Info ---`;
      ticketDescription += `\nPhone: ${customerPhone}`;
      if (customerName) {
        ticketDescription += `\nName: ${customerName}`;
      }
    }

    if (transcript && transcript.length > 0) {
      ticketDescription += `\n\n===================================\n`;
      ticketDescription += `CALL TRANSCRIPTION\n`;
      ticketDescription += `===================================\n\n`;
      ticketDescription += transcript;
    }

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
    if (customerPhone) {
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
