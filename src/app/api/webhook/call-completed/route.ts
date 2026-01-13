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
import { calls, customers, wrapupDrafts, activities, users, matchSuggestions } from "@/db/schema";
import { eq, or, ilike, and, gte, lte, desc, isNotNull } from "drizzle-orm";
import { getMSSQLTranscriptsClient } from "@/lib/api/mssql-transcripts";
import { getAgencyZoomClient, type AgencyZoomCustomer, type AgencyZoomLead } from "@/lib/api/agencyzoom";
import { trestleIQClient } from "@/lib/api/trestleiq";
import { getServiceRequestTypeId } from "@/lib/constants/agencyzoom";

// =============================================================================
// REALTIME SERVER NOTIFICATION
// =============================================================================

async function notifyRealtimeServer(event: Record<string, unknown>) {
  const realtimeUrl = process.env.REALTIME_SERVER_URL || "https://realtime.tcdsagency.com";

  try {
    await fetch(`${realtimeUrl}/api/broadcast`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": process.env.REALTIME_API_KEY || "",
      },
      body: JSON.stringify(event),
    });
    console.log(`[Call-Completed] Broadcasted ${event.type} to realtime server`);
  } catch (error) {
    console.error("[Call-Completed] Failed to notify realtime server:", error);
  }
}

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
  // Time window for matching - use wider window (30 minutes) for better fallback matching
  const timeWindowStart = new Date(timestamp.getTime() - 30 * 60 * 1000);
  const timeWindowEnd = new Date(timestamp.getTime() + 30 * 60 * 1000);

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
  // Prefer calls that already have an agentId (came through call-started)
  const normalizedCaller = normalizePhone(callerNumber);
  const normalizedCalled = normalizePhone(calledNumber);

  // First try to find a call WITH an agent assigned (from call-started)
  const [byPhoneWithAgent] = await db
    .select()
    .from(calls)
    .where(
      and(
        eq(calls.tenantId, tenantId),
        gte(calls.startedAt, timeWindowStart),
        lte(calls.startedAt, timeWindowEnd),
        isNotNull(calls.agentId), // Prefer calls with agent
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

  if (byPhoneWithAgent) {
    console.log("[Call-Completed] Matched to existing call with agent:", byPhoneWithAgent.id);
    return { call: byPhoneWithAgent, method: "phone_time", confidence: 0.95 };
  }

  // Fallback: match any call by phone (may not have agent)
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
  serviceRequestType?: string; // Maps to AgencyZoom service request type
  callQuality?: "voicemail" | "brief_no_service" | "normal"; // Quality assessment for auto-void
}

async function analyzeTranscript(transcript: string, durationSeconds: number = 0): Promise<AIAnalysis | null> {
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
            content: `You are an insurance agency call analyst.

You will be given:
- A call transcript
- The call duration in seconds

Known Call Representatives (Authorized Agent Names):
Todd, Lee, Stephanie, Blair, Paulo, Montrice

Your task is to generate a clear, professional post-call note suitable for an insurance agency file and understandable by another agent who was not on the call.

CORE RULES:
- Base all factual details strictly on the call transcript
- Write clearly so another agent can immediately understand what happened and what to do next
- Be concise, factual, and operational
- Do not invent intent, outcomes, or details
- Do not create sections that are not required for the call duration tier

CALL REPRESENTATIVE NAME NORMALIZATION:
- Use the authorized agent name list to correct obvious transcription errors
- Only normalize names when there is a clear phonetic or spelling match
- Do not rename customers as representatives
- If a name is ambiguous, refer to the person as "the agent"

SHORT VS LONG NOTE LOGIC (Based on Call Duration):

0-30 seconds (Very Short Call):
- Purpose: Logging only
- 1 sentence maximum
- No action items unless explicitly stated
- Often voicemail, hangup, or wrong party
- Required: summary, callQuality

31-120 seconds (Short Call):
- Purpose: Simple service confirmation
- 1-2 sentences total
- Bullet action items only if required
- Required: summary, actionItems (if any), callType, callQuality

121-600 seconds (Standard Call):
- Purpose: Normal service work
- 3-5 sentence summary
- Clear action items with responsibility
- Key details listed cleanly
- Required: summary, actionItems, extractedData, callType, sentiment

Over 600 seconds (Long/Complex Call):
- Purpose: Coverage discussions, underwriting issues, disputes, or multi-step changes
- 3-5 sentence summary
- Explicit next steps
- Structured key details
- Required: summary, actionItems, extractedData, callType, sentiment

CALL SUMMARY STRUCTURE (when allowed by duration):
1. Who initiated the call
2. Purpose of the call
3. Key details discussed
4. Decisions made
5. Outcome or next step

ACTION ITEMS FORMAT:
- Each action must include: WHO is responsible, WHAT needs to be done, WHEN (if known)
- If none required, return empty array

KEY DETAILS (extractedData):
- Only include details explicitly stated on the call
- Policy number, VIN (17 chars), address, amounts, dates as discussed

CALL QUALITY:
- "meaningful_conversation" - actual service discussion
- "voicemail" - left or received voicemail
- "brief_no_service" - hangup, wrong number, no conversation

SENTIMENT:
- positive: Cooperative, appreciative, agreeable
- neutral: Informational, transactional, routine
- negative: Frustrated, upset, dissatisfied

Respond in JSON format:
{
  "summary": "...",
  "actionItems": ["WHO: WHAT by WHEN", ...],
  "extractedData": {
    "customerName": "First Last",
    "policyNumber": "XX-1234567",
    "phone": "205-555-1234",
    "email": "email@example.com",
    "address": "123 Main St, City, AL 35126",
    "vin": "1HGBH41JXMN109186",
    "effectiveDate": "01/15/2026",
    "amount": "$1,234.56"
  },
  "sentiment": "positive|neutral|negative",
  "isHangup": true|false,
  "callType": "quote request|policy change|billing inquiry|claim|renewal|general inquiry|service request|complaint|other",
  "callQuality": "meaningful_conversation|voicemail|brief_no_service",
  "serviceRequestType": "billing inquiry|policy change|add vehicle|remove vehicle|add driver|remove driver|claims|renewal|quote request|cancel|certificate|id card|general inquiry"
}`,
          },
          {
            role: "user",
            content: `Call Duration: ${durationSeconds} seconds\n\nTranscript:\n${transcript}`,
          },
        ],
        temperature: 0.3,
        max_tokens: 1500,
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

    // =========================================================================
    // DETAILED LOGGING FOR TROUBLESHOOTING EXTENSION ISSUES
    // =========================================================================
    console.log("[Call-Completed] ========== RAW PAYLOAD ==========");
    console.log("[Call-Completed] callId:", body.callId);
    console.log("[Call-Completed] direction:", body.direction);
    console.log("[Call-Completed] callerPhone:", body.callerPhone);
    console.log("[Call-Completed] callerNumber:", body.callerNumber);
    console.log("[Call-Completed] calledNumber:", body.calledNumber);
    console.log("[Call-Completed] extension:", body.extension);
    console.log("[Call-Completed] agentExtension:", body.agentExtension);
    console.log("[Call-Completed] agentName:", body.agentName);
    console.log("[Call-Completed] duration:", body.duration);
    console.log("[Call-Completed] Full payload:", JSON.stringify(body, null, 2));
    console.log("[Call-Completed] ================================");

    const tenantId = process.env.DEFAULT_TENANT_ID || "00000000-0000-0000-0000-000000000001";

    // Normalize field names from Zapier payload
    const rawTimestamp = body.timestamp || body.callStartTime || body.startTime;
    const timestamp = new Date(rawTimestamp || Date.now());
    const direction = body.direction?.toLowerCase() === "inbound" ? "inbound" : "outbound";

    // Extract phone numbers from SIP URIs if needed
    const callerNumber = extractPhoneFromSIP(body.callerPhone || body.callerNumber);
    const calledNumber = extractPhoneFromSIP(body.calledNumber);
    // Also extract extension from SIP URI - it might come as sip:+12058475616@tcds.al.3cx.us
    const rawExtension = extractPhoneFromSIP(body.extension || body.agentExtension || "");

    // Get just the digits from the extension
    const extDigits = rawExtension.replace(/\D/g, "");

    // For database storage, truncate to last 10 chars (extension column is varchar(10))
    const extension = extDigits.slice(-10);
    const extensionLooksLikePhone = extDigits.length > 5;
    if (extensionLooksLikePhone) {
      console.log("[Call-Completed] ⚠️ WARNING: Extension looks like a phone number:", rawExtension, "->", extension);
      console.log("[Call-Completed] ⚠️ This will cause agent matching to fail!");
    }

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

      // Map status from ring group bridge (completed, missed, abandoned) to our enum
      const incomingStatus = (body.status || "completed").toLowerCase();
      const finalStatus = incomingStatus === "missed" ? "missed" :
                          incomingStatus === "abandoned" ? "missed" :
                          "completed";

      // Update call with VoIPTools data
      const [updated] = await db
        .update(calls)
        .set({
          externalCallId: body.callId,
          status: finalStatus,
          endedAt: timestamp,
          durationSeconds: body.duration,
          recordingUrl: body.recordingUrl,
        })
        .where(eq(calls.id, call.id))
        .returning();

      call = updated;
    } else {
      matchStatus = "created";

      // =========================================================================
      // NO MATCHING CALL FOUND - Creating new record
      // Check if this is an after-hours/fallback call (extension is a phone number)
      // =========================================================================
      const isAfterHoursOrFallback = extensionLooksLikePhone;

      if (isAfterHoursOrFallback) {
        console.log("[Call-Completed] 📞 AFTER-HOURS/FALLBACK CALL DETECTED");
        console.log("[Call-Completed] 📞 Extension is a phone number:", extension);
        console.log("[Call-Completed] 📞 This call will be marked as after-hours/unassigned");
      } else {
        console.log("[Call-Completed] ⚠️ NO MATCHING CALL - Creating new record");
        console.log("[Call-Completed] ⚠️ callId:", body.callId);
        console.log("[Call-Completed] ⚠️ extension from payload:", extension);
      }

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

      // Find agent by extension - skip if extension is a phone number (won't match anyway)
      let agentId: string | undefined;
      if (extension && !isAfterHoursOrFallback) {
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
          // Mark after-hours calls with disposition
          disposition: isAfterHoursOrFallback ? "after_hours" : undefined,
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
      analysis = await analyzeTranscript(transcript, body.duration || 0);

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

    // 3.5 Detect short calls and hangups (but don't skip wrapup creation)
    const isShortCall = (body.duration || 0) < 15; // Less than 15 seconds
    const isHangup = analysis?.isHangup || isShortCall;
    const hangupReason = isShortCall ? "short_call" : (analysis?.isHangup ? "hangup" : null);

    if (isHangup) {
      console.log(`[Call-Completed] Detected hangup/short call: ${hangupReason} (duration: ${body.duration}s)`);

      await db
        .update(calls)
        .set({
          disposition: "hangup",
          aiSummary: analysis?.summary || (isShortCall ? "Short call - no conversation" : "Hangup - no meaningful conversation"),
          predictedReason: hangupReason,
          transcriptionStatus: "completed",
          updatedAt: new Date(),
        })
        .where(eq(calls.id, call.id));
    } else {
      // Mark transcription as completed for normal calls
      await db
        .update(calls)
        .set({
          transcriptionStatus: "completed",
          updatedAt: new Date(),
        })
        .where(eq(calls.id, call.id));
    }

    // 4. Create wrap-up draft with customer matching (for ALL calls, including hangups for QA)
    let wrapupId: string | null = null;
    let customerMatchStatus: "matched" | "multiple_matches" | "unmatched" = "unmatched";
    let matchedAzCustomerId: string | null = null;
    let trestleData: Record<string, unknown> | null = null;

    // Create wrapup for calls with analysis OR hangups (for QA review)
    if (analysis || isHangup) {
      // Get customer phone from call record (preferred) or webhook data
      // For outbound calls: customer is the "to" number
      // For inbound calls: customer is the "from" number
      const callDir = call.direction || direction;
      const customerPhone = callDir === "inbound"
        ? (call.fromNumber || callerNumber)
        : (call.toNumber || calledNumber);
      const phoneForLookup = analysis?.extractedData?.phone || customerPhone;

      // 4.1 Customer matching - PRIORITY: Use screen pop match if available
      let azMatches: AgencyZoomCustomer[] = [];
      let azLeadMatches: AgencyZoomLead[] = [];
      let matchType: "customer" | "lead" | "none" = "none";
      let matchedCustomerName: string | null = null;
      let matchedLeadId: string | null = null;

      // First, check if customer was already matched during screen pop
      if (call.customerId) {
        try {
          const [existingCustomer] = await db
            .select({
              id: customers.id,
              firstName: customers.firstName,
              lastName: customers.lastName,
              agencyzoomId: customers.agencyzoomId,
            })
            .from(customers)
            .where(eq(customers.id, call.customerId))
            .limit(1);

          if (existingCustomer) {
            // Use the screen pop match
            customerMatchStatus = "matched";
            matchedAzCustomerId = existingCustomer.agencyzoomId || null;
            matchedCustomerName = `${existingCustomer.firstName || ""} ${existingCustomer.lastName || ""}`.trim() || null;
            matchType = "customer";
            console.log(`[Call-Completed] Using screen pop match: customer ${call.customerId} (AZ: ${matchedAzCustomerId})`);
          }
        } catch (error) {
          console.error("[Call-Completed] Failed to lookup screen pop customer:", error);
        }
      }

      // Only do AgencyZoom phone lookup if no screen pop match
      if (customerMatchStatus === "unmatched") {
        try {
          const azClient = await getAgencyZoomClient();
          if (azClient && phoneForLookup) {
            // First search customers
            azMatches = await azClient.findCustomersByPhone(phoneForLookup, 5);
            console.log(`[Call-Completed] AgencyZoom customer lookup for ${phoneForLookup}: ${azMatches.length} matches`);

          // If no customers found, search leads
          if (azMatches.length === 0) {
            try {
              const normalizedPhone = phoneForLookup.replace(/\D/g, "");
              const leadsResult = await azClient.getLeads({ searchText: normalizedPhone, limit: 5 });
              azLeadMatches = leadsResult.data;
              console.log(`[Call-Completed] AgencyZoom lead lookup for ${phoneForLookup}: ${azLeadMatches.length} matches`);
              matchType = azLeadMatches.length > 0 ? "lead" : "none";
            } catch (leadError) {
              console.error("[Call-Completed] AgencyZoom lead lookup error:", leadError);
            }
          } else {
            matchType = "customer";
          }
        }
        } catch (error) {
          console.error("[Call-Completed] AgencyZoom lookup error:", error);
        }

        // Determine match status from phone lookup - check customers first, then leads
        if (azMatches.length === 1 && azMatches[0]) {
          customerMatchStatus = "matched";
          matchedAzCustomerId = azMatches[0].id.toString();
          matchedCustomerName = `${azMatches[0].firstName || ""} ${azMatches[0].lastName || ""}`.trim() || null;
          matchType = "customer";
          console.log(`[Call-Completed] Single customer match: AZ customer ${matchedAzCustomerId}`);
        } else if (azMatches.length > 1) {
          customerMatchStatus = "multiple_matches";
          matchType = "customer";
          console.log(`[Call-Completed] Multiple customer matches: ${azMatches.length} customers`);
        } else if (azLeadMatches.length === 1 && azLeadMatches[0]) {
          // Single lead match
          customerMatchStatus = "matched";
          matchedLeadId = azLeadMatches[0].id.toString();
          matchedCustomerName = `${azLeadMatches[0].firstName || ""} ${azLeadMatches[0].lastName || ""}`.trim() || null;
          matchType = "lead";
          console.log(`[Call-Completed] Single lead match: AZ lead ${matchedLeadId}`);
        } else if (azLeadMatches.length > 1) {
          customerMatchStatus = "multiple_matches";
          matchType = "lead";
          console.log(`[Call-Completed] Multiple lead matches: ${azLeadMatches.length} leads`);
        }
      } // end if (customerMatchStatus === "unmatched") - AgencyZoom lookup block

      // 4.2 Trestle IQ lookup for unmatched calls
      if (customerMatchStatus === "unmatched") {
        // Trestle IQ lookup for unmatched calls
        if (phoneForLookup) {
          try {
            if (trestleIQClient) {
              const trestleResult = await trestleIQClient.reversePhone(phoneForLookup);
              if (trestleResult) {
                trestleData = {
                  phoneNumber: trestleResult.phoneNumber,
                  lineType: trestleResult.lineType,
                  carrier: trestleResult.carrier,
                  person: trestleResult.person,
                  address: trestleResult.address,
                  emails: trestleResult.emails,
                  confidence: trestleResult.confidence,
                };
                console.log(`[Call-Completed] Trestle lookup: ${trestleResult.person?.name || "No name found"}`);
              }
            }
          } catch (error) {
            console.error("[Call-Completed] Trestle lookup error:", error);
          }
        }
      }

      // 4.3 Create wrapup draft (with transaction for data consistency)
      const serviceRequestTypeId = analysis ? getServiceRequestTypeId(analysis.serviceRequestType || analysis.callType) : null;
      const trestlePersonName = (trestleData as { person?: { name?: string } } | null)?.person?.name;
      const trestleEmails = (trestleData as { emails?: string[] } | null)?.emails;

      // STRICT AUTO-VOID: Only auto-void if there's NO transcript AND NO customer match
      // If there's a transcript OR a customer match, it goes to pending review for E&O logging
      const hasNoTranscript = !transcript || transcript.trim().length < 50;
      const hasNoMatch = customerMatchStatus === "unmatched";
      const shouldAutoVoid = hasNoTranscript && hasNoMatch;
      const autoVoidReason = shouldAutoVoid ? "no_transcript_no_match" : null;
      const wrapupStatus = shouldAutoVoid ? "completed" as const : "pending_review" as const;

      if (shouldAutoVoid) {
        console.log(`[Call-Completed] Auto-voiding: no transcript (length: ${transcript?.length || 0}) AND no customer match`);
      } else if (hasNoTranscript && !hasNoMatch) {
        console.log(`[Call-Completed] NOT auto-voiding: no transcript but has customer match (${customerMatchStatus}) - needs E&O review`);
      }

      // Use transaction to ensure wrapup and match suggestions are created atomically
      // Use upsert to handle duplicate webhook calls (Zapier may retry)
      const txResult = await db.transaction(async (tx) => {
        // Prefer extension from call record (set during call-started), fall back to webhook body
        const agentExt = call.extension || extension;
        // Prefer direction from call record
        const callDirection = call.direction || direction;
        // Check if this is an after-hours call (from disposition set during call creation)
        const isAfterHoursCall = call.disposition === "after_hours";

        if (isAfterHoursCall) {
          console.log("[Call-Completed] 📞 Creating wrapup for AFTER-HOURS call - will be marked for special handling");
        }

        // Look up agent name from users table using agentId or extension
        let agentName: string | null = body.agentName || null;
        if (!agentName && !isAfterHoursCall) {
          // First try to get from call's agentId
          if (call.agentId) {
            const [agent] = await tx
              .select({ firstName: users.firstName, lastName: users.lastName })
              .from(users)
              .where(eq(users.id, call.agentId))
              .limit(1);
            if (agent) {
              agentName = `${agent.firstName || ""} ${agent.lastName || ""}`.trim() || null;
            }
          }
          // Fallback: look up by extension
          if (!agentName && agentExt) {
            const extDigits = agentExt.replace(/\D/g, "");
            if (extDigits.length <= 5) { // Only look up if it looks like an extension
              const [agent] = await tx
                .select({ firstName: users.firstName, lastName: users.lastName })
                .from(users)
                .where(and(eq(users.tenantId, tenantId), eq(users.extension, extDigits)))
                .limit(1);
              if (agent) {
                agentName = `${agent.firstName || ""} ${agent.lastName || ""}`.trim() || null;
              }
            }
          }
        }
        console.log(`[Call-Completed] Resolved agent name: ${agentName || "NULL"} (ext: ${agentExt}, agentId: ${call.agentId || "NULL"})`);

        const wrapupValues = {
          tenantId,
          callId: call.id,
          direction: (callDirection === "inbound" ? "Inbound" : "Outbound") as "Inbound" | "Outbound",
          agentExtension: isAfterHoursCall ? "after-hours" : agentExt, // Clear marker for after-hours
          agentName: isAfterHoursCall ? "After-Hours Service" : agentName,
          summary: analysis?.summary || (isShortCall ? "Short call - no conversation" : (isAfterHoursCall ? "After-hours call - forwarded to voicemail service" : "Hangup - no meaningful conversation")),
          customerName: matchedCustomerName || analysis?.extractedData?.customerName || trestlePersonName,
          customerPhone: phoneForLookup,
          customerEmail: analysis?.extractedData?.email || (trestleEmails && trestleEmails.length > 0 ? trestleEmails[0] : undefined),
          requestType: isAfterHoursCall ? "after_hours" : (analysis?.callType || hangupReason),
          status: wrapupStatus,
          matchStatus: customerMatchStatus,
          trestleData: trestleData,
          aiCleanedSummary: analysis?.summary,
          aiProcessingStatus: analysis ? "completed" : "skipped",
          aiProcessedAt: new Date(),
          aiExtraction: analysis ? {
            actionItems: analysis.actionItems,
            extractedData: analysis.extractedData,
            sentiment: analysis.sentiment,
            serviceRequestType: analysis.serviceRequestType,
            serviceRequestTypeId,
            agencyZoomCustomerId: matchedAzCustomerId,
            agencyZoomLeadId: matchedLeadId,
            matchType,
          } : null,
          aiConfidence: analysis ? "0.85" : null,
          isAutoVoided: shouldAutoVoid,
          autoVoidReason: shouldAutoVoid ? autoVoidReason : null,
        };

        const [wrapup] = await tx
          .insert(wrapupDrafts)
          .values(wrapupValues)
          .onConflictDoUpdate({
            target: wrapupDrafts.callId,
            set: {
              summary: wrapupValues.summary,
              customerName: wrapupValues.customerName,
              customerPhone: wrapupValues.customerPhone,
              customerEmail: wrapupValues.customerEmail,
              requestType: wrapupValues.requestType,
              aiCleanedSummary: wrapupValues.aiCleanedSummary,
              aiProcessingStatus: wrapupValues.aiProcessingStatus,
              aiProcessedAt: wrapupValues.aiProcessedAt,
              aiExtraction: wrapupValues.aiExtraction,
              aiConfidence: wrapupValues.aiConfidence,
              updatedAt: new Date(),
            },
          })
          .returning();

        let suggestionCount = 0;

        // 4.4 Store match suggestions for multiple matches (customers or leads)
        if (customerMatchStatus === "multiple_matches") {
          const suggestions: Array<{
            tenantId: string;
            wrapupDraftId: string;
            source: string;
            contactType: string;
            contactId: string;
            contactName: string;
            contactPhone: string | null;
            contactEmail: string | null;
            confidence: string;
            matchReason: string;
            recommendedAction: string;
          }> = [];

          // Add customer matches
          if (azMatches.length > 0) {
            azMatches.forEach((az, index) => {
              suggestions.push({
                tenantId,
                wrapupDraftId: wrapup.id,
                source: "agencyzoom",
                contactType: az.customerType || "customer",
                contactId: az.id.toString(),
                contactName: az.businessName || `${az.firstName || ''} ${az.lastName || ''}`.trim() || 'Unknown',
                contactPhone: az.phone || az.phoneCell,
                contactEmail: az.email,
                confidence: (1 - index * 0.1).toFixed(2),
                matchReason: "Phone number match - Customer",
                recommendedAction: index === 0 ? "review" : "consider",
              });
            });
          }

          // Add lead matches
          if (azLeadMatches.length > 0) {
            azLeadMatches.forEach((lead, index) => {
              suggestions.push({
                tenantId,
                wrapupDraftId: wrapup.id,
                source: "agencyzoom",
                contactType: "lead",
                contactId: lead.id.toString(),
                contactName: `${lead.firstName || ''} ${lead.lastName || ''}`.trim() || 'Unknown',
                contactPhone: lead.phone,
                contactEmail: lead.email,
                confidence: (0.9 - index * 0.1).toFixed(2), // Leads slightly lower confidence
                matchReason: "Phone number match - Lead",
                recommendedAction: index === 0 && azMatches.length === 0 ? "review" : "consider",
              });
            });
          }

          if (suggestions.length > 0) {
            await tx.insert(matchSuggestions).values(suggestions);
            suggestionCount = suggestions.length;
          }
        }

        return { wrapup, suggestionCount };
      });

      wrapupId = txResult.wrapup.id;
      console.log(`[Call-Completed] Created wrap-up draft: ${wrapupId} (matchStatus: ${customerMatchStatus}${shouldAutoVoid ? ", auto-voided: " + hangupReason : ""})`);
      if (txResult.suggestionCount > 0) {
        console.log(`[Call-Completed] Stored ${txResult.suggestionCount} match suggestions (${azMatches.length} customers, ${azLeadMatches.length} leads)`);
      }

      // Note: Triage items removed - wrapup_drafts is the single source of truth
      // All call review happens through /pending-review using wrapup_drafts table
    }

    // 5. NOTE: Auto-posting to AgencyZoom removed
    // All CRM posting is now handled through the Wrapup Review UI
    // This ensures agents can review/edit summaries before posting and avoids duplicate notes

    // 6. Log for E&O compliance (only for matched calls with a customer)
    // Unmatched calls are tracked via wrapup_drafts with match_status='unmatched'
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

    // Broadcast call_ended to realtime server for UI popup closure
    await notifyRealtimeServer({
      type: "call_ended",
      sessionId: call.id,
      externalCallId: call.externalCallId,
      extension,
      duration: body.duration,
      status: call.status,
    });

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
