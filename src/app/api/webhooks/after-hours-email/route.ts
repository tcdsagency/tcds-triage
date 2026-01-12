// API Route: /api/webhooks/after-hours-email
// Receives after-hours email notifications from ReceptionHQ and merges with Twilio transcripts
// Flow: Email arrives → Parse ReceptionHQ format → Lookup customer → AI merge → Create after-hours message

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { messages, customers, triageItems } from "@/db/schema";
import { eq, and, or, gte, desc, ilike } from "drizzle-orm";
import OpenAI from "openai";

// =============================================================================
// TYPES
// =============================================================================

interface AfterHoursEmailPayload {
  // From email notification
  from: string;
  fromName?: string;
  subject?: string;
  body?: string;
  receivedAt?: string;

  // Phone info (for matching)
  phoneNumber?: string;
  callerNumber?: string;

  // Type indicator
  type?: "voicemail" | "missed_call" | "email";

  // If voicemail, may include audio URL
  audioUrl?: string;

  // Optional pre-transcription from email system
  emailTranscript?: string;
}

// Parsed ReceptionHQ email data
interface ReceptionHQExtraction {
  name: string | null;
  phone: string | null;           // Normalized 10-digit phone
  callerId: string | null;        // E.164 format from Caller ID field
  reason: string | null;          // Reason for call / message
  calledNumber: string | null;    // Which TCDS number they called
  isUrgent: boolean;
  urgencyKeywords: string[];
}

interface TwilioTranscriptPayload {
  // Twilio recording/transcript data
  RecordingSid?: string;
  RecordingUrl?: string;
  TranscriptionSid?: string;
  TranscriptionText?: string;
  TranscriptionStatus?: string;
  CallSid?: string;
  From?: string;
  To?: string;
  Duration?: string;
}

interface PendingMerge {
  id: string;
  emailData: AfterHoursEmailPayload;
  twilioData?: TwilioTranscriptPayload;
  createdAt: Date;
  phone: string;
  parsedData?: ReceptionHQExtraction;
}

// Simple in-memory store for pending merges (waiting for transcript)
// In production, use Redis or database
const pendingMerges = new Map<string, PendingMerge>();

// Cleanup old entries every 5 minutes
const MERGE_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes to wait for transcript

// =============================================================================
// RECEPTIONHQ EMAIL PARSING
// =============================================================================

/**
 * Detect if an email is from ReceptionHQ answering service
 */
function isReceptionServiceEmail(from: string, subject?: string): boolean {
  const fromLower = (from || "").toLowerCase();
  const subjectLower = (subject || "").toLowerCase();

  return (
    fromLower.includes("receptionhq") ||
    fromLower.includes("reception") ||
    fromLower.includes("answering") ||
    fromLower.includes("virtualreceptionist") ||
    subjectLower.includes("message taken") ||
    subjectLower.includes("new message from") ||
    subjectLower.includes("virtual receptionist")
  );
}

/**
 * Parse ReceptionHQ email format to extract structured fields
 *
 * Sample format:
 * Name: John Smith
 * Number: (205) 555-1234
 * Reason for call: Caller had an accident...
 * Caller ID: +12055551234
 *
 * Note: This message was taken by your Virtual Receptionist from a call to (205) 352-2250.
 */
