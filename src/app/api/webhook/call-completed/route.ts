// API Route: /api/webhook/call-completed
// VoIPTools webhook endpoint for completed call processing
//
// Flow:
// 1. VoIPTools (3CX) sends call data after call ends
// 2. Match to existing call session
// 3. Fetch full transcript from MSSQL
// 4. Run AI analysis (summary, action items, extracted data)
// 5. Create wrap-up draft for agent review
// 6. Post notes to AgencyZoom CRM
// 7. Log for E&O compliance

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { calls, customers, wrapupDrafts, activities, users, triageItems } from "@/db/schema";
import { eq, or, ilike, and, gte, lte, desc } from "drizzle-orm";
import { getMSSQLTranscriptsClient } from "@/lib/api/mssql-transcripts";
import { getAgencyZoomClient } from "@/lib/api/agencyzoom";

// =============================================================================
// AUTHENTICATION
// =============================================================================

function verifyWebhookAuth(_request: NextRequest): boolean {
  // TEMPORARY: Allow all requests for testing
  // TODO: Re-enable auth after Zapier/VoIPTools is configured
  console.log("[Call-Completed] Auth check - allowing request for testing");
  return true;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return phone;
}

// Map AI call types to triage types
function mapCallTypeToTriageType(callType: string | undefined): "call" | "quote" | "claim" | "service" | "lead" | "after_hours" {
  if (!callType) return "call";
  const type = callType.toLowerCase();
  if (type.includes("quote") || type.includes("new business")) return "quote";
  if (type.includes("claim")) return "claim";
  if (type.includes("lead") || type.includes("prospect")) return "lead";
  if (type.includes("service") || type.includes("endorsement") || type.includes("change")) return "service";
  if (type.includes("after") || type.includes("voicemail")) return "after_hours";
  return "call";
}

// Calculate priority based on call analysis
function calculatePriority(analysis: any, duration: number): "low" | "medium" | "high" | "urgent" {
  // Urgent: Claims, complaints, cancellation requests
  const urgentKeywords = ["claim", "accident", "cancel", "complaint", "urgent", "emergency", "asap"];
  const summary = (analysis.summary || "").toLowerCase();
  const callType = (analysis.callType || "").toLowerCase();

  if (urgentKeywords.some(k => summary.includes(k) || callType.includes(k))) {
    return "urgent";
  }

  // High: Quote requests, billing issues, action items
  const highKeywords = ["quote", "billing", "payment", "due", "lapse"];
  if (highKeywords.some(k => summary.includes(k) || callType.includes(k))) {
    return "high";
  }

  // High: Has multiple action items
  if (analysis.actionItems && analysis.actionItems.length > 2) {
    return "high";
  }

  // Medium: Has some action items or longer call
  if ((analysis.actionItems && analysis.actionItems.length > 0) || duration > 300) {
    return "medium";
  }

  return "low";
}

// Calculate AI priority score (0-100)
function calculateAIPriorityScore(analysis: any, duration: number): number {
  let score = 50; // Base score

  // Sentiment adjustment
  if (analysis.sentiment === "negative") score += 20;
  else if (analysis.sentiment === "positive") score -= 10;

  // Action items
  const actionCount = analysis.actionItems?.length || 0;
  score += Math.min(actionCount * 10, 30);

  // Call type adjustment
  const callType = (analysis.callType || "").toLowerCase();
  if (callType.includes("claim")) score += 25;
  else if (callType.includes("quote")) score += 15;
  else if (callType.includes("cancel")) score += 20;

  // Duration adjustment (longer calls often more complex)
  if (duration > 600) score += 10;
  else if (duration > 300) score += 5;

  return Math.min(100, Math.max(0, score));
}

// =============================================================================
// SESSION MATCHING
// =============================================================================

interface MatchResult {
  call: typeof calls.$inferSelect | null;
  method: "callId" | "externalId" | "phone_time" | "extension_time" | "created" | "unmatched";
  confidence: number;
}

