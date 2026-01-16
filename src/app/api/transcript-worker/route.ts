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
import { pendingTranscriptJobs, wrapupDrafts, calls, customers } from "@/db/schema";
import { eq, lte, and, sql } from "drizzle-orm";
import { getMSSQLTranscriptsClient, TranscriptRecord } from "@/lib/api/mssql-transcripts";
import { getAgencyZoomClient } from "@/lib/api/agencyzoom";

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
        // Max attempts reached - mark failed
        console.warn(`[TranscriptWorker] Job ${job.id} failed after ${attemptCount} attempts`);

        await db
          .update(pendingTranscriptJobs)
          .set({
            status: "failed",
            failedAt: new Date(),
            error: "Max retry attempts reached - transcript not found in SQL Server",
            attemptCount,
          })
          .where(eq(pendingTranscriptJobs.id, job.id));

        // Create or update wrapup draft - mark for manual review since no transcript available
        if (job.callId) {
          // Get call details
          const [callDetails] = await db
            .select({
              tenantId: calls.tenantId,
              direction: calls.direction,
              fromNumber: calls.fromNumber,
              toNumber: calls.toNumber,
              externalNumber: calls.externalNumber,
            })
            .from(calls)
            .where(eq(calls.id, job.callId))
            .limit(1);

          const callDirection = callDetails?.direction || "inbound";
          const customerPhone = callDirection === "inbound"
            ? (callDetails?.externalNumber || callDetails?.fromNumber || job.callerNumber)
            : (callDetails?.externalNumber || callDetails?.toNumber);

          await db
            .insert(wrapupDrafts)
            .values({
              tenantId: callDetails?.tenantId || job.tenantId || process.env.DEFAULT_TENANT_ID!,
              callId: job.callId,
              status: "pending_review",
              summary: "No transcript available from SQL Server - requires manual review.",
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
                summary: "No transcript available from SQL Server - requires manual review.",
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