function parseReceptionHQEmail(emailBody: string): ReceptionHQExtraction {
  const result: ReceptionHQExtraction = {
    name: null,
    phone: null,
    callerId: null,
    reason: null,
    calledNumber: null,
    isUrgent: false,
    urgencyKeywords: [],
  };

  if (!emailBody) return result;

  // Extract caller name
  // Pattern: "Name: John Smith" (may have whitespace)
  const nameMatch = emailBody.match(/Name:\s*([^\n]+)/i);
  if (nameMatch && nameMatch[1].trim().toLowerCase() !== "wrong dial") {
    result.name = nameMatch[1].trim();
  }

  // Extract phone number from "Number:" field
  // Pattern: "Number: (205) 555-1234" or "Number: (205) 368-7499 or (205) 503-1776"
  const numberMatch = emailBody.match(/Number:\s*([^\n]+)/i);
  if (numberMatch) {
    const numberText = numberMatch[1].trim();
    // Extract first phone number (in case of multiple)
    const phoneDigits = numberText.replace(/\D/g, "").slice(-10);
    if (phoneDigits.length === 10 && numberText.toLowerCase() !== "wrong dial") {
      result.phone = phoneDigits;
    }
  }

  // Extract Caller ID (E.164 format, more reliable)
  // Pattern: "Caller ID: +12055551234"
  const callerIdMatch = emailBody.match(/Caller ID:\s*(\+?\d{10,15})/i);
  if (callerIdMatch) {
    result.callerId = callerIdMatch[1].trim();
    // Use Caller ID as primary phone if Number field wasn't valid
    if (!result.phone) {
      const digits = result.callerId.replace(/\D/g, "").slice(-10);
      if (digits.length === 10) {
        result.phone = digits;
      }
    }
  }

  // Extract reason for call (can span multiple lines until next field)
  // Pattern: "Reason for call: ..." or "Message: ..."
  const reasonMatch = emailBody.match(
    /(?:Reason for call|Message):\s*([^\n]+(?:\n(?!Name:|Number:|Caller ID:|Note:|--)[^\n]+)*)/i
  );
  if (reasonMatch) {
    result.reason = reasonMatch[1].trim();
  }

  // Extract which TCDS number was called
  // Pattern: "from a call to (205) 352-2250" or "call to (205) 555-8888"
  const calledMatch = emailBody.match(/(?:from a )?call to\s*\(?(\d{3})\)?[-.\s]?(\d{3})[-.\s]?(\d{4})/i);
  if (calledMatch) {
    result.calledNumber = `${calledMatch[1]}${calledMatch[2]}${calledMatch[3]}`;
  }

  // Detect urgency from keywords in reason/message
  const urgentKeywords = [
    "urgent", "emergency", "accident", "claim", "asap",
    "immediately", "fire", "flood", "damage", "stolen",
    "theft", "totaled", "hospital", "hit", "wreck",
    "crash", "injury", "injured", "911", "police",
    "ambulance", "tonight", "right away", "as soon as possible"
  ];

  const textToScan = (result.reason || "").toLowerCase() + " " + (emailBody || "").toLowerCase();
  for (const keyword of urgentKeywords) {
    if (textToScan.includes(keyword)) {
      result.urgencyKeywords.push(keyword);
    }
  }
  result.isUrgent = result.urgencyKeywords.length > 0;

  return result;
}

/**
 * Check for duplicate after-hours message (same phone within 1 hour)
 */
async function checkForDuplicate(
  tenantId: string,
  phone: string
): Promise<{ isDuplicate: boolean; existingId?: string }> {
  if (!phone) return { isDuplicate: false };

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const normalizedPhone = phone.replace(/\D/g, "").slice(-10);

  const existing = await db
    .select({ id: messages.id, createdAt: messages.createdAt })
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

  if (existing.length > 0) {
    return { isDuplicate: true, existingId: existing[0].id };
  }

  return { isDuplicate: false };
}

/**
 * Lookup customer by phone number in local database
 */
async function lookupCustomerByPhone(
  tenantId: string,
  phone: string
): Promise<{ id: string; name: string; agencyzoomId: string | null } | null> {
  if (!phone) return null;

  const normalizedPhone = phone.replace(/\D/g, "").slice(-10);

  const customer = await db.query.customers.findFirst({
    where: and(
      eq(customers.tenantId, tenantId),
      or(
        ilike(customers.phone, `%${normalizedPhone}`),
        ilike(customers.phoneAlt, `%${normalizedPhone}`)
      )
    ),
    columns: {
      id: true,
      firstName: true,
      lastName: true,
      agencyzoomId: true,
    },
  });

  if (customer) {
    return {
      id: customer.id,
      name: `${customer.firstName || ""} ${customer.lastName || ""}`.trim() || "Unknown",
      agencyzoomId: customer.agencyzoomId,
    };
  }

  return null;
}

// =============================================================================
// MAIN HANDLER
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get("content-type") || "";
    let body: any;

    // Handle both JSON and form-urlencoded (Twilio uses form)
    if (contentType.includes("application/x-www-form-urlencoded")) {
      const formData = await request.formData();
      body = Object.fromEntries(formData.entries());
      console.log("[After-Hours] Received form data (likely Twilio):", JSON.stringify(body, null, 2));
    } else {
      body = await request.json();
      console.log("[After-Hours] Received JSON:", JSON.stringify(body, null, 2));
    }

    const tenantId = process.env.DEFAULT_TENANT_ID || "00000000-0000-0000-0000-000000000001";

    // Determine if this is a Twilio transcript or email notification
    if (body.TranscriptionText || body.TranscriptionSid || body.RecordingSid) {
      // This is a Twilio transcript callback
      return await handleTwilioTranscript(body as TwilioTranscriptPayload, tenantId);
    } else {
      // This is an after-hours email notification
      return await handleAfterHoursEmail(body as AfterHoursEmailPayload, tenantId);
    }
  } catch (error) {
    console.error("[After-Hours] Error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Processing failed" },
      { status: 500 }
    );
  }
}