// Check if string is a valid UUID format
function isValidUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

async function matchCallSession(
  tenantId: string,
  callId: string,
  callerNumber: string,
  calledNumber: string,
  extension: string,
  timestamp: Date
): Promise<MatchResult> {
  // Time window for matching (15 minutes before/after)
  const timeWindowStart = new Date(timestamp.getTime() - 15 * 60 * 1000);
  const timeWindowEnd = new Date(timestamp.getTime() + 15 * 60 * 1000);

  // Try exact callId match first - only check UUID column if callId is valid UUID
  let byCallId = null;

  if (isValidUUID(callId)) {
    // callId is a valid UUID, can check both columns
    [byCallId] = await db
      .select()
      .from(calls)
      .where(
        and(
          eq(calls.tenantId, tenantId),
          or(
            eq(calls.id, callId),
            eq(calls.externalCallId, callId)
          )
        )
      )
      .limit(1);
  } else {
    // callId is not a UUID, only check externalCallId (varchar column)
    [byCallId] = await db
      .select()
      .from(calls)
      .where(
        and(
          eq(calls.tenantId, tenantId),
          eq(calls.externalCallId, callId)
        )
      )
      .limit(1);
  }

  if (byCallId) {
    return { call: byCallId, method: "callId", confidence: 1.0 };
  }

  // Try phone number + time window
  const normalizedCaller = normalizePhone(callerNumber);
  const normalizedCalled = normalizePhone(calledNumber);

  const [byPhoneTime] = await db
    .select()
    .from(calls)
    .where(
      and(
        eq(calls.tenantId, tenantId),
        gte(calls.startedAt, timeWindowStart),
        lte(calls.startedAt, timeWindowEnd),
        or(
          eq(calls.fromNumber, normalizedCaller),
          eq(calls.toNumber, normalizedCaller),
          eq(calls.fromNumber, normalizedCalled),
          eq(calls.toNumber, normalizedCalled)
        )
      )
    )
    .orderBy(desc(calls.startedAt))
    .limit(1);

  if (byPhoneTime) {
    return { call: byPhoneTime, method: "phone_time", confidence: 0.9 };
  }

  // Try extension + time window
  if (extension) {
    const [agent] = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.tenantId, tenantId), eq(users.extension, extension)))
      .limit(1);

    if (agent) {
      const [byExtension] = await db
        .select()
        .from(calls)
        .where(
          and(
            eq(calls.tenantId, tenantId),
            eq(calls.agentId, agent.id),
            gte(calls.startedAt, timeWindowStart),
            lte(calls.startedAt, timeWindowEnd)
          )
        )
        .orderBy(desc(calls.startedAt))
        .limit(1);

      if (byExtension) {
        return { call: byExtension, method: "extension_time", confidence: 0.8 };
      }
    }
  }

  return { call: null, method: "unmatched", confidence: 0 };
}

// =============================================================================
// AI ANALYSIS
// =============================================================================

interface AIAnalysis {
  summary: string;
  actionItems: string[];
  extractedData: {
    customerName?: string;
    policyNumber?: string;
    phone?: string;
    email?: string;
    address?: string;
    vin?: string;
    effectiveDate?: string;
    amount?: string;
  };
  sentiment: "positive" | "neutral" | "negative";
  isHangup: boolean;
  callType?: string;
}

async function analyzeTranscript(transcript: string): Promise<AIAnalysis | null> {
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey || !transcript || transcript.length < 50) {
    return null;
  }

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are an insurance agency call analyst. Analyze this call transcript and extract:
1. A 2-3 sentence summary
2. Action items that need follow-up
3. Key data mentioned (customer name, policy number, VIN, phone, email, address, dates, amounts)
4. Overall sentiment (positive/neutral/negative)
5. Whether this was a hangup/brief call with no meaningful conversation
6. Call type (quote request, policy change, billing inquiry, claim, renewal, etc.)

