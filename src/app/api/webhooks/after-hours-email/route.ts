// API Route: /api/webhooks/after-hours-email
// Receives after-hours email notifications and merges with Twilio transcripts
// Flow: Email arrives → Wait for Twilio transcript → AI merge → Create triage item

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { triageItems, messages, calls } from "@/db/schema";
import { eq, and, gte, desc, or } from "drizzle-orm";
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
}

// Simple in-memory store for pending merges (waiting for transcript)
// In production, use Redis or database
const pendingMerges = new Map<string, PendingMerge>();

// Cleanup old entries every 5 minutes
const MERGE_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes to wait for transcript

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

  const phone = normalizePhone(payload.phoneNumber || payload.callerNumber || payload.from);

  if (!phone) {
    console.warn("[After-Hours] No phone number in email payload");
    // Still create a triage item with email content only
    const triageItem = await createAfterHoursTriageItem(
      tenantId,
      payload,
      null,
      phone || "Unknown"
    );
    return NextResponse.json({ success: true, triageItemId: triageItem.id, merged: false });
  }

  // Store pending merge and wait for Twilio transcript
  const mergeId = `${phone}_${Date.now()}`;
  const pendingMerge: PendingMerge = {
    id: mergeId,
    emailData: payload,
    createdAt: new Date(),
    phone,
  };

  pendingMerges.set(mergeId, pendingMerge);
  console.log(`[After-Hours] Stored pending merge ${mergeId}, waiting for Twilio transcript`);

  // Check if we already have a recent Twilio transcript for this phone
  const existingMerge = findMatchingPendingMerge(phone, true);
  if (existingMerge?.twilioData) {
    console.log(`[After-Hours] Found existing Twilio transcript, merging immediately`);
    return await completeMerge(tenantId, existingMerge);
  }

  // Wait a short time for transcript, then proceed without it if needed
  // In production, this would be handled async with a background job
  await new Promise(resolve => setTimeout(resolve, 5000)); // 5 second wait

  // Check again for transcript
  const updatedMerge = pendingMerges.get(mergeId);
  if (updatedMerge?.twilioData) {
    return await completeMerge(tenantId, updatedMerge);
  }

  // No transcript yet - create item with email only
  // Transcript will be merged later if it arrives
  console.log(`[After-Hours] No Twilio transcript yet, creating item with email data only`);
  const triageItem = await createAfterHoursTriageItem(
    tenantId,
    payload,
    null,
    phone
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
      phoneNumber: phone,
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
    { from: phone || "Unknown", type: "voicemail", phoneNumber: phone },
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
  merge: PendingMerge
): Promise<NextResponse> {
  console.log(`[After-Hours] Completing merge for ${merge.phone}`);

  // Clean up pending merge
  pendingMerges.delete(merge.id);

  const triageItem = await createAfterHoursTriageItem(
    tenantId,
    merge.emailData,
    merge.twilioData || null,
    merge.phone
  );

  return NextResponse.json({
    success: true,
    triageItemId: triageItem.id,
    merged: true,
  });
}

async function createAfterHoursTriageItem(
  tenantId: string,
  emailData: AfterHoursEmailPayload,
  twilioData: TwilioTranscriptPayload | null,
  phone: string
) {
  // Merge content using AI
  const mergedContent = await mergeContentWithAI(emailData, twilioData);

  const messageType = emailData.type || (twilioData?.TranscriptionText ? "voicemail" : "missed_call");
  const title = `After Hours ${messageType === "voicemail" ? "Voicemail" : "Message"} from ${emailData.fromName || phone}`;

  // Create triage item
  const [triageItem] = await db
    .insert(triageItems)
    .values({
      tenantId,
      type: "after_hours",
      status: "pending",
      priority: "high", // After-hours items are high priority
      title,
      description: mergedContent.summary,
      aiSummary: JSON.stringify({
        phone,
        fromName: emailData.fromName,
        emailSubject: emailData.subject,
        emailBody: emailData.body,
        twilioTranscript: twilioData?.TranscriptionText,
        mergedSummary: mergedContent.summary,
        actionItems: mergedContent.actionItems,
        callbackRequired: mergedContent.callbackRequired,
        urgency: mergedContent.urgency,
        messageType,
        merged: !!twilioData?.TranscriptionText && !!emailData.body,
      }),
      metadata: {
        phone,
        messageType,
        emailReceivedAt: emailData.receivedAt,
        audioUrl: emailData.audioUrl || twilioData?.RecordingUrl,
        twilioCallSid: twilioData?.CallSid,
        duration: twilioData?.Duration,
      },
    })
    .returning();

  console.log(`[After-Hours] Created triage item ${triageItem.id}`);

  return triageItem;
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
  twilioData: TwilioTranscriptPayload | null
): Promise<MergedContent> {
  const openaiKey = process.env.OPENAI_API_KEY;

  if (!openaiKey) {
    // No AI available, return basic summary
    return {
      summary: buildBasicSummary(emailData, twilioData),
      actionItems: ["Return call when office opens"],
      callbackRequired: true,
      urgency: "medium",
    };
  }

  try {
    const openai = new OpenAI({ apiKey: openaiKey });

    const prompt = `Analyze this after-hours contact and provide a merged summary.

EMAIL NOTIFICATION:
From: ${emailData.fromName || emailData.from || "Unknown"}
Subject: ${emailData.subject || "No subject"}
Body: ${emailData.body || emailData.emailTranscript || "No content"}

${twilioData?.TranscriptionText ? `VOICEMAIL TRANSCRIPT:
${twilioData.TranscriptionText}` : "No voicemail transcript available."}

Provide a JSON response with:
1. "summary": A brief 2-3 sentence summary combining all information
2. "actionItems": Array of specific action items (e.g., "Return call about auto claim", "Check policy renewal date")
3. "callbackRequired": true/false - whether this requires a callback
4. "urgency": "low", "medium", or "high" based on content (claims/accidents are high, general inquiries are low)

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

    return {
      summary: result.summary || buildBasicSummary(emailData, twilioData),
      actionItems: result.actionItems || ["Return call when office opens"],
      callbackRequired: result.callbackRequired ?? true,
      urgency: result.urgency || "medium",
    };
  } catch (error) {
    console.error("[After-Hours] AI merge failed:", error);
    return {
      summary: buildBasicSummary(emailData, twilioData),
      actionItems: ["Return call when office opens"],
      callbackRequired: true,
      urgency: "medium",
    };
  }
}

function buildBasicSummary(
  emailData: AfterHoursEmailPayload,
  twilioData: TwilioTranscriptPayload | null
): string {
  const parts: string[] = [];

  if (emailData.fromName) {
    parts.push(`Contact from ${emailData.fromName}.`);
  }

  if (emailData.subject) {
    parts.push(`Subject: ${emailData.subject}.`);
  }

  if (emailData.body) {
    parts.push(emailData.body.substring(0, 200));
  }

  if (twilioData?.TranscriptionText) {
    parts.push(`Voicemail: "${twilioData.TranscriptionText.substring(0, 200)}..."`);
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