// =============================================================================
// HANDLE AFTER-HOURS EMAIL
// =============================================================================

async function handleAfterHoursEmail(
  payload: AfterHoursEmailPayload,
  tenantId: string
): Promise<NextResponse> {
  console.log("[After-Hours] Processing email notification");

  // Check if this is a ReceptionHQ email and parse accordingly
  const isReceptionHQ = isReceptionServiceEmail(payload.from, payload.subject);
  let parsedData: ReceptionHQExtraction | null = null;
  let phone: string | null = null;
  let customerName: string | null = null;
  let customerId: string | null = null;
  let agencyzoomId: string | null = null;

  if (isReceptionHQ && payload.body) {
    console.log("[After-Hours] Detected ReceptionHQ email, parsing structured format");
    parsedData = parseReceptionHQEmail(payload.body);

    // Use parsed phone (from Caller ID or Number field)
    phone = parsedData.phone ? `+1${parsedData.phone}` : null;
    customerName = parsedData.name;

    console.log("[After-Hours] Parsed ReceptionHQ data:", {
      name: parsedData.name,
      phone: parsedData.phone,
      callerId: parsedData.callerId,
      reason: parsedData.reason?.substring(0, 100),
      calledNumber: parsedData.calledNumber,
      isUrgent: parsedData.isUrgent,
      urgencyKeywords: parsedData.urgencyKeywords,
    });
  } else {
    // Fallback to original phone extraction
    phone = normalizePhone(payload.phoneNumber || payload.callerNumber || "");
    customerName = payload.fromName || null;
  }

  if (!phone) {
    console.warn("[After-Hours] No phone number in email payload");
    // Still create a triage item with email content only
    const triageItem = await createAfterHoursTriageItem(
      tenantId,
      payload,
      null,
      "Unknown",
      parsedData
    );
    return NextResponse.json({ success: true, triageItemId: triageItem.id, merged: false });
  }

  // Check for duplicate (same phone within 1 hour)
  const { isDuplicate, existingId } = await checkForDuplicate(tenantId, phone);
  if (isDuplicate) {
    console.log(`[After-Hours] Duplicate detected for phone ${phone}, existing ID: ${existingId}`);
    return NextResponse.json({
      success: true,
      duplicate: true,
      existingId,
      message: "Duplicate after-hours request (same phone within 1 hour)",
    });
  }

  // Lookup customer by phone number
  const customerMatch = await lookupCustomerByPhone(tenantId, phone);
  if (customerMatch) {
    customerId = customerMatch.id;
    agencyzoomId = customerMatch.agencyzoomId;
    // Use matched customer name if we don't have one from the email
    if (!customerName || customerName === "Wrong Dial") {
      customerName = customerMatch.name;
    }
    console.log(`[After-Hours] Matched customer: ${customerName} (ID: ${customerId}, AZ: ${agencyzoomId})`);
  } else {
    console.log(`[After-Hours] No customer match found for phone ${phone}`);
  }

  // Store pending merge and wait for Twilio transcript
  const mergeId = `${phone}_${Date.now()}`;
  const pendingMerge: PendingMerge = {
    id: mergeId,
    emailData: payload,
    createdAt: new Date(),
    phone,
    parsedData: parsedData || undefined,
  };

  pendingMerges.set(mergeId, pendingMerge);
  console.log(`[After-Hours] Stored pending merge ${mergeId}, waiting for Twilio transcript`);

  // Check if we already have a recent Twilio transcript for this phone
  const existingMerge = findMatchingPendingMerge(phone, true);
  if (existingMerge?.twilioData) {
    console.log(`[After-Hours] Found existing Twilio transcript, merging immediately`);
    return await completeMerge(tenantId, existingMerge, customerName, customerId, agencyzoomId);
  }

  // Wait a short time for transcript, then proceed without it if needed
  // In production, this would be handled async with a background job
  await new Promise(resolve => setTimeout(resolve, 5000)); // 5 second wait

  // Check again for transcript
  const updatedMerge = pendingMerges.get(mergeId);
  if (updatedMerge?.twilioData) {
    return await completeMerge(tenantId, updatedMerge, customerName, customerId, agencyzoomId);
  }

  // No transcript yet - create item with email only
  // Transcript will be merged later if it arrives
  console.log(`[After-Hours] No Twilio transcript yet, creating item with email data only`);
  const triageItem = await createAfterHoursTriageItem(
    tenantId,
    payload,
    null,
    phone,
    parsedData,
    customerName,
    customerId,
    agencyzoomId
  );

  // Keep the pending merge active for potential late transcript
  pendingMerges.set(mergeId, {
    ...updatedMerge!,
    id: triageItem.id, // Update ID to triage item for later update
  });

  return NextResponse.json({
    success: true,
    triageItemId: triageItem.id,
    merged: false,
    waitingForTranscript: true,
    customerId,
    customerName,
    isUrgent: parsedData?.isUrgent || false,
  });
}

