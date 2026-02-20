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

import { NextRequest, NextResponse, after } from "next/server";
import { db } from "@/db";
import { calls, customers, wrapupDrafts, activities, users, matchSuggestions, triageItems, messages, pendingTranscriptJobs, reviewRequests, googleReviews, serviceTickets, tenants } from "@/db/schema";
import {
  SERVICE_PIPELINES,
  PIPELINE_STAGES,
  SERVICE_CATEGORIES,
  SERVICE_PRIORITIES,
  EMPLOYEE_IDS,
  SPECIAL_HOUSEHOLDS,
  getDefaultDueDate,
} from "@/lib/api/agencyzoom-service-tickets";
import { eq, or, ilike, and, gte, lte, desc, isNotNull, sql } from "drizzle-orm";
import { getMSSQLTranscriptsClient } from "@/lib/api/mssql-transcripts";
import { getAgencyZoomClient, type AgencyZoomCustomer, type AgencyZoomLead } from "@/lib/api/agencyzoom";
import { trestleIQClient, quickLeadCheck } from "@/lib/api/trestleiq";
import { getServiceRequestTypeId } from "@/lib/constants/agencyzoom";
import { findRelatedTickets, determineTriageRecommendation } from "@/lib/triage/related-tickets";
import { createAfterHoursServiceTicket } from "@/lib/api/after-hours-ticket";
import { formatInboundCallDescription, formatSentimentEmoji } from "@/lib/format-ticket-description";

// =============================================================================
// AGENCY MAIN NUMBER
// When calls come through with this as the "extension", it means:
// - Call was routed via IVR, after-hours service, or call forwarding
// - NOT a direct agent call - will not match to any agent
// - Should be treated as after-hours/unassigned
// =============================================================================
const AGENCY_MAIN_NUMBER = "2058475616"; // +1 (205) 847-5616

// =============================================================================
// REALTIME SERVER NOTIFICATION
// =============================================================================

async function notifyRealtimeServer(event: Record<string, unknown>) {
  const realtimeUrl = process.env.REALTIME_SERVER_URL;
  if (!realtimeUrl) return; // Skip if no realtime server configured

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

// Timeout wrapper for external API calls to prevent hanging
async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  fallback: T
): Promise<T> {
  const timeout = new Promise<T>((resolve) =>
    setTimeout(() => resolve(fallback), timeoutMs)
  );
  return Promise.race([promise, timeout]);
}

// =============================================================================
// REVIEW REQUEST SCHEDULING
// Calculate next business hour for review request SMS (Mon-Fri, 9am-6pm CST)
// =============================================================================