Respond in JSON format:
{
  "summary": "...",
  "actionItems": ["...", "..."],
  "extractedData": { "customerName": "...", "policyNumber": "...", ... },
  "sentiment": "positive|neutral|negative",
  "isHangup": true|false,
  "callType": "..."
}`,
          },
          {
            role: "user",
            content: transcript,
          },
        ],
        temperature: 0.3,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      console.error("[Call-Completed] OpenAI API error:", response.status);
      return null;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    // Parse JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }

    return null;
  } catch (error) {
    console.error("[Call-Completed] AI analysis error:", error);
    return null;
  }
}

// =============================================================================
// AGENCYZOOM INTEGRATION
// =============================================================================

async function postToAgencyZoom(
  customerId: string | null,
  summary: string,
  direction: string,
  agentName: string,
  timestamp: Date
): Promise<boolean> {
  if (!customerId) return false;

  try {
    // Look up customer to get their AgencyZoom ID
    const [customer] = await db
      .select({ agencyzoomId: customers.agencyzoomId })
      .from(customers)
      .where(eq(customers.id, customerId))
      .limit(1);

    if (!customer?.agencyzoomId) {
      console.log(`[Call-Completed] No AgencyZoom ID for customer ${customerId}`);
      return false;
    }

    const azClient = await getAgencyZoomClient();
    if (!azClient) {
      console.log("[Call-Completed] AgencyZoom client not configured");
      return false;
    }

    const formattedDate = timestamp.toLocaleDateString("en-US", {
      month: "numeric",
      day: "numeric",
      year: "numeric",
    });
    const formattedTime = timestamp.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });

    const noteText = `📞 ${direction === "inbound" ? "Inbound" : "Outbound"} Call - ${formattedDate} ${formattedTime}\n\n${summary}\n\nAgent: ${agentName}`;

    // Post note to customer in AgencyZoom
    const result = await azClient.addNote(parseInt(customer.agencyzoomId), noteText);

    if (result.success) {
      console.log(`[Call-Completed] Posted note to AgencyZoom for customer ${customerId} (AZ ID: ${customer.agencyzoomId})`);
      return true;
    } else {
      console.warn(`[Call-Completed] Failed to post note to AgencyZoom for customer ${customerId}`);
      return false;
    }
  } catch (error) {
    console.error("[Call-Completed] AgencyZoom post error:", error);
    return false;
  }
}

// =============================================================================
// VOIPTOOLS / ZAPIER WEBHOOK PAYLOAD
// =============================================================================

// Actual payload from Zapier/VoIPTools:
// {
//   "callerPhone": "sip:12058475616@tcdsagency.pstn.twilio.com",
//   "transcript": "Hello, you have reached Todd's...",
//   "callStartTime": "2025-12-18T03:11:46Z",
//   "duration": 11,
//   "callId": "CAee09eecf5928957c2c607c9dc4fd5182",
//   "direction": "outbound",
//   "agentExtension": "+12056831345",
//   "callerNumber": "sip:12058475616@tcdsagency.pstn.twilio.com",
//   "extension": "+12056831345",
//   "startTime": "2025-12-18T03:11:46Z"
// }

interface VoIPToolsPayload {
  // Call identifiers
  callId: string;

  // Phone numbers (may be SIP URIs like "sip:12058475616@tcdsagency.pstn.twilio.com")
  callerPhone?: string;
  callerNumber?: string;
  calledNumber?: string;

  // Duration in seconds
  duration: number;

  // Direction (lowercase: "inbound" or "outbound")
  direction: string;

  // Agent/Extension
  extension?: string;
  agentExtension?: string;
  agentName?: string;

  // Timestamps
  timestamp?: string;
  callStartTime?: string;
  startTime?: string;

  // Transcript (Zapier sends this directly!)
  transcript?: string;

  // Recording
  recordingUrl?: string;
  transcriptUrl?: string;

  // Additional fields
  status?: string;
  queueId?: string;
  queueName?: string;
}

// Extract phone number from SIP URI or return as-is
function extractPhoneFromSIP(sipUri: string | undefined): string {
  if (!sipUri) return "";

  // Match SIP URI pattern: sip:12058475616@domain
  const sipMatch = sipUri.match(/^sip:(\d+)@/);
  if (sipMatch) {
    return sipMatch[1];
  }

  // Already a phone number
  return sipUri;
}

// =============================================================================
// MAIN WEBHOOK HANDLER
// =============================================================================

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Verify authentication
    if (!verifyWebhookAuth(request)) {
      console.warn("[Call-Completed] Unauthorized request");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: VoIPToolsPayload = await request.json();
    console.log("[Call-Completed] Received:", JSON.stringify(body, null, 2));

    const tenantId = process.env.DEFAULT_TENANT_ID || "00000000-0000-0000-0000-000000000001";

    // Normalize field names from Zapier payload
    const rawTimestamp = body.timestamp || body.callStartTime || body.startTime;
    const timestamp = new Date(rawTimestamp || Date.now());
    const direction = body.direction?.toLowerCase() === "inbound" ? "inbound" : "outbound";

    // Extract phone numbers from SIP URIs if needed
    const callerNumber = extractPhoneFromSIP(body.callerPhone || body.callerNumber);
    const calledNumber = extractPhoneFromSIP(body.calledNumber);
    const extension = body.extension || body.agentExtension || "";

    console.log("[Call-Completed] Normalized - caller:", callerNumber, "called:", calledNumber, "ext:", extension);

    // 1. Match to existing session
    const matchResult = await matchCallSession(
      tenantId,
      body.callId,
      callerNumber,
      calledNumber,
      extension,
      timestamp
    );

    let call = matchResult.call;
    let matchStatus: "matched" | "created" | "unmatched" = "unmatched";

    if (call) {
      matchStatus = "matched";

      // Update call with VoIPTools data
      const [updated] = await db
        .update(calls)
        .set({
          externalCallId: body.callId,
          status: "completed",
          endedAt: timestamp,
          durationSeconds: body.duration,
          recordingUrl: body.recordingUrl,
        })
        .where(eq(calls.id, call.id))
        .returning();

      call = updated;
    } else {
      matchStatus = "created";

      // Create new call record
      const customerPhone = direction === "inbound" ? callerNumber : calledNumber;
      const customerPhoneDigits = customerPhone.replace(/\D/g, "");

      // Try to find customer
      let customer: { id: string } | undefined;
      if (customerPhoneDigits.length >= 10) {
        const [found] = await db
          .select({ id: customers.id })
          .from(customers)
          .where(
            and(
              eq(customers.tenantId, tenantId),
              or(
                ilike(customers.phone, `%${customerPhoneDigits.slice(-10)}`),
                ilike(customers.phoneAlt, `%${customerPhoneDigits.slice(-10)}`)
              )
            )
          )
          .limit(1);
        customer = found;
      }

      // Find agent by extension
      let agentId: string | undefined;
      if (extension) {
        const extDigits = extension.replace(/\D/g, "");
        const [agent] = await db
          .select({ id: users.id })
          .from(users)
          .where(and(eq(users.tenantId, tenantId), eq(users.extension, extDigits)))
          .limit(1);
        agentId = agent?.id;
      }

      const [created] = await db
        .insert(calls)
        .values({
          tenantId,
          externalCallId: body.callId,
          direction: direction as "inbound" | "outbound",
          directionLive: direction as "inbound" | "outbound",
          status: "completed",
          fromNumber: normalizePhone(callerNumber),
          toNumber: normalizePhone(calledNumber || extension), // Use extension if no calledNumber
          customerId: customer?.id,
          agentId,
          startedAt: new Date(timestamp.getTime() - (body.duration || 0) * 1000),
          endedAt: timestamp,
          durationSeconds: body.duration,
          recordingUrl: body.recordingUrl,
        })
        .returning();

      call = created;
    }

    // 2. Get transcript - prefer inline from Zapier, then existing, then fetch from MSSQL
    let transcript = body.transcript || call.transcription || "";
    let transcriptSource = body.transcript ? "zapier" : call.transcription ? "existing" : "none";

    // If Zapier sent transcript directly, save it
    if (body.transcript && body.transcript !== call.transcription) {
      await db
        .update(calls)
        .set({ transcription: body.transcript })
        .where(eq(calls.id, call.id));
      console.log("[Call-Completed] Saved transcript from Zapier payload");
    }

    // Fallback: fetch from MSSQL if no transcript yet
    if (!transcript && body.callId) {
      try {
        const mssqlClient = await getMSSQLTranscriptsClient();
        if (mssqlClient) {
          const transcriptData = await mssqlClient.getTranscriptById(body.callId);
          if (transcriptData?.transcript) {
            transcript = transcriptData.transcript;
            transcriptSource = "mssql";

            // Update call with transcript
            await db
              .update(calls)
              .set({ transcription: transcript })
              .where(eq(calls.id, call.id));
            console.log("[Call-Completed] Fetched transcript from MSSQL");
          }
        }
      } catch (error) {
        console.error("[Call-Completed] MSSQL fetch error:", error);
      }
    }

    console.log(`[Call-Completed] Transcript source: ${transcriptSource}, length: ${transcript.length}`);

    // 3. Run AI analysis
    let analysis: AIAnalysis | null = null;
    if (transcript && transcript.length > 50) {
      analysis = await analyzeTranscript(transcript);

      if (analysis) {
        // Update call with AI analysis
        await db
          .update(calls)
          .set({
            aiSummary: analysis.summary,
            aiSentiment: {
              overall: analysis.sentiment,
              score: analysis.sentiment === "positive" ? 0.8 : analysis.sentiment === "negative" ? 0.2 : 0.5,
              timeline: [],
            },
            predictedReason: analysis.callType,
            detectedEntities: Object.entries(analysis.extractedData || {})
              .filter(([_, v]) => v)
              .map(([type, value]) => ({
                type: type as any,
                value: value as string,
                confidence: 0.9,
              })),
          })
          .where(eq(calls.id, call.id));
      }
    }

    // 4. Create wrap-up draft
    let wrapupId: string | null = null;
    if (analysis && !analysis.isHangup) {
      const [wrapup] = await db
        .insert(wrapupDrafts)
        .values({
          tenantId,
          callId: call.id,
          direction: direction === "inbound" ? "Inbound" : "Outbound",
          agentExtension: extension,
          agentName: body.agentName,
          summary: analysis.summary,
          customerName: analysis.extractedData?.customerName,
          customerPhone: analysis.extractedData?.phone || callerNumber,
          customerEmail: analysis.extractedData?.email,
          requestType: analysis.callType,
          status: "pending_review",
          aiCleanedSummary: analysis.summary,
          aiProcessingStatus: "completed",
          aiProcessedAt: new Date(),
          aiExtraction: {
            actionItems: analysis.actionItems,
            extractedData: analysis.extractedData,
            sentiment: analysis.sentiment,
          },
          aiConfidence: "0.85",
        })
        .returning();

      wrapupId = wrapup.id;
      console.log(`[Call-Completed] Created wrap-up draft: ${wrapupId}`);

      // 4.5. Create triage item for agent review
      const triageType = mapCallTypeToTriageType(analysis.callType);
      const priority = calculatePriority(analysis, body.duration || 0);
      const aiScore = calculateAIPriorityScore(analysis, body.duration || 0);

      const [triageItem] = await db
        .insert(triageItems)
        .values({
          tenantId,
          type: triageType,
          status: "pending",
          priority,
          customerId: call.customerId || null,
          callId: call.id,
          title: `${direction === "inbound" ? "Inbound" : "Outbound"} Call: ${analysis.extractedData?.customerName || callerNumber}`,
          description: analysis.summary,
          aiSummary: analysis.summary,
          aiPriorityScore: aiScore.toString(),
          aiPriorityReason: aiScore >= 80 ? "Urgent follow-up needed" : aiScore >= 60 ? "Action items pending" : "Routine follow-up",
          dueAt: new Date(Date.now() + (priority === "urgent" ? 2 : priority === "high" ? 4 : 8) * 60 * 60 * 1000), // 2h/4h/8h SLA
        })
        .returning();

      console.log(`[Call-Completed] Created triage item: ${triageItem.id} (type: ${triageType}, priority: ${priority})`);
    }

    // 5. Post to AgencyZoom (if customer found)
    if (call.customerId && analysis) {
      await postToAgencyZoom(
        call.customerId,
        analysis.summary,
        direction,
        body.agentName || "Agent",
        timestamp
      );
    }

    // 6. Log for E&O compliance (only if we have a customer)
    if (call.customerId) {
      await db.insert(activities).values({
        tenantId,
        customerId: call.customerId,
        callId: call.id,
        createdById: call.agentId,
        type: "call",
        title: `Call ${direction === "inbound" ? "received" : "placed"} - ${body.duration}s`,
        description: analysis?.summary || `${direction} call completed. Duration: ${body.duration}s. Match: ${matchResult.method} (${matchResult.confidence})`,
        aiGenerated: !!analysis,
      });
    }

    const processingTime = Date.now() - startTime;
    console.log(`[Call-Completed] Processed in ${processingTime}ms`);

    return NextResponse.json({
      success: true,
      sessionId: call.id,
      wrapupId,
      agentName: body.agentName,
      extension,
      matchStatus,
      matchMethod: matchResult.method,
      matchConfidence: matchResult.confidence,
      merged: matchStatus === "matched",
      hasTranscript: !!transcript,
      transcriptSource,
      transcriptLength: transcript.length,
      hasAnalysis: !!analysis,
      processingTimeMs: processingTime,
    });
  } catch (error) {
    console.error("[Call-Completed] Error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Processing failed" },
      { status: 500 }
    );
  }
}

// =============================================================================
// GET - Endpoint info
// =============================================================================

export async function GET() {
  return NextResponse.json({
    success: true,
    message: "VoIPTools/Zapier call-completed webhook is ready",
    endpoint: "/api/webhook/call-completed",
    description: "Processes completed calls from VoIPTools (3CX) via Zapier",
    flow: [
      "1. Receive call data from Zapier/VoIPTools",
      "2. Parse SIP URIs to extract phone numbers",
      "3. Match to existing call session (by callId, phone, or extension)",
      "4. Use transcript from payload (or fetch from MSSQL as fallback)",
      "5. Run AI analysis (summary, actions, extracted data)",
      "6. Create wrap-up draft for agent review",
      "7. Post notes to AgencyZoom CRM",
      "8. Log for E&O compliance",
    ],
    webhook_url: "https://tcds-triage.vercel.app/api/webhook/call-completed",
    authentication: "Currently disabled for testing (TODO: re-enable)",
    example_payload: {
      callId: "CAee09eecf5928957c2c607c9dc4fd5182",
      callerPhone: "sip:12055551234@domain.pstn.twilio.com",
      callerNumber: "sip:12055551234@domain.pstn.twilio.com",
      transcript: "Hello, this is the call transcript...",
      duration: 245,
      direction: "inbound",
      extension: "+12055559876",
      agentExtension: "+12055559876",
      callStartTime: "2024-01-15T10:30:00Z",
      startTime: "2024-01-15T10:30:00Z",
    },
  });
}