// =============================================================================
// HANDLE TWILIO TRANSCRIPT
// =============================================================================

async function handleTwilioTranscript(
  payload: TwilioTranscriptPayload,
  tenantId: string
): Promise<NextResponse> {
  console.log("[After-Hours] Processing Twilio transcript");

  if (payload.TranscriptionStatus !== "completed" && !payload.TranscriptionText) {
    console.log("[After-Hours] Transcript not ready, status:", payload.TranscriptionStatus);
    return NextResponse.json({ success: true, status: "pending" });
  }

  const phone = normalizePhone(payload.From);

  // Look for pending email notification to merge with
  const pendingMerge = findMatchingPendingMerge(phone, false);

  if (pendingMerge) {
    console.log(`[After-Hours] Found pending email, merging with transcript`);
    pendingMerge.twilioData = payload;
    return await completeMerge(tenantId, pendingMerge);
  }

  // No pending email - this might be a standalone voicemail
  // Or the transcript arrived before the email notification
  console.log(`[After-Hours] No pending email found, storing transcript for later merge`);

  const mergeId = `twilio_${phone}_${Date.now()}`;
  pendingMerges.set(mergeId, {
    id: mergeId,
    emailData: {
      from: phone || "Unknown",
      type: "voicemail",
      phoneNumber: phone || undefined,
    },
    twilioData: payload,
    createdAt: new Date(),
    phone: phone || "unknown",
  });

  // Wait briefly for email to arrive
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Check if email arrived
  const updated = pendingMerges.get(mergeId);
  if (updated && updated.emailData.body) {
    return await completeMerge(tenantId, updated);
  }

  // Create item with transcript only
  console.log(`[After-Hours] Creating item with Twilio transcript only`);
  const triageItem = await createAfterHoursTriageItem(
    tenantId,
    { from: phone || "Unknown", type: "voicemail", phoneNumber: phone || undefined },
    payload,
    phone || "Unknown"
  );

  return NextResponse.json({
    success: true,
    triageItemId: triageItem.id,
    merged: false,
    transcriptOnly: true,
  });
}

// =============================================================================
// MERGE AND CREATE TRIAGE ITEM
// =============================================================================

async function completeMerge(
  tenantId: string,
  merge: PendingMerge,
  customerName?: string | null,
  customerId?: string | null,
  agencyzoomId?: string | null
): Promise<NextResponse> {
  console.log(`[After-Hours] Completing merge for ${merge.phone}`);

  // Clean up pending merge
  pendingMerges.delete(merge.id);

  const triageItem = await createAfterHoursTriageItem(
    tenantId,
    merge.emailData,
    merge.twilioData || null,
    merge.phone,
    merge.parsedData,
    customerName,
    customerId,
    agencyzoomId
  );

  return NextResponse.json({
    success: true,
    triageItemId: triageItem.id,
    merged: true,
    customerId,
    customerName,
    isUrgent: merge.parsedData?.isUrgent || false,
  });
}