function getNextBusinessHour(): Date {
  const now = new Date();
  // Convert to CST (UTC-6)
  const cstOffset = -6 * 60;
  const utcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  const cstMinutes = utcMinutes + cstOffset;
  const cstHour = Math.floor(((cstMinutes % 1440) + 1440) % 1440 / 60);
  const dayOfWeek = now.getUTCDay();

  // Adjust day of week for CST
  let cstDay = dayOfWeek;
  if (cstMinutes < 0) cstDay = (dayOfWeek + 6) % 7;
  if (cstMinutes >= 1440) cstDay = (dayOfWeek + 1) % 7;

  const scheduledDate = new Date(now);

  // Business hours: 9am-6pm CST, Monday(1) - Friday(5)
  const isBusinessDay = cstDay >= 1 && cstDay <= 5;
  const isBusinessHours = cstHour >= 9 && cstHour < 18;

  if (isBusinessDay && isBusinessHours) {
    // Within business hours - schedule for 1 hour from now
    scheduledDate.setTime(now.getTime() + 60 * 60 * 1000);
  } else if (isBusinessDay && cstHour < 9) {
    // Before business hours on a weekday - schedule for 9am CST today
    scheduledDate.setUTCHours(9 + 6, 0, 0, 0); // 9am CST = 15:00 UTC
  } else {
    // After hours or weekend - find next business day at 9am CST
    let daysToAdd = 1;
    let nextDay = (cstDay + 1) % 7;

    // Skip to Monday if weekend
    while (nextDay === 0 || nextDay === 6) {
      daysToAdd++;
      nextDay = (nextDay + 1) % 7;
    }

    scheduledDate.setTime(now.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
    scheduledDate.setUTCHours(9 + 6, 0, 0, 0); // 9am CST = 15:00 UTC
  }

  return scheduledDate;
}

// =============================================================================
// AFTER-HOURS DUPLICATE CHECK
// Check if there's already an after-hours triage item or message for this phone
// This prevents duplicates when both email webhook and call-completed fire
// =============================================================================

interface AfterHoursMatch {
  found: boolean;
  triageItemId?: string;
  messageId?: string;
}

async function checkExistingAfterHoursEntry(
  tenantId: string,
  phone: string
): Promise<AfterHoursMatch> {
  if (!phone) return { found: false };

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const normalizedPhone = phone.replace(/\D/g, "").slice(-10);

  if (normalizedPhone.length < 10) return { found: false };

  // First check for existing triage item (from after-hours-email webhook)
  const [existingTriage] = await db
    .select({ id: triageItems.id, messageId: triageItems.messageId })
    .from(triageItems)
    .leftJoin(messages, eq(triageItems.messageId, messages.id))
    .where(
      and(
        eq(triageItems.tenantId, tenantId),
        eq(triageItems.type, "after_hours"),
        gte(triageItems.createdAt, oneHourAgo),
        or(
          ilike(messages.fromNumber, `%${normalizedPhone}`),
          ilike(messages.fromNumber, `+1${normalizedPhone}`)
        )
      )
    )
    .orderBy(desc(triageItems.createdAt))
    .limit(1);

  if (existingTriage) {
    console.log(`[Call-Completed] Found existing after-hours triage item ${existingTriage.id} for phone ${phone}`);
    return {
      found: true,
      triageItemId: existingTriage.id,
      messageId: existingTriage.messageId || undefined,
    };
  }

  // Also check for orphaned after-hours messages (without triage item)
  const [existingMessage] = await db
    .select({ id: messages.id })
    .from(messages)
    .where(
      and(
        eq(messages.tenantId, tenantId),
        eq(messages.isAfterHours, true),
        gte(messages.createdAt, oneHourAgo),
        or(
          ilike(messages.fromNumber, `%${normalizedPhone}`),
          ilike(messages.fromNumber, `+1${normalizedPhone}`)
        )
      )
    )
    .orderBy(desc(messages.createdAt))
    .limit(1);

  if (existingMessage) {
    console.log(`[Call-Completed] Found existing after-hours message ${existingMessage.id} for phone ${phone}`);
    return {
      found: true,
      messageId: existingMessage.id,
    };
  }

  return { found: false };
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
  // Use last 10 digits for flexible matching (handles +1, no prefix, etc.)
  const callerDigits = callerNumber.replace(/\D/g, "").slice(-10);
  const calledDigits = calledNumber.replace(/\D/g, "").slice(-10);

  // Build phone matching conditions using ILIKE for flexible matching
  const phoneMatchConditions = [];
  if (callerDigits.length >= 10) {
    phoneMatchConditions.push(
      ilike(calls.fromNumber, `%${callerDigits}`),
      ilike(calls.toNumber, `%${callerDigits}`)
    );
  }
  if (calledDigits.length >= 10) {
    phoneMatchConditions.push(
      ilike(calls.fromNumber, `%${calledDigits}`),
      ilike(calls.toNumber, `%${calledDigits}`)
    );
  }

  if (phoneMatchConditions.length > 0) {
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
          or(...phoneMatchConditions)
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
          or(...phoneMatchConditions)
        )
      )
      .orderBy(desc(calls.startedAt))
      .limit(1);

    if (byPhoneTime) {
      return { call: byPhoneTime, method: "phone_time", confidence: 0.9 };
    }
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
  detectedDirection?: "inbound" | "outbound"; // AI-detected direction from transcript content
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
            content: `You are an insurance agency call analyst creating service request summaries.

You will be given:
- A call transcript
- The call duration in seconds

Known Call Representatives (Authorized Agent Names):
Todd, Lee, Stephanie, Blair, Paulo, Montrice

SUMMARY FORMAT - THIS IS CRITICAL:
The summary should be a SHORT, DIRECT description of what the caller requested or needed.
Format: "[Customer name if known] called to [specific request]."

GOOD SUMMARY EXAMPLES:
- "John Smith called to add a 2024 Toyota Camry to his auto policy."
- "Customer called to request proof of insurance for a new apartment."
- "Mary Johnson called about a billing question - payment not showing."
- "Caller requested a quote for homeowners insurance."
- "Customer called to report a fender bender accident from yesterday."
- "Voicemail left - caller needs callback about policy renewal."

BAD SUMMARY EXAMPLES (too long/narrative):
- "The customer, John Smith, contacted the agency today to discuss adding a vehicle..."
- "This call was regarding the customer's insurance needs..."
- "Agent Todd spoke with the customer about their policy..."

CORE RULES:
- Summary should be 1-2 sentences MAX - state the request directly
- Lead with the customer name if mentioned, otherwise "Customer" or "Caller"
- Focus on WHAT they need, not the conversation flow
- Include key details inline (vehicle year/make, address, policy number)

ACTION ITEMS FORMAT:
- Each action must include: WHO is responsible, WHAT needs to be done
- Keep brief: "Add 2024 Camry to policy" not "The agent needs to process the addition of..."
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

DETECTED DIRECTION (important - determine from transcript content):
- "inbound" - a customer/caller contacted the agency (someone called in asking for help, quotes, service)
- "outbound" - an agency representative called a customer (agent names: Todd, Lee, Stephanie, Blair, Paulo, Montrice called or left a message FOR someone)
Look at WHO initiated the conversation. If an agent name is the one calling/leaving a message, it's outbound.

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
  "serviceRequestType": "billing inquiry|policy change|add vehicle|remove vehicle|add driver|remove driver|claims|renewal|quote request|cancel|certificate|id card|general inquiry",
  "detectedDirection": "inbound|outbound"
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

// Give after() enough time to complete all background processing
// (AI analysis, customer matching, wrapup creation, auto-ticket creation)
export const maxDuration = 60;

// Background processing - return immediately, process async
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Parse body immediately
    const body: VoIPToolsPayload = await request.json();

    console.log("[Call-Completed] Received webhook, processing with after()");
    console.log("[Call-Completed] callId:", body.callId);

    // Use Next.js after() to process in background while keeping function alive
    after(async () => {
      try {
        await processCallCompletedBackground(body, startTime);
      } catch (err) {
        console.error("[Call-Completed] Background processing error:", err);
      }
    });

    // Return immediately - Zapier gets fast response
    // after() ensures the function stays alive to complete processing
    return NextResponse.json({
      success: true,
      message: "Webhook received, processing in background",
      callId: body.callId,
    });
  } catch (error) {
    console.error("[Call-Completed] Failed to parse webhook:", error);
    return NextResponse.json(
      { success: false, error: "Invalid payload" },
      { status: 400 }
    );
  }
}

async function processCallCompletedBackground(body: VoIPToolsPayload, startTime: number): Promise<void> {
  try {

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
    let direction = body.direction?.toLowerCase() === "inbound" ? "inbound" : "outbound";

    // ==========================================================================
    // IMPORTANT: Agency Main Number is +12058475616
    // When extension field contains this number (as SIP URI or digits), it means:
    // - The call was routed through the main line (IVR, after-hours, forwarded)
    // - These are typically OUTBOUND from customer perspective (customer called in)
    // - Agent matching will fail because this isn't a real agent extension
    // - These calls should be marked as after-hours or unassigned
    // ==========================================================================

    // Extract phone numbers from SIP URIs if needed
    const callerNumber = extractPhoneFromSIP(body.callerPhone || body.callerNumber);
    const calledNumber = extractPhoneFromSIP(body.calledNumber);
    // Also extract extension from SIP URI - it might come as sip:+12058475616@tcds.al.3cx.us
    const rawExtension = extractPhoneFromSIP(body.extension || body.agentExtension || "");

    // Get just the digits from the extension
    const extDigits = rawExtension.replace(/\D/g, "");

    // For database storage, truncate to last 10 chars (extension column is varchar(10))
    const extension = extDigits.slice(-10);

    // Check if this is the agency main number (indicates IVR/after-hours/forwarded call)
    const isAgencyMainNumber = extDigits.includes(AGENCY_MAIN_NUMBER) || extension === AGENCY_MAIN_NUMBER;
    const extensionLooksLikePhone = extDigits.length > 5;

    if (isAgencyMainNumber) {
      console.log("[Call-Completed] 📞 Extension is agency main number - this is an IVR/after-hours call");
    } else if (extensionLooksLikePhone) {
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
      // Also backfill phone numbers if presence-created call has "Unknown" placeholders
      const needsFromBackfill = (!call.fromNumber || call.fromNumber === "Unknown") && callerNumber && callerNumber !== "Unknown";
      const needsToBackfill = (!call.toNumber || call.toNumber === "Unknown") && calledNumber && calledNumber !== "Unknown";

      const updateFields: Record<string, unknown> = {
        externalCallId: body.callId,
        status: finalStatus,
        endedAt: timestamp,
        durationSeconds: body.duration,
        recordingUrl: body.recordingUrl,
      };

      if (needsFromBackfill) {
        updateFields.fromNumber = normalizePhone(callerNumber);
        console.log(`[Call-Completed] 📞 Backfilling fromNumber: "Unknown" → ${normalizePhone(callerNumber)} for call ${call.id}`);
      }
      if (needsToBackfill) {
        updateFields.toNumber = normalizePhone(calledNumber);
        console.log(`[Call-Completed] 📞 Backfilling toNumber: "Unknown" → ${normalizePhone(calledNumber)} for call ${call.id}`);
      }

      // Backfill agentId if not set (e.g., outbound calls where extension was a phone number)
      if (!call.agentId) {
        let foundAgent: { id: string } | undefined;
        // Try by short extension
        if (extension && !extensionLooksLikePhone) {
          const extDigits = extension.replace(/\D/g, "");
          [foundAgent] = await db
            .select({ id: users.id })
            .from(users)
            .where(and(eq(users.tenantId, tenantId), eq(users.extension, extDigits)))
            .limit(1);
        }
        // Try by phone/directDial
        if (!foundAgent && extension && extensionLooksLikePhone) {
          const phoneDigits = extension.replace(/\D/g, "").slice(-10);
          [foundAgent] = await db
            .select({ id: users.id })
            .from(users)
            .where(
              and(
                eq(users.tenantId, tenantId),
                or(
                  ilike(users.phone, `%${phoneDigits}`),
                  ilike(users.directDial, `%${phoneDigits}`)
                )
              )
            )
            .limit(1);
        }
        // Try by agentName from webhook payload
        if (!foundAgent && body.agentName) {
          const nameParts = body.agentName.trim().split(/\s+/);
          if (nameParts.length >= 2) {
            const [first, ...rest] = nameParts;
            const last = rest.join(" ");
            [foundAgent] = await db
              .select({ id: users.id })
              .from(users)
              .where(and(eq(users.tenantId, tenantId), ilike(users.firstName, first), ilike(users.lastName, last)))
              .limit(1);
          }
        }
        if (foundAgent) {
          updateFields.agentId = foundAgent.id;
          console.log(`[Call-Completed] 👤 Backfilling agentId: ${foundAgent.id} for call ${call.id}`);
        }
      }

      // Backfill customerId if phone was backfilled and no customer is linked
      if ((needsFromBackfill || needsToBackfill) && !call.customerId) {
        const backfilledPhone = direction === "inbound"
          ? (needsFromBackfill ? callerNumber : call.fromNumber)
          : (needsToBackfill ? calledNumber : call.toNumber);
        const backfilledDigits = (backfilledPhone || "").replace(/\D/g, "");

        if (backfilledDigits.length >= 10) {
          const [foundCustomer] = await db
            .select({ id: customers.id })
            .from(customers)
            .where(
              and(
                eq(customers.tenantId, tenantId),
                or(
                  ilike(customers.phone, `%${backfilledDigits.slice(-10)}`),
                  ilike(customers.phoneAlt, `%${backfilledDigits.slice(-10)}`)
                )
              )
            )
            .limit(1);

          if (foundCustomer) {
            updateFields.customerId = foundCustomer.id;
            console.log(`[Call-Completed] 👤 Backfilling customerId: ${foundCustomer.id} for call ${call.id}`);
          }
        }
      }

      const [updated] = await db
        .update(calls)
        .set(updateFields)
        .where(eq(calls.id, call.id))
        .returning();

      call = updated;
    } else {
      matchStatus = "created";

      // =========================================================================
      // NO MATCHING CALL FOUND - Creating new record
      // Check if this is an after-hours/fallback call:
      // - Extension is the agency main number (IVR/forwarded)
      // - Extension looks like a phone number (not a real agent extension)
      // =========================================================================
      const isAfterHoursOrFallback = direction === "inbound" && (isAgencyMainNumber || extensionLooksLikePhone);

      if (isAfterHoursOrFallback) {
        console.log("[Call-Completed] 📞 AFTER-HOURS/FALLBACK CALL DETECTED");
        console.log("[Call-Completed] 📞 Reason:", isAgencyMainNumber ? "Agency main number" : "Extension is phone number", "->", extension);
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

      // Find agent by extension, or by phone number for outbound calls
      let agentId: string | undefined;
      if (extension && !isAfterHoursOrFallback) {
        const extDigits = extension.replace(/\D/g, "");
        // First try matching by short extension (e.g., "102")
        if (!extensionLooksLikePhone) {
          const [agent] = await db
            .select({ id: users.id })
            .from(users)
            .where(and(eq(users.tenantId, tenantId), eq(users.extension, extDigits)))
            .limit(1);
          agentId = agent?.id;
        }
        // Fallback: if extension is a phone number, match against users.phone or directDial
        if (!agentId && extensionLooksLikePhone) {
          const phoneDigits = extDigits.slice(-10);
          const [agent] = await db
            .select({ id: users.id })
            .from(users)
            .where(
              and(
                eq(users.tenantId, tenantId),
                or(
                  ilike(users.phone, `%${phoneDigits}`),
                  ilike(users.directDial, `%${phoneDigits}`)
                )
              )
            )
            .limit(1);
          agentId = agent?.id;
          if (agentId) {
            console.log(`[Call-Completed] 👤 Matched agent by phone/directDial: ${phoneDigits}`);
          }
        }
      }

      // Fallback: match by agentName from webhook payload (e.g., "Lee Tidwell")
      if (!agentId && body.agentName && !isAfterHoursOrFallback) {
        const nameParts = body.agentName.trim().split(/\s+/);
        if (nameParts.length >= 2) {
          const [first, ...rest] = nameParts;
          const last = rest.join(" ");
          const [agent] = await db
            .select({ id: users.id })
            .from(users)
            .where(and(eq(users.tenantId, tenantId), ilike(users.firstName, first), ilike(users.lastName, last)))
            .limit(1);
          agentId = agent?.id;
          if (agentId) {
            console.log(`[Call-Completed] 👤 Matched agent by name: ${body.agentName}`);
          }
        }
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

    // Fallback: fetch from MSSQL if no transcript yet (with 8s total timeout including client init)
    if (!transcript && body.callId) {
      try {
        const mssqlClient = await withTimeout(
          getMSSQLTranscriptsClient(),
          3000, // 3s timeout for client init
          null
        );
        if (mssqlClient) {
          const transcriptData = await withTimeout(
            mssqlClient.getTranscriptById(body.callId),
            5000, // 5 second timeout for query
            null
          );
          if (transcriptData?.transcript) {
            transcript = transcriptData.transcript;
            transcriptSource = "mssql";

            // Update call with transcript (non-blocking)
            db.update(calls)
              .set({ transcription: transcript })
              .where(eq(calls.id, call.id))
              .catch(err => console.error("[Call-Completed] Failed to save transcript:", err));
            console.log("[Call-Completed] Fetched transcript from MSSQL");
          }
        }
      } catch (error) {
        console.error("[Call-Completed] MSSQL fetch error:", error);
      }
    }

    console.log(`[Call-Completed] Transcript source: ${transcriptSource}, length: ${transcript.length}`);

    // 2.5 No transcript available — defer to transcript worker (unless short/hangup call)
    const isShortCallEarly = (body.duration || 0) < 15;
    if ((!transcript || transcript.length < 50) && !isShortCallEarly) {
      console.log(`[Call-Completed] No transcript available (length: ${transcript?.length || 0}) — creating pendingTranscriptJob for call ${call.id}`);

      // Determine customer phone for the job
      const callDir = call.direction || direction;
      const jobCallerNumber = callDir === "inbound"
        ? (call.fromNumber || callerNumber)
        : (call.toNumber || calledNumber);

      try {
        const nextAttemptAt = new Date(Date.now() + 15 * 1000); // 15s delay
        await db
          .insert(pendingTranscriptJobs)
          .values({
            tenantId,
            callId: call.id,
            callerNumber: jobCallerNumber || null,
            agentExtension: call.extension || extension || null,
            externalCallId: body.callId || null,
            callStartedAt: call.startedAt || new Date(),
            callEndedAt: call.endedAt || new Date(),
            status: "pending",
            nextAttemptAt,
            attemptCount: 0,
          });

        // Update call transcription status
        await db
          .update(calls)
          .set({
            transcriptionStatus: "pending",
            updatedAt: new Date(),
          })
          .where(eq(calls.id, call.id));

        console.log(`[Call-Completed] pendingTranscriptJob created for call ${call.id}, next attempt at ${nextAttemptAt.toISOString()}`);
      } catch (jobError) {
        // If job creation fails (e.g., duplicate), log but don't crash
        console.error(`[Call-Completed] Failed to create pendingTranscriptJob:`, jobError);
      }

      // Broadcast call_ended to realtime server even though we're deferring wrapup
      await notifyRealtimeServer({
        type: "call_ended",
        sessionId: call.id,
        externalCallId: call.externalCallId,
        extension,
        duration: body.duration,
        status: call.status,
      });

      const processingTime = Date.now() - startTime;
      console.log(`[Call-Completed] Deferred to transcript worker in ${processingTime}ms — callId: ${body.callId}`);
      return; // Skip wrapup creation — transcript worker will handle it
    }

    // 3. Run AI analysis (with 20s timeout to avoid Zapier timeout)
    let analysis: AIAnalysis | null = null;
    if (transcript && transcript.length > 50) {
      analysis = await withTimeout(
        analyzeTranscript(transcript, body.duration || 0),
        20000, // 20 second timeout for AI
        null
      );
      if (!analysis) {
        console.log("[Call-Completed] AI analysis timed out or failed");
      }

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

    // 3.5a Direction correction: AI can detect outbound calls that the webhook misclassified
    // VoIPTools sometimes reports outbound calls as inbound (swapped CallerExt/DialedNum)
    if (analysis?.detectedDirection === "outbound" && direction === "inbound") {
      console.log(`[Call-Completed] ⚠️ Direction mismatch: webhook says inbound, AI detected outbound — correcting to outbound`);
      direction = "outbound";
      await db
        .update(calls)
        .set({
          direction: "outbound",
          directionFinal: "outbound",
        })
        .where(eq(calls.id, call.id));
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
    let mergedWithAfterHours = false;
    let mergedTriageItemId: string | undefined;

    // Create wrapup for calls with analysis OR hangups (for QA review)
    console.log(`[Call-Completed] 🔍 Wrapup creation check: analysis=${!!analysis}, isHangup=${isHangup}, disposition=${call.disposition}`);

    if (analysis || isHangup) {
      console.log(`[Call-Completed] ✅ Entering wrapup creation block for call ${call.id}`);

      // Get customer phone from call record (preferred) or webhook data
      // For outbound calls: customer is the "to" number
      // For inbound calls: customer is the "from" number
      const callDir = call.direction || direction;
      const customerPhone = callDir === "inbound"
        ? (call.fromNumber || callerNumber)
        : (call.toNumber || calledNumber);

      // Validate the call phone: must be ≥7 digits and not just an extension
      const callPhoneDigits = (customerPhone || "").replace(/\D/g, "");
      const hasValidCallPhone = callPhoneDigits.length >= 7;

      // IMPORTANT: Prioritize the actual caller/called number over AI-extracted phone.
      // AI may extract a phone mentioned in conversation (agency line, carrier 800 number, etc.)
      // which would cause a wrong customer match. Only use AI phone as fallback.
      const phoneForLookup = hasValidCallPhone ? customerPhone : (analysis?.extractedData?.phone || customerPhone);
      console.log(`[Call-Completed] 📞 Customer phone for lookup: ${phoneForLookup} (direction: ${callDir}, callPhone: ${customerPhone}, aiPhone: ${analysis?.extractedData?.phone || 'none'})`);

      // =========================================================================
      // FAST PATH: After-hours Twilio calls
      // These calls come through Twilio only (no 3CX counterpart), so they need
      // wrapups created immediately. Skip slow customer matching / AZ lookup
      // since after-hours calls just need caller info + AI summary + ticket.
      // =========================================================================
      if (call.disposition === "after_hours" && analysis) {
        console.log(`[Call-Completed] 📞 FAST PATH: After-hours call ${call.id} — creating wrapup immediately`);

        try {
          const [ahWrapup] = await db
            .insert(wrapupDrafts)
            .values({
              tenantId,
              callId: call.id,
              direction: (callDir === "inbound" ? "Inbound" : "Outbound") as "Inbound" | "Outbound",
              agentExtension: "after-hours",
              agentName: "After-Hours Service",
              summary: analysis.summary || "After-hours call - forwarded to voicemail service",
              customerName: analysis.extractedData?.customerName || null,
              customerPhone: phoneForLookup,
              customerEmail: analysis.extractedData?.email || null,
              requestType: analysis.serviceRequestType || analysis.callType || "after_hours",
              status: "pending_review" as const,
              matchStatus: "unmatched",
              aiCleanedSummary: analysis.summary,
              aiProcessingStatus: "completed",
              aiProcessedAt: new Date(),
              aiExtraction: analysis.extractedData as Record<string, unknown> || null,
              aiConfidence: "0.85",
              isAutoVoided: false,
            })
            .onConflictDoUpdate({
              target: wrapupDrafts.callId,
              set: {
                summary: analysis.summary || "After-hours call - forwarded to voicemail service",
                customerName: analysis.extractedData?.customerName || null,
                customerPhone: phoneForLookup,
                aiCleanedSummary: analysis.summary,
                aiProcessingStatus: "completed",
                aiProcessedAt: new Date(),
                updatedAt: new Date(),
              },
            })
            .returning();

          if (ahWrapup) {
            wrapupId = ahWrapup.id;
            console.log(`[Call-Completed] ✅ After-hours wrapup created: ${ahWrapup.id}`);

            // Create after-hours service ticket
            try {
              const afterHoursTicketId = await createAfterHoursServiceTicket({
                tenantId,
                callerName: analysis.extractedData?.customerName || null,
                callerPhone: phoneForLookup || "Unknown",
                reason: analysis.summary || null,
                agencyzoomCustomerId: null,
                localCustomerId: call.customerId || null,
                isUrgent: false,
                transcript: transcript || null,
                emailBody: null,
                aiSummary: analysis.summary || null,
                actionItems: analysis.actionItems || [],
                wrapupDraftId: ahWrapup.id,
                source: "after_hours_call",
              });

              if (afterHoursTicketId) {
                await db
                  .update(wrapupDrafts)
                  .set({
                    status: "completed",
                    outcome: "ticket",
                    agencyzoomTicketId: afterHoursTicketId.toString(),
                    completedAt: new Date(),
                  })
                  .where(eq(wrapupDrafts.id, ahWrapup.id));
                console.log(`[Call-Completed] 🎫 After-hours ticket created: ${afterHoursTicketId}, wrapup marked completed`);
              }
            } catch (ticketError) {
              console.error(`[Call-Completed] ⚠️ After-hours ticket creation failed (wrapup still created):`, ticketError);
            }
          }
        } catch (ahError) {
          console.error(`[Call-Completed] ❌ After-hours fast path failed:`, ahError);
        }

        // Skip the slow customer matching pipeline — after-hours processing is done
        console.log(`[Call-Completed] 📞 After-hours fast path complete for call ${call.id}`);
      } else {
      // =========================================================================
      // NORMAL PATH: Regular calls — full customer matching + triage
      // =========================================================================

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

      // Cross-leg matching: check if another call record for this phone in the last 10min has customerId
      // (handles PBX multi-leg calls where trunk leg got screen-popped but extension leg didn't)
      if (customerMatchStatus === "unmatched" && phoneForLookup) {
        const crossLegDigits = phoneForLookup.replace(/\D/g, "").slice(-10);
        if (crossLegDigits.length >= 7) {
          try {
            const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000);
            const [crossLegCall] = await db
              .select({ customerId: calls.customerId })
              .from(calls)
              .where(
                and(
                  eq(calls.tenantId, tenantId),
                  isNotNull(calls.customerId),
                  gte(calls.startedAt, tenMinAgo),
                  or(
                    sql`REPLACE(REPLACE(REPLACE(REPLACE(${calls.fromNumber}, '+', ''), '(', ''), ')', ''), '-', '') LIKE ${'%' + crossLegDigits}`,
                    sql`REPLACE(REPLACE(REPLACE(REPLACE(${calls.toNumber}, '+', ''), '(', ''), ')', ''), '-', '') LIKE ${'%' + crossLegDigits}`
                  )
                )
              )
              .limit(1);

            if (crossLegCall?.customerId) {
              const [crossCustomer] = await db
                .select({
                  id: customers.id,
                  firstName: customers.firstName,
                  lastName: customers.lastName,
                  agencyzoomId: customers.agencyzoomId,
                })
                .from(customers)
                .where(eq(customers.id, crossLegCall.customerId))
                .limit(1);

              if (crossCustomer) {
                customerMatchStatus = "matched";
                matchedAzCustomerId = crossCustomer.agencyzoomId || null;
                matchedCustomerName = `${crossCustomer.firstName || ""} ${crossCustomer.lastName || ""}`.trim() || null;
                matchType = "customer";
                // Backfill customerId on this call too
                await db.update(calls).set({ customerId: crossCustomer.id, updatedAt: new Date() }).where(eq(calls.id, call.id));
                console.log(`[Call-Completed] Cross-leg match: ${matchedCustomerName} (from sibling call record)`);
              }
            }
          } catch (crossLegErr) {
            console.error("[Call-Completed] Cross-leg lookup error:", crossLegErr);
          }
        }
      }

      // Only do phone lookup if no screen pop or cross-leg match
      if (customerMatchStatus === "unmatched" && phoneForLookup) {
        // FIRST: Search local customers table (faster and more reliable than AZ API)
        const phoneDigits = phoneForLookup.replace(/\D/g, "").slice(-10);
        try {
          const localMatches = await db
            .select({
              id: customers.id,
              agencyzoomId: customers.agencyzoomId,
              firstName: customers.firstName,
              lastName: customers.lastName,
              phone: customers.phone,
            })
            .from(customers)
            .where(
              and(
                eq(customers.tenantId, tenantId),
                or(
                  sql`REPLACE(REPLACE(REPLACE(REPLACE(${customers.phone}, '(', ''), ')', ''), '-', ''), ' ', '') LIKE ${'%' + phoneDigits}`,
                  sql`REPLACE(REPLACE(REPLACE(REPLACE(${customers.phoneAlt}, '(', ''), ')', ''), '-', ''), ' ', '') LIKE ${'%' + phoneDigits}`
                )
              )
            )
            .limit(5);

          if (localMatches.length === 1 && localMatches[0].agencyzoomId) {
            customerMatchStatus = "matched";
            matchedAzCustomerId = localMatches[0].agencyzoomId;
            matchedCustomerName = `${localMatches[0].firstName || ""} ${localMatches[0].lastName || ""}`.trim() || null;
            matchType = "customer";
            console.log(`[Call-Completed] Local DB match: ${matchedCustomerName} (AZ: ${matchedAzCustomerId})`);
          } else if (localMatches.length > 1) {
            customerMatchStatus = "multiple_matches";
            matchType = "customer";
            console.log(`[Call-Completed] Local DB multiple matches: ${localMatches.length}`);
          } else {
            console.log(`[Call-Completed] No local DB match for ${phoneDigits}`);
          }
        } catch (localError) {
          console.error("[Call-Completed] Local customer lookup error (REPLACE query):", localError);
          // Retry with simpler ILIKE query as fallback
          if (phoneDigits.length >= 10) {
            try {
              const [fallbackMatch] = await db
                .select({
                  id: customers.id,
                  agencyzoomId: customers.agencyzoomId,
                  firstName: customers.firstName,
                  lastName: customers.lastName,
                })
                .from(customers)
                .where(
                  and(
                    eq(customers.tenantId, tenantId),
                    or(
                      ilike(customers.phone, `%${phoneDigits.slice(-10)}`),
                      ilike(customers.phoneAlt, `%${phoneDigits.slice(-10)}`)
                    )
                  )
                )
                .limit(1);

              if (fallbackMatch?.agencyzoomId) {
                customerMatchStatus = "matched";
                matchedAzCustomerId = fallbackMatch.agencyzoomId;
                matchedCustomerName = `${fallbackMatch.firstName || ""} ${fallbackMatch.lastName || ""}`.trim() || null;
                matchType = "customer";
                console.log(`[Call-Completed] Local DB fallback match: ${matchedCustomerName} (AZ: ${matchedAzCustomerId})`);
              }
            } catch (fallbackError) {
              console.error("[Call-Completed] Local customer fallback lookup also failed:", fallbackError);
            }
          }
        }

        // Backfill call.customerId if wrapup matching found a customer but call has none
        if (customerMatchStatus === "matched" && !call.customerId && phoneDigits.length >= 10) {
          try {
            const [localCustomer] = await db
              .select({ id: customers.id })
              .from(customers)
              .where(
                and(
                  eq(customers.tenantId, tenantId),
                  or(
                    ilike(customers.phone, `%${phoneDigits.slice(-10)}`),
                    ilike(customers.phoneAlt, `%${phoneDigits.slice(-10)}`)
                  )
                )
              )
              .limit(1);

            if (localCustomer) {
              await db.update(calls).set({ customerId: localCustomer.id, updatedAt: new Date() }).where(eq(calls.id, call.id));
              console.log(`[Call-Completed] 👤 Backfilled call.customerId: ${localCustomer.id} from wrapup matching`);
            }
          } catch (backfillError) {
            console.error("[Call-Completed] Failed to backfill call.customerId:", backfillError);
          }
        }

        // FALLBACK: Try AgencyZoom API if no local match (with timeout)
        if (customerMatchStatus === "unmatched") {
          try {
            const azClient = getAgencyZoomClient(); // Sync - no timeout needed
            if (azClient) {
            // First search customers (with timeout)
            azMatches = await withTimeout(
              azClient.findCustomersByPhone(phoneForLookup, 5),
              7000, // 7s timeout
              []
            );
            console.log(`[Call-Completed] AgencyZoom customer lookup for ${phoneForLookup}: ${azMatches.length} matches`);

          // If no customers found, search leads (with timeout)
          if (azMatches.length === 0) {
            try {
              // Use findLeadsByPhone which filters results to actual phone matches
              // (getLeads with searchText matches ANY field, not just phone)
              azLeadMatches = await withTimeout(
                azClient.findLeadsByPhone(phoneForLookup, 5),
                5000, // 5s timeout for leads
                []
              );
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

          // Determine match status from AZ API lookup - check customers first, then leads
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
        } // end if (customerMatchStatus === "unmatched") - AgencyZoom API fallback
      } // end if (customerMatchStatus === "unmatched" && phoneForLookup) - phone lookup block

      // 4.2 Trestle IQ lookup for unmatched calls (with 5s timeout)
      if (customerMatchStatus === "unmatched") {
        if (phoneForLookup && trestleIQClient) {
          try {
            // Run reverse phone and lead quality check in parallel
            const [trestleResult, leadQuality] = await Promise.all([
              withTimeout(
                trestleIQClient.reversePhone(phoneForLookup),
                5000, // 5s timeout
                null
              ),
              withTimeout(
                quickLeadCheck(phoneForLookup),
                3000, // 3s timeout for quick check
                null
              ),
            ]);

            if (trestleResult || leadQuality) {
              trestleData = {
                phoneNumber: trestleResult?.phoneNumber || phoneForLookup,
                lineType: trestleResult?.lineType || leadQuality?.isValid ? 'unknown' : 'unknown',
                carrier: trestleResult?.carrier,
                person: trestleResult?.person,
                address: trestleResult?.address,
                emails: trestleResult?.emails,
                confidence: trestleResult?.confidence,
                // Add lead quality scoring
                leadQuality: leadQuality ? {
                  grade: leadQuality.grade,
                  activityScore: leadQuality.activityScore,
                  phoneValid: leadQuality.isValid,
                  phoneLineType: trestleResult?.lineType,
                  isDisconnected: !leadQuality.isValid || leadQuality.activityScore < 20,
                  isSpam: false, // Would need separate spam check
                } : undefined,
              };
              console.log(`[Call-Completed] Trestle lookup: ${trestleResult?.person?.name || "No name found"}, Lead Grade: ${leadQuality?.grade || "N/A"}`);
            }
          } catch (error) {
            console.error("[Call-Completed] Trestle lookup error:", error);
          }
        }
      }

      // 4.2.5 Smart Triage: Find related tickets for matched customers
      let aiTriageRecommendationObj: {
        suggestedAction: "append" | "create" | "dismiss";
        confidence: number;
        reasoning: string;
        relatedTickets: Array<{
          ticketId: number;
          similarity: number;
          subject: string;
          csrName: string | null;
        }>;
      } | null = null;
      let aiSimilarityScore: number | null = null;
      let aiRelatedTicketId: number | null = null;
      let aiRecommendationReason: string | null = null;

      if (matchedAzCustomerId && analysis?.summary) {
        try {
          console.log(`[Call-Completed] 🔍 Finding related tickets for customer ${matchedAzCustomerId}`);
          const relatedTickets = await findRelatedTickets(
            parseInt(matchedAzCustomerId),
            analysis.summary,
            { days: 60 }
          );

          if (relatedTickets.length > 0) {
            console.log(`[Call-Completed] 🎯 Found ${relatedTickets.length} related tickets, top match: ${relatedTickets[0].similarity}% similar`);
          }

          const triageResult = determineTriageRecommendation(relatedTickets);
          aiSimilarityScore = triageResult.confidence;
          aiRelatedTicketId = triageResult.relatedTicketId || null;
          aiRecommendationReason = triageResult.reason;

          // Build the recommendation object in the format expected by the UI
          aiTriageRecommendationObj = {
            suggestedAction: triageResult.recommendation.toLowerCase() as "append" | "create" | "dismiss",
            confidence: triageResult.confidence / 100, // Convert 0-100 to 0-1
            reasoning: triageResult.reason,
            relatedTickets: relatedTickets.map(t => ({
              ticketId: t.id,
              similarity: t.similarity / 100, // Convert 0-100 to 0-1
              subject: t.subject,
              csrName: t.csrName,
            })),
          };

          console.log(`[Call-Completed] 💡 Triage recommendation: ${triageResult.recommendation} (${aiSimilarityScore}%) - ${aiRecommendationReason}`);
        } catch (error) {
          console.error("[Call-Completed] Failed to determine triage recommendation:", error);
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
      console.log(`[Call-Completed] 🔄 Starting wrapup transaction for call ${call.id}`);

      let txResult: { wrapup: typeof wrapupDrafts.$inferSelect | null; suggestionCount: number; mergedWithExisting: boolean; triageItemId?: string };

      try {
        txResult = await db.transaction(async (tx) => {
        // Prefer extension from call record (set during call-started), fall back to webhook body
        const agentExt = call.extension || extension;
        // Use direction variable — it may have been AI-corrected from the webhook value
        const callDirection = direction;
        // Check if this is an after-hours call (from disposition set during call creation)
        const isAfterHoursCall = call.disposition === "after_hours";

        // =========================================================================
        // AFTER-HOURS DUPLICATE PREVENTION
        // Check if there's already a triage item from after-hours-email webhook
        // If so, link the call instead of creating duplicate wrapupDraft
        // =========================================================================
        let linkedMessageId: string | undefined;

        if (isAfterHoursCall) {
          console.log("[Call-Completed] 📞 After-hours call detected - checking for existing triage item...");
          console.log(`[Call-Completed] 📞 Phone for lookup: ${phoneForLookup}`);

          const existingAfterHours = await checkExistingAfterHoursEntry(tenantId, phoneForLookup);
          console.log(`[Call-Completed] 📞 checkExistingAfterHoursEntry result: found=${existingAfterHours.found}, triageItemId=${existingAfterHours.triageItemId || 'none'}, messageId=${existingAfterHours.messageId || 'none'}`);

          if (existingAfterHours.found && existingAfterHours.triageItemId) {
            // Found existing triage item - link call and update with transcript/summary
            console.log(`[Call-Completed] 📞 Linking call to existing triage item ${existingAfterHours.triageItemId}`);

            await tx
              .update(triageItems)
              .set({
                callId: call.id,
                aiSummary: analysis?.summary || undefined,
                updatedAt: new Date(),
              })
              .where(eq(triageItems.id, existingAfterHours.triageItemId));

            // Also update the linked message if it exists (append transcript to body)
            if (existingAfterHours.messageId && transcript) {
              const [existingMessage] = await tx
                .select({ body: messages.body })
                .from(messages)
                .where(eq(messages.id, existingAfterHours.messageId))
                .limit(1);

              if (existingMessage) {
                await tx
                  .update(messages)
                  .set({
                    body: `${existingMessage.body || ''}\n\n--- Call Transcript ---\n${transcript}`,
                  })
                  .where(eq(messages.id, existingAfterHours.messageId));
              }
            }

            console.log(`[Call-Completed] 📞 Merged call ${call.id} with existing after-hours entry - NO duplicate wrapup created`);

            // Return early - don't create wrapupDraft
            return {
              wrapup: null,
              suggestionCount: 0,
              mergedWithExisting: true,
              triageItemId: existingAfterHours.triageItemId,
            };
          }

          // If we found an orphaned message (no triage item), save it to link to the wrapup later
          if (existingAfterHours.found && existingAfterHours.messageId) {
            console.log(`[Call-Completed] 📞 Found orphaned after-hours message ${existingAfterHours.messageId} - will create wrapup and link`);
            linkedMessageId = existingAfterHours.messageId;
          } else {
            console.log("[Call-Completed] 📞 No existing triage item or message found - creating fresh wrapup for after-hours call");
          }
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
          requestType: analysis?.serviceRequestType || analysis?.callType || (isAfterHoursCall ? "after_hours" : hangupReason),
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
          // Smart Triage fields
          aiTriageRecommendation: aiTriageRecommendationObj,
          aiSimilarityScore,
          aiRelatedTicketId,
          aiRecommendationReason,
          similarityComputedAt: aiTriageRecommendationObj ? new Date() : null,
        };

        console.log(`[Call-Completed] 📝 Creating wrapup for call ${call.id} (direction: ${callDirection}, after-hours: ${isAfterHoursCall}, status: ${wrapupStatus})`);

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
              matchStatus: wrapupValues.matchStatus,
              status: wrapupValues.status,
              isAutoVoided: wrapupValues.isAutoVoided,
              autoVoidReason: wrapupValues.autoVoidReason,
              trestleData: wrapupValues.trestleData,
              aiCleanedSummary: wrapupValues.aiCleanedSummary,
              aiProcessingStatus: wrapupValues.aiProcessingStatus,
              aiProcessedAt: wrapupValues.aiProcessedAt,
              aiExtraction: wrapupValues.aiExtraction,
              aiConfidence: wrapupValues.aiConfidence,
              aiTriageRecommendation: wrapupValues.aiTriageRecommendation,
              aiSimilarityScore: wrapupValues.aiSimilarityScore,
              aiRelatedTicketId: wrapupValues.aiRelatedTicketId,
              aiRecommendationReason: wrapupValues.aiRecommendationReason,
              similarityComputedAt: wrapupValues.similarityComputedAt,
              updatedAt: new Date(),
            },
          })
          .returning();

        console.log(`[Call-Completed] ✅ Wrapup created/updated: ${wrapup.id}`);

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

        return { wrapup, suggestionCount, mergedWithExisting: false };
        });
      } catch (txError) {
        console.error(`[Call-Completed] ❌ Transaction failed for call ${call.id}:`, txError);

        // Fallback: Try to create a basic wrapup outside the transaction
        console.log(`[Call-Completed] 🔄 Attempting fallback wrapup creation for call ${call.id}`);
        try {
          const callDir = call.direction || direction;
          const isAfterHoursCall = call.disposition === "after_hours";

          const [fallbackWrapup] = await db
            .insert(wrapupDrafts)
            .values({
              tenantId,
              callId: call.id,
              direction: (callDir === "inbound" ? "Inbound" : "Outbound") as "Inbound" | "Outbound",
              agentExtension: isAfterHoursCall ? "after-hours" : (call.extension || extension),
              agentName: isAfterHoursCall ? "After-Hours Service" : null,
              summary: analysis?.summary || "Call completed - review required",
              customerName: analysis?.extractedData?.customerName || null,
              customerPhone: phoneForLookup,
              requestType: analysis?.serviceRequestType || analysis?.callType || (isAfterHoursCall ? "after_hours" : "general"),
              status: shouldAutoVoid ? "completed" : "pending_review",
              matchStatus: customerMatchStatus,
              aiCleanedSummary: analysis?.summary,
              aiProcessingStatus: analysis ? "completed" : "skipped",
              aiProcessedAt: new Date(),
              isAutoVoided: shouldAutoVoid,
            })
            .onConflictDoNothing()
            .returning();

          if (fallbackWrapup) {
            console.log(`[Call-Completed] ✅ Fallback wrapup created: ${fallbackWrapup.id}`);
            txResult = { wrapup: fallbackWrapup, suggestionCount: 0, mergedWithExisting: false };
          } else {
            console.log(`[Call-Completed] ⚠️ Fallback wrapup not created (likely already exists)`);
            txResult = { wrapup: null, suggestionCount: 0, mergedWithExisting: false };
          }
        } catch (fallbackError) {
          console.error(`[Call-Completed] ❌ Fallback wrapup creation also failed:`, fallbackError);
          txResult = { wrapup: null, suggestionCount: 0, mergedWithExisting: false };
        }
      }

      // Handle the case where we merged with an existing after-hours triage item
      if (txResult.mergedWithExisting) {
        mergedWithAfterHours = true;
        mergedTriageItemId = txResult.triageItemId;
        console.log(`[Call-Completed] ✅ Merged with existing after-hours triage item ${mergedTriageItemId} - no duplicate wrapup created`);

        // Create AZ service ticket for the merged after-hours call
        // The helper's duplicate check prevents double-creation if email webhook already created one
        await createAfterHoursServiceTicket({
          tenantId,
          callerName: analysis?.extractedData?.customerName || null,
          callerPhone: phoneForLookup || 'Unknown',
          reason: analysis?.summary || null,
          agencyzoomCustomerId: matchedAzCustomerId || null,
          localCustomerId: call.customerId || null,
          isUrgent: false,
          transcript: transcript || null,
          emailBody: null,
          aiSummary: analysis?.summary || null,
          actionItems: analysis?.actionItems || [],
          triageItemId: mergedTriageItemId,
          source: 'after_hours_call',
        });
      } else if (txResult.wrapup) {
        wrapupId = txResult.wrapup.id;
        console.log(`[Call-Completed] Created wrap-up draft: ${wrapupId} (matchStatus: ${customerMatchStatus}${shouldAutoVoid ? ", auto-voided: " + hangupReason : ""})`);
        if (txResult.suggestionCount > 0) {
          console.log(`[Call-Completed] Stored ${txResult.suggestionCount} match suggestions (${azMatches.length} customers, ${azLeadMatches.length} leads)`);
        }
      } else {
        console.warn(`[Call-Completed] ⚠️ No wrapup created for call ${call.id} - this should be investigated`);
      }

      // Note: Triage items removed - wrapup_drafts is the single source of truth
      // All call review happens through /pending-review using wrapup_drafts table

      // =========================================================================
      // AUTO-CREATE REVIEW REQUEST FOR POSITIVE SENTIMENT CALLS
      // Creates a pending_approval review request for manual approval in /reviews
      // =========================================================================
      if (
        txResult.wrapup &&
        analysis?.sentiment === "positive" &&
        phoneForLookup &&
        !shouldAutoVoid
      ) {
        try {
          // Check if customer already has a Google review (suppress if so)
          const normalizedPhone = normalizePhone(phoneForLookup);
          const phoneDigits = normalizedPhone.replace(/\D/g, "").slice(-10);

          const [existingReview] = await db
            .select({ id: googleReviews.id })
            .from(googleReviews)
            .where(
              and(
                eq(googleReviews.tenantId, tenantId),
                ilike(googleReviews.matchedCustomerPhone, `%${phoneDigits}`)
              )
            )
            .limit(1);

          // Check if there's already a pending review request for this phone
          const [existingRequest] = await db
            .select({ id: reviewRequests.id })
            .from(reviewRequests)
            .where(
              and(
                eq(reviewRequests.tenantId, tenantId),
                eq(reviewRequests.customerPhone, normalizedPhone),
                or(
                  eq(reviewRequests.status, "pending_approval"),
                  eq(reviewRequests.status, "pending")
                )
              )
            )
            .limit(1);

          if (existingRequest) {
            console.log(`[Call-Completed] ⏭️ Review request skipped - already pending for ${normalizedPhone}`);
          } else if (existingReview) {
            // Create suppressed review request (for tracking)
            await db.insert(reviewRequests).values({
              tenantId,
              callId: call.id,
              customerName: txResult.wrapup.customerName || "Unknown",
              customerPhone: normalizedPhone,
              customerId: matchedAzCustomerId?.toString() || null,
              sentiment: "positive",
              scheduledFor: getNextBusinessHour(),
              status: "suppressed",
              suppressed: true,
              suppressionReason: "existing_review",
              googleReviewId: existingReview.id,
            });
            console.log(`[Call-Completed] 📝 Review request created (suppressed - customer has existing review)`);
          } else {
            // Create pending_approval review request
            await db.insert(reviewRequests).values({
              tenantId,
              callId: call.id,
              customerName: txResult.wrapup.customerName || "Unknown",
              customerPhone: normalizedPhone,
              customerId: matchedAzCustomerId?.toString() || null,
              sentiment: "positive",
              scheduledFor: getNextBusinessHour(),
              status: "pending_approval",
            });
            console.log(`[Call-Completed] 📝 Review request created (pending_approval) for ${txResult.wrapup.customerName || normalizedPhone}`);
          }
        } catch (reviewError) {
          // Don't fail the webhook if review request creation fails
          console.error(`[Call-Completed] ⚠️ Failed to create review request:`, reviewError);
        }
      }

      // =========================================================================
      // AUTO-CREATE SERVICE TICKET FOR INBOUND CALLS
      // Creates a service ticket in AgencyZoom assigned to AI Agent
      // Feature toggle: autoCreateServiceTickets in tenant features
      // =========================================================================
      console.log(`[Call-Completed] 🎫 Auto-ticket check: wrapup=${!!txResult.wrapup}, analysis=${!!analysis}, direction=${direction}, shouldAutoVoid=${shouldAutoVoid}`);
      if (
        txResult.wrapup &&
        analysis &&
        direction !== "outbound" &&
        !shouldAutoVoid
      ) {
        try {
          // Check if feature is enabled
          const [tenantData] = await db
            .select({ features: tenants.features })
            .from(tenants)
            .where(eq(tenants.id, tenantId))
            .limit(1);

          const features = tenantData?.features as Record<string, unknown> | undefined;
          const autoCreateEnabled = features?.autoCreateServiceTickets !== false;

          if (autoCreateEnabled) {
            console.log(`[Call-Completed] 🎫 Auto-ticket feature enabled, checking phone: ${phoneForLookup}`);
            // Skip internal/test calls - don't create tickets for these
            const callerDigits = (phoneForLookup || '').replace(/\D/g, '');
            const isInternalOrTestCall =
              !phoneForLookup ||
              phoneForLookup === 'Unknown' ||
              phoneForLookup === 'PlayFile' ||
              phoneForLookup.toLowerCase().includes('playfile') ||
              callerDigits.length < 7 ||  // Too short to be a real phone number
              callerDigits.length > 11;   // Too long to be a valid phone number

            if (isInternalOrTestCall) {
              console.log(`[Call-Completed] Skipping ticket creation for internal/test call: ${phoneForLookup} (digits: ${callerDigits.length})`);
            } else if (call.disposition === "after_hours") {
              // After-hours unmerged call — use the shared after-hours ticket helper
              console.log(`[Call-Completed] 🎫 After-hours unmerged call - using after-hours ticket helper for ${phoneForLookup}`);
              const afterHoursTicketId = await createAfterHoursServiceTicket({
                tenantId,
                callerName: txResult.wrapup!.customerName || analysis.extractedData?.customerName || null,
                callerPhone: phoneForLookup || 'Unknown',
                reason: analysis.summary || null,
                agencyzoomCustomerId: matchedAzCustomerId || null,
                localCustomerId: call.customerId || null,
                isUrgent: false,
                transcript: transcript || null,
                emailBody: null,
                aiSummary: analysis.summary || null,
                actionItems: analysis.actionItems || [],
                wrapupDraftId: txResult.wrapup!.id,
                source: 'after_hours_call',
              });

              if (afterHoursTicketId) {
                // Mark wrapup as completed — same pattern as inbound call tickets
                try {
                  await db
                    .update(wrapupDrafts)
                    .set({
                      status: 'completed',
                      outcome: 'ticket',
                      agencyzoomTicketId: afterHoursTicketId.toString(),
                      completedAt: new Date(),
                    })
                    .where(eq(wrapupDrafts.id, txResult.wrapup!.id));
                  console.log(`[Call-Completed] 🎫 Wrapup ${txResult.wrapup!.id} marked completed (after-hours auto-ticket created)`);
                } catch (wrapupUpdateError) {
                  console.error(`[Call-Completed] ⚠️ Failed to mark wrapup completed:`, wrapupUpdateError);
                }
              }
            } else {
            console.log(`[Call-Completed] 🎫 Creating auto-ticket for ${phoneForLookup} (matchedAZ: ${matchedAzCustomerId || 'NCM'})`);

            // Determine customer ID - use matched AZ customer or NCM placeholder
            const azCustomerId = matchedAzCustomerId ? parseInt(String(matchedAzCustomerId)) : SPECIAL_HOUSEHOLDS.NCM_PLACEHOLDER;

            // Build ticket description
            const extracted = analysis.extractedData as Record<string, string | undefined> | undefined;
            const ticketDescription = formatInboundCallDescription({
              summary: analysis.summary,
              actionItems: analysis.actionItems,
              extractedData: extracted,
              callerPhone: phoneForLookup || undefined,
              customerName: txResult.wrapup.customerName || undefined,
              durationSeconds: body.duration,
              transcript: transcript || undefined,
              isNCM: !matchedAzCustomerId,
            });

            // Determine category based on AI analysis
            const serviceRequestType = analysis.serviceRequestType || 'general';
            const categoryId = SERVICE_CATEGORIES.GENERAL_SERVICE;

            // Determine CSR assignment - prefer call's agent, fallback to AI Agent
            let assignedCsrId: number = EMPLOYEE_IDS.AI_AGENT;
            let assignedCsrName = 'AI Agent';

            if (call.agentId) {
              try {
                const [agentData] = await db
                  .select({
                    firstName: users.firstName,
                    lastName: users.lastName,
                    agencyzoomId: users.agencyzoomId,
                  })
                  .from(users)
                  .where(eq(users.id, call.agentId))
                  .limit(1);

                if (agentData?.agencyzoomId) {
                  const azCsrId = parseInt(agentData.agencyzoomId, 10);
                  if (!isNaN(azCsrId) && azCsrId > 0) {
                    assignedCsrId = azCsrId;
                    assignedCsrName = `${agentData.firstName || ''} ${agentData.lastName || ''}`.trim() || 'Agent';
                    console.log(`[Call-Completed] 🎫 Assigning ticket to call agent: ${assignedCsrName} (CSR ID: ${assignedCsrId})`);
                  }
                }
              } catch (agentLookupError) {
                console.error(`[Call-Completed] ⚠️ Failed to look up agent CSR ID, using AI Agent:`, agentLookupError);
              }
            }

            // Generate a more descriptive subject from the AI summary
            // Truncate to ~60 chars for readability, extract key reason for call
            let callReason = analysis.summary || '';
            // Take first sentence or first 60 chars, whichever is shorter
            const firstSentenceEnd = callReason.search(/[.!?]/);
            if (firstSentenceEnd > 0 && firstSentenceEnd < 80) {
              callReason = callReason.substring(0, firstSentenceEnd);
            } else if (callReason.length > 60) {
              // Truncate at word boundary
              callReason = callReason.substring(0, 60).replace(/\s+\S*$/, '');
            }
            // Clean up and ensure it starts with lowercase for natural flow
            callReason = callReason.trim().replace(/^(the\s+)?(caller\s+)?(called\s+)?(about\s+)?/i, '');
            if (!callReason || callReason.length < 5) {
              callReason = analysis.serviceRequestType || 'general inquiry';
            }

            // Only add customer name for NCM tickets (unmatched callers)
            const isNCMTicket = !matchedAzCustomerId;
            const subjectSuffix = isNCMTicket
              ? ` - ${txResult.wrapup.customerName || phoneForLookup || 'Unknown Caller'}`
              : '';
            const sentimentPrefix = formatSentimentEmoji(analysis.sentiment, call.threecxSentimentScore ?? null);
            const ticketSubject = `${sentimentPrefix ? sentimentPrefix + ' ' : ''}Inbound Call: ${callReason}${subjectSuffix}`;

            // Deduplication - check if ticket already exists for this wrapup
            const [existingTicketForWrapup] = await db
              .select({ id: serviceTickets.id, azTicketId: serviceTickets.azTicketId })
              .from(serviceTickets)
              .where(eq(serviceTickets.wrapupDraftId, txResult.wrapup!.id))
              .limit(1);

            if (existingTicketForWrapup) {
              console.log(`[Call-Completed] 🎫 Ticket already exists for wrapup ${txResult.wrapup!.id} (AZ#${existingTicketForWrapup.azTicketId}), skipping`);
            } else {
            // Create service ticket via AgencyZoom API
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
              console.log(`[Call-Completed] 🎫 Service ticket created: ${azTicketId} (assigned to ${assignedCsrName})`);

              // Store ticket locally
              if (typeof azTicketId === 'number' && azTicketId > 0) {
                try {
                  await db.insert(serviceTickets).values({
                    tenantId,
                    azTicketId: azTicketId,
                    azHouseholdId: azCustomerId,
                    wrapupDraftId: txResult.wrapup!.id,
                    customerId: call.customerId || null,
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
                    source: 'inbound_call',
                    lastSyncedFromAz: new Date(),
                  });
                  console.log(`[Call-Completed] 🎫 Ticket stored locally`);
                } catch (localDbError) {
                  console.error(`[Call-Completed] ⚠️ Failed to store ticket locally:`, localDbError);
                }
              }

              // Mark wrapup as completed - auto-created tickets don't need pending review
              try {
                await db
                  .update(wrapupDrafts)
                  .set({
                    status: 'completed',
                    outcome: 'ticket',
                    agencyzoomTicketId: azTicketId?.toString() || null,
                    completedAt: new Date(),
                  })
                  .where(eq(wrapupDrafts.id, txResult.wrapup!.id));
                console.log(`[Call-Completed] 🎫 Wrapup ${txResult.wrapup!.id} marked completed (auto-ticket created)`);
              } catch (wrapupUpdateError) {
                console.error(`[Call-Completed] ⚠️ Failed to mark wrapup completed:`, wrapupUpdateError);
              }
            } else {
              console.error(`[Call-Completed] ⚠️ Failed to create service ticket:`, ticketResult);
            }
            } // end else (deduplication - no existing ticket)
            } // end else (not internal/test call)
          }
        } catch (ticketError) {
          // Don't fail the webhook if service ticket creation fails
          console.error(`[Call-Completed] ⚠️ Failed to create service ticket:`, ticketError instanceof Error ? ticketError.message : ticketError);
        }
      } else {
        console.log(`[Call-Completed] 🎫 Auto-ticket skipped: wrapup=${!!txResult.wrapup}, analysis=${!!analysis}, direction=${direction}, shouldAutoVoid=${shouldAutoVoid}`);
      }
    } // end normal path else block
    } else if (transcript && transcript.length >= 50) {
      // AI analysis failed/timed out but we have a transcript — create wrapup for manual review
      console.log(`[Call-Completed] ⚠️ AI analysis failed but transcript exists (${transcript.length} chars) — creating wrapup for manual review`);

      const callDir = call.direction || direction;
      const customerPhone = callDir === "inbound"
        ? (call.fromNumber || callerNumber)
        : (call.toNumber || calledNumber);

      try {
        await db.insert(wrapupDrafts).values({
          tenantId,
          callId: call.id,
          status: "pending_review",
          aiProcessingStatus: "failed",
          customerPhone: customerPhone || "Unknown",
          agentExtension: call.extension || null,
          agentName: body.agentName || null,
          direction: callDir || "inbound",
          summary: "AI analysis failed — manual review required",
          createdAt: new Date(),
          updatedAt: new Date(),
        }).onConflictDoUpdate({
          target: [wrapupDrafts.callId],
          set: {
            aiProcessingStatus: "failed",
            status: "pending_review",
            summary: "AI analysis failed — manual review required",
            updatedAt: new Date(),
          },
        });
        console.log(`[Call-Completed] ✅ Created manual-review wrapup for call ${call.id}`);
      } catch (wrapupError) {
        console.error(`[Call-Completed] ❌ Failed to create manual-review wrapup:`, wrapupError instanceof Error ? wrapupError.message : wrapupError);
      }
    } else {
      // No analysis, not a hangup, and no meaningful transcript — nothing to do
      console.log(`[Call-Completed] ⏭️ Skipping wrapup creation for call ${call.id}: no analysis, not hangup, no transcript (duration: ${body.duration}s, transcript length: ${transcript?.length || 0})`);
    }

    // 5. Auto-post note to AgencyZoom for OUTBOUND calls only
    // Inbound calls are handled via service tickets (not notes)
    if (analysis?.summary) {
      try {
        const [wrapupForPost] = await db
          .select({
            id: wrapupDrafts.id,
            isAutoVoided: wrapupDrafts.isAutoVoided,
            noteAutoPosted: wrapupDrafts.noteAutoPosted,
            agencyzoomTicketId: wrapupDrafts.agencyzoomTicketId,
            agentName: wrapupDrafts.agentName,
          })
          .from(wrapupDrafts)
          .where(eq(wrapupDrafts.callId, call.id))
          .limit(1);

        // Skip if already posted, voided, or already has a ticket
        if (wrapupForPost && !wrapupForPost.isAutoVoided && !wrapupForPost.noteAutoPosted && !wrapupForPost.agencyzoomTicketId) {
          const azClient = getAgencyZoomClient();
          if (azClient) {
            const now = new Date();
            const formattedDate = now.toLocaleDateString("en-US", { month: "numeric", day: "numeric", year: "numeric" });
            const formattedTime = now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
            const resolvedAgentName = wrapupForPost.agentName || body.agentName || "Unknown Agent";

            // Determine target AZ customer ID and build note text
            let azTargetCustomerId: number;
            let noteText: string;

            if (matchedAzCustomerId && customerMatchStatus === "matched" && direction === "outbound") {
              // Outbound matched customer — auto-post note
              // (Inbound matched calls get service tickets instead, not notes)
              azTargetCustomerId = parseInt(matchedAzCustomerId);
              noteText = `📞 Outbound Call - ${formattedDate} ${formattedTime}\n\n${analysis.summary}\n\nAgent: ${resolvedAgentName}`;
            } else if (direction === "inbound") {
              // ALL inbound calls — skip note posting (service tickets handle them)
              // Matched inbound → service ticket to customer
              // Unmatched inbound → service ticket to NCM
              azTargetCustomerId = 0;
              noteText = "";
              console.log(`[Call-Completed] ⏭️ Skipping note for inbound call - handled as service ticket`);
            } else {
              // Outbound unmatched — auto-complete wrapup so it doesn't appear in review queue
              azTargetCustomerId = 0;
              noteText = "";
              if (direction === "outbound") {
                await db
                  .update(wrapupDrafts)
                  .set({
                    status: "completed",
                    completionAction: "auto_completed",
                    completedAt: now,
                    autoVoidReason: "outbound_unmatched",
                  })
                  .where(eq(wrapupDrafts.id, wrapupForPost.id));
                console.log(`[Call-Completed] ✅ Auto-completed outbound unmatched wrapup ${wrapupForPost.id} (no ticket needed)`);
              }
            }

            if (azTargetCustomerId > 0) {
              const result = await azClient.addNote(azTargetCustomerId, noteText);
              if (result.success) {
                await db
                  .update(wrapupDrafts)
                  .set({
                    noteAutoPosted: true,
                    noteAutoPostedAt: now,
                    completionAction: "posted",
                    status: "completed",
                    completedAt: now,
                    agencyzoomNoteId: result.id?.toString() || null,
                  })
                  .where(eq(wrapupDrafts.id, wrapupForPost.id));
                const target = azTargetCustomerId === SPECIAL_HOUSEHOLDS.NCM_PLACEHOLDER ? "NCM placeholder" : `AZ customer ${azTargetCustomerId}`;
                console.log(`[Call-Completed] ✅ Auto-posted note to AgencyZoom for wrapup ${wrapupForPost.id} (${target})`);
              } else {
                console.warn(`[Call-Completed] ⚠️ AZ note post returned non-success for wrapup ${wrapupForPost.id}`);
              }
            }
          }
        }
      } catch (autoPostError) {
        console.error(`[Call-Completed] ⚠️ Auto-post to AgencyZoom failed (non-fatal):`, autoPostError instanceof Error ? autoPostError.message : autoPostError);
      }
    }

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
    console.log(`[Call-Completed] ✅ Processed in ${processingTime}ms - callId: ${body.callId}, wrapupId: ${wrapupId}`);

    // Broadcast call_ended to realtime server for UI popup closure
    await notifyRealtimeServer({
      type: "call_ended",
      sessionId: call.id,
      externalCallId: call.externalCallId,
      extension,
      duration: body.duration,
      status: call.status,
    });

  } catch (error) {
    console.error("[Call-Completed] ❌ Background processing error:", error);
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