async function createAfterHoursTriageItem(
  tenantId: string,
  emailData: AfterHoursEmailPayload,
  twilioData: TwilioTranscriptPayload | null,
  phone: string,
  parsedData?: ReceptionHQExtraction | null,
  customerName?: string | null,
  customerId?: string | null,
  agencyzoomId?: string | null
) {
  // Merge content using AI (pass parsed data for better context)
  const mergedContent = await mergeContentWithAI(emailData, twilioData, parsedData);

  // Build a comprehensive body including all relevant info
  const bodyParts: string[] = [];
  if (mergedContent.summary) {
    bodyParts.push(`Summary: ${mergedContent.summary}`);
  }
  if (twilioData?.TranscriptionText) {
    bodyParts.push(`\n\nVoicemail: ${twilioData.TranscriptionText}`);
  }
  // For ReceptionHQ emails, include the parsed content more cleanly
  if (parsedData?.reason) {
    bodyParts.push(`\n\nEmail: ${parsedData.reason}`);
  } else if (emailData.body && emailData.body !== twilioData?.TranscriptionText) {
    bodyParts.push(`\n\nEmail: ${emailData.body}`);
  }
  if (mergedContent.actionItems.length > 0) {
    bodyParts.push(`\n\nAction Items:\n- ${mergedContent.actionItems.join('\n- ')}`);
  }
  const fullBody = bodyParts.join('') || 'After-hours message received. Callback required.';

  // Determine the called number (which TCDS line was dialed)
  const calledNumber = parsedData?.calledNumber
    ? `+1${parsedData.calledNumber}`
    : process.env.TWILIO_PHONE_NUMBER || "";

  // Use parsed urgency or AI-determined urgency
  const isUrgent = parsedData?.isUrgent || mergedContent.urgency === "high";

  // Create an after-hours message for the pending review queue
  const [message] = await db
    .insert(messages)
    .values({
      tenantId,
      type: "sms", // Using SMS type for voicemail/after-hours messages
      direction: "inbound",
      fromNumber: phone, // Now contains caller's actual phone, not email sender
      toNumber: calledNumber,
      body: fullBody,
      externalId: twilioData?.CallSid || `after_hours_${Date.now()}`,
      status: "received",
      isAfterHours: true,
      isAcknowledged: false,
      // Use matched customer name or parsed name
      contactName: customerName || parsedData?.name || emailData.fromName || undefined,
      contactType: "customer",
      // Store customer match info if available
      customerId: customerId || undefined,
    })
    .returning();

  // Also create a triage item for the after-hours queue
  const displayName = customerName || parsedData?.name || phone;
  const [triageItem] = await db
    .insert(triageItems)
    .values({
      tenantId,
      type: "after_hours",
      status: "pending",
      priority: isUrgent ? "urgent" : "medium",
      title: displayName,
      description: parsedData?.reason || emailData.body || "After-hours call received",
      aiSummary: mergedContent.summary,
      aiPriorityReason: isUrgent
        ? `Urgency keywords detected: ${parsedData?.urgencyKeywords?.join(", ")}`
        : undefined,
      customerId: customerId || undefined,
      messageId: message.id,
      // Set SLA - after-hours items should be addressed within 8 hours (next business day)
      dueAt: new Date(Date.now() + 8 * 60 * 60 * 1000),
    })
    .returning();

  console.log(`[After-Hours] Created after-hours message ${message.id} and triage item ${triageItem.id}`, {
    phone,
    customerName,
    customerId,
    agencyzoomId,
    isUrgent,
    urgencyKeywords: parsedData?.urgencyKeywords,
  });

  return message;
}

// =============================================================================
// AI MERGE
// =============================================================================

interface MergedContent {
  summary: string;
  actionItems: string[];
  callbackRequired: boolean;
  urgency: "low" | "medium" | "high";
}

async function mergeContentWithAI(
  emailData: AfterHoursEmailPayload,
  twilioData: TwilioTranscriptPayload | null,
  parsedData?: ReceptionHQExtraction | null
): Promise<MergedContent> {
  const openaiKey = process.env.OPENAI_API_KEY;

  // If we already detected urgency via keywords, use that
  const preDetectedUrgency = parsedData?.isUrgent ? "high" : null;

  if (!openaiKey) {
    // No AI available, return basic summary
    return {
      summary: buildBasicSummary(emailData, twilioData, parsedData),
      actionItems: ["Return call when office opens"],
      callbackRequired: true,
      urgency: preDetectedUrgency || "medium",
    };
  }

  try {
    const openai = new OpenAI({ apiKey: openaiKey });

    // Build prompt with parsed data if available
    let callerInfo = "";
    if (parsedData) {
      callerInfo = `
CALLER INFORMATION (parsed from ReceptionHQ):
Name: ${parsedData.name || "Unknown"}
Phone: ${parsedData.phone || "Unknown"}
Reason for Call: ${parsedData.reason || "Not provided"}
Called Number: ${parsedData.calledNumber || "Unknown"}
${parsedData.isUrgent ? `\n⚠️ URGENCY DETECTED - Keywords found: ${parsedData.urgencyKeywords.join(", ")}` : ""}
`;
    }

    const prompt = `Analyze this after-hours contact and provide a merged summary.
${callerInfo}
EMAIL NOTIFICATION:
From: ${emailData.fromName || emailData.from || "Unknown"}
Subject: ${emailData.subject || "No subject"}
Body: ${parsedData?.reason || emailData.body || emailData.emailTranscript || "No content"}

${twilioData?.TranscriptionText ? `VOICEMAIL TRANSCRIPT:
${twilioData.TranscriptionText}` : "No voicemail transcript available."}

Provide a JSON response with:
1. "summary": A brief 2-3 sentence summary combining all information. Start with the caller's name if known.
2. "actionItems": Array of specific action items (e.g., "Return call to [Name] about auto claim", "Check policy renewal date")
3. "callbackRequired": true/false - whether this requires a callback
4. "urgency": "low", "medium", or "high" based on content (claims/accidents/emergencies are high, general inquiries are low)

Focus on what the customer needs and any time-sensitive matters.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are an assistant for an insurance agency. Analyze after-hours messages and provide concise, actionable summaries. Always respond with valid JSON.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.3,
      response_format: { type: "json_object" },
    });

    const result = JSON.parse(response.choices[0]?.message?.content || "{}");

    // Use pre-detected urgency if it was high, otherwise use AI result
    const finalUrgency = preDetectedUrgency === "high" ? "high" : (result.urgency || "medium");

    return {
      summary: result.summary || buildBasicSummary(emailData, twilioData, parsedData),
      actionItems: result.actionItems || ["Return call when office opens"],
      callbackRequired: result.callbackRequired ?? true,
      urgency: finalUrgency,
    };
  } catch (error) {
    console.error("[After-Hours] AI merge failed:", error);
    return {
      summary: buildBasicSummary(emailData, twilioData, parsedData),
      actionItems: ["Return call when office opens"],
      callbackRequired: true,
      urgency: preDetectedUrgency || "medium",
    };
  }
}

function buildBasicSummary(
  emailData: AfterHoursEmailPayload,
  twilioData: TwilioTranscriptPayload | null,
  parsedData?: ReceptionHQExtraction | null
): string {
  const parts: string[] = [];

  // Use parsed name if available
  if (parsedData?.name) {
    parts.push(`Contact from ${parsedData.name}.`);
  } else if (emailData.fromName) {
    parts.push(`Contact from ${emailData.fromName}.`);
  }

  // Use parsed reason if available
  if (parsedData?.reason) {
    parts.push(parsedData.reason.substring(0, 300));
  } else {
    if (emailData.subject) {
      parts.push(`Subject: ${emailData.subject}.`);
    }
    if (emailData.body) {
      parts.push(emailData.body.substring(0, 200));
    }
  }

  if (twilioData?.TranscriptionText) {
    parts.push(`Voicemail: "${twilioData.TranscriptionText.substring(0, 200)}..."`);
  }

  // Add urgency note if detected
  if (parsedData?.isUrgent) {
    parts.push(`[URGENT: ${parsedData.urgencyKeywords.join(", ")}]`);
  }

  return parts.join(" ") || "After-hours message received. Callback required.";
}

// =============================================================================
// HELPERS
// =============================================================================

function normalizePhone(phone: string | undefined | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (digits.length > 10) return `+${digits}`;
  return phone;
}

function findMatchingPendingMerge(phone: string | null, lookingForTwilio: boolean): PendingMerge | undefined {
  if (!phone) return undefined;

  const now = Date.now();

  // Clean up old entries
  for (const [key, value] of pendingMerges.entries()) {
    if (now - value.createdAt.getTime() > MERGE_TIMEOUT_MS) {
      pendingMerges.delete(key);
    }
  }

  // Find matching entry
  for (const [key, value] of pendingMerges.entries()) {
    if (value.phone === phone) {
      if (lookingForTwilio && value.twilioData) {
        return value;
      }
      if (!lookingForTwilio && !value.twilioData) {
        return value;
      }
    }
  }

  return undefined;
}

// =============================================================================
// CLEANUP ENDPOINT (Optional - for manual trigger)
// =============================================================================

export async function DELETE(request: NextRequest) {
  // Clean up old pending merges
  const now = Date.now();
  let cleaned = 0;

  for (const [key, value] of pendingMerges.entries()) {
    if (now - value.createdAt.getTime() > MERGE_TIMEOUT_MS) {
      pendingMerges.delete(key);
      cleaned++;
    }
  }

  return NextResponse.json({
    success: true,
    cleaned,
    remaining: pendingMerges.size,
  });
}
