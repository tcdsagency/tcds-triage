// API Route: /api/webhook/incoming-message
// Twilio webhook for incoming SMS messages

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { messages, tenants, customers, triageItems } from "@/db/schema";
import { eq, and, gte, or, ilike } from "drizzle-orm";
import { getAgencyZoomClient } from "@/lib/api/agencyzoom";

// =============================================================================
// TYPES
// =============================================================================

interface TwilioIncomingMessage {
  MessageSid: string;
  From: string;
  To: string;
  Body: string;
  NumMedia?: string;
  MediaUrl0?: string;
  MediaContentType0?: string;
  AccountSid?: string;
  ApiVersion?: string;
  DateSent?: string;
}

// =============================================================================
// POST - Handle Incoming SMS from Twilio
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    // Support both JSON and form data (Twilio sends form-urlencoded)
    const contentType = request.headers.get("content-type") || "";
    let payload: TwilioIncomingMessage;

    let formData: FormData | null = null;
    let jsonData: any = null;

    if (contentType.includes("application/json")) {
      // Parse JSON payload (from Zapier, custom integrations, etc.)
      jsonData = await request.json();
      payload = {
        MessageSid: jsonData.MessageSid || jsonData.externalId || jsonData.messageSid || `custom_${Date.now()}`,
        From: jsonData.From || jsonData.from || "",
        To: jsonData.To || jsonData.to || "",
        Body: jsonData.Body || jsonData.body || "",
        NumMedia: jsonData.NumMedia || jsonData.numMedia || "0",
        MediaUrl0: jsonData.MediaUrl0 || jsonData.mediaUrl0,
        MediaContentType0: jsonData.MediaContentType0 || jsonData.mediaContentType0,
        AccountSid: jsonData.AccountSid || jsonData.accountSid,
        DateSent: jsonData.DateSent || jsonData.dateSent,
      };
    } else {
      // Parse form data (Twilio sends as x-www-form-urlencoded)
      formData = await request.formData();
      payload = {
        MessageSid: formData.get("MessageSid") as string,
        From: formData.get("From") as string,
        To: formData.get("To") as string,
        Body: formData.get("Body") as string,
        NumMedia: formData.get("NumMedia") as string,
        MediaUrl0: formData.get("MediaUrl0") as string,
        MediaContentType0: formData.get("MediaContentType0") as string,
        AccountSid: formData.get("AccountSid") as string,
        DateSent: formData.get("DateSent") as string || undefined,
      };
    }

    console.log("[Webhook] Incoming SMS:", {
      from: payload.From,
      to: payload.To,
      body: payload.Body?.substring(0, 50),
      sid: payload.MessageSid,
    });

    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      console.error("[Webhook] Tenant not configured");
      return new NextResponse("OK", { status: 200 }); // Always return 200 to Twilio
    }

    // Dedup check: Twilio retries webhooks on timeout, so the same MessageSid
    // can arrive multiple times. Return 200 to stop retries if already stored.
    if (payload.MessageSid && !payload.MessageSid.startsWith('custom_')) {
      const existingMessage = await db.query.messages.findFirst({
        where: (messages, { eq }) => eq(messages.externalId, payload.MessageSid),
        columns: { id: true },
      });
      if (existingMessage) {
        console.log("[Webhook] Duplicate message detected, skipping:", payload.MessageSid);
        return new NextResponse(
          '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
          { status: 200, headers: { "Content-Type": "text/xml" } }
        );
      }
    }

    // Check for opt-out keywords (TCPA compliance)
    const optOutKeywords = ['stop', 'unsubscribe', 'cancel', 'quit', 'end'];
    const bodyLower = (payload.Body || '').trim().toLowerCase();
    const isOptOut = optOutKeywords.includes(bodyLower);

    // 1. Look up contact - check local DB first (fast), then AgencyZoom API (slower)
    let contactId: string | null = null;
    let contactName: string | null = null;
    let contactType: "customer" | "lead" | null = null;

    // Normalize phone for matching
    const normalizedPhone = payload.From.replace(/\D/g, '');
    const phoneVariants = [
      normalizedPhone,
      normalizedPhone.slice(-10), // Last 10 digits (without country code)
    ];

    // 1a. Check local database first (fast lookup)
    try {
      const [localContact] = await db
        .select({
          id: customers.id,
          agencyzoomId: customers.agencyzoomId,
          firstName: customers.firstName,
          lastName: customers.lastName,
          isLead: customers.isLead,
        })
        .from(customers)
        .where(
          and(
            eq(customers.tenantId, tenantId),
            or(
              ...phoneVariants.map(p => ilike(customers.phone, `%${p.slice(-10)}%`)),
              ...phoneVariants.map(p => ilike(customers.phoneAlt, `%${p.slice(-10)}%`))
            )
          )
        )
        .limit(1);

      if (localContact) {
        contactId = localContact.agencyzoomId || localContact.id;
        // Only set name if we have actual name data (not undefined/null)
        const firstName = localContact.firstName || '';
        const lastName = localContact.lastName || '';
        const fullName = `${firstName} ${lastName}`.trim();
        contactName = fullName || null; // Don't set "undefined undefined" or empty string
        contactType = localContact.isLead ? "lead" : "customer";
        console.log("[Webhook] Found local contact:", contactName, contactType);
      }
    } catch (error) {
      console.warn("[Webhook] Local DB lookup failed:", error);
    }

    // 1b. If not found locally, check AgencyZoom API
    if (!contactId) {
      try {
        const azClient = getAgencyZoomClient();

        // First try to find as a customer
        const customer = await azClient.findCustomerByPhone(payload.From);
        if (customer) {
          contactId = customer.id.toString();
          const firstName = customer.firstName || '';
          const lastName = customer.lastName || '';
          const fullName = `${firstName} ${lastName}`.trim();
          contactName = fullName || null;
          contactType = "customer";
          console.log("[Webhook] Found AZ customer:", contactName);
        } else {
          // If not a customer, try to find as a lead
          const lead = await azClient.findLeadByPhone(payload.From);
          if (lead) {
            contactId = lead.id.toString();
            const firstName = lead.firstName || '';
            const lastName = lead.lastName || '';
            const fullName = `${firstName} ${lastName}`.trim();
            contactName = fullName || null;
            contactType = "lead";
            console.log("[Webhook] Found AZ lead:", contactName);
          }
        }
      } catch (error) {
        console.warn("[Webhook] AgencyZoom lookup failed:", error);
      }
    }

    // 2. Check if after-hours
    const afterHoursInfo = await checkAfterHours(tenantId);
    const isAfterHours = afterHoursInfo.isAfterHours;

    // 3. Collect media URLs
    const mediaUrls: string[] = [];
    const numMedia = parseInt(payload.NumMedia || "0", 10);
    for (let i = 0; i < numMedia; i++) {
      let mediaUrl: string | null = null;
      if (formData) {
        mediaUrl = formData.get(`MediaUrl${i}`) as string;
      } else if (jsonData) {
        mediaUrl = jsonData[`MediaUrl${i}`] || jsonData[`mediaUrl${i}`];
      }
      if (mediaUrl) {
        mediaUrls.push(mediaUrl);
      }
    }

    // 4. Store message in database
    const [storedMessage] = await db
      .insert(messages)
      .values({
        tenantId,
        type: mediaUrls.length > 0 ? "mms" : "sms",
        direction: "inbound",
        fromNumber: payload.From,
        toNumber: payload.To,
        body: payload.Body || "",
        mediaUrls: mediaUrls.length > 0 ? mediaUrls : [],
        externalId: payload.MessageSid,
        status: "received",
        contactId,
        contactName,
        contactType,
        isAcknowledged: false,
        isAfterHours,
        sentAt: payload.DateSent ? new Date(payload.DateSent) : new Date(),
      })
      .returning();

    console.log("[Webhook] Message stored:", storedMessage.id);

    // 5. Create triage item for pending review
    const [triageItem] = await db
      .insert(triageItems)
      .values({
        tenantId,
        type: "message",
        status: isOptOut ? "completed" : "pending",
        priority: isOptOut ? "low" : (isAfterHours ? "high" : "medium"),
        messageId: storedMessage.id,
        title: isOptOut
          ? `OPT-OUT from ${contactName || payload.From}`
          : `SMS from ${contactName || payload.From}`,
        description: payload.Body?.substring(0, 500) || "New SMS message",
        aiSummary: JSON.stringify({
          from: payload.From,
          contactType,
          isAfterHours,
          isOptOut,
          mediaCount: mediaUrls?.length || 0,
        }),
      })
      .returning();

    console.log("[Webhook] Triage item created:", triageItem.id);

    // 6. Handle after-hours auto-reply - Send via AgencyZoom (shows in AZ message history)
    // Skip auto-reply for opt-out messages (TCPA compliance)
    if (!isOptOut && isAfterHours && afterHoursInfo.enabled && afterHoursInfo.autoReplyMessage) {
      // Check cooldown - don't spam the same number
      const cooldownPassed = await checkAutoReplyCooldown(
        tenantId,
        payload.From,
        afterHoursInfo.cooldownHours
      );

      if (cooldownPassed) {
        console.log("[Webhook] Sending after-hours auto-reply via AgencyZoom to:", payload.From);

        // Send via AgencyZoom sidecar (appears in AZ message history)
        const result = await sendSMSViaAgencyZoom(payload.From, afterHoursInfo.autoReplyMessage);

        if (result.success) {
          // Mark that we sent an auto-reply
          await db
            .update(messages)
            .set({ afterHoursAutoReplySent: true })
            .where(eq(messages.id, storedMessage.id));

          // Store the outgoing auto-reply message
          await db.insert(messages).values({
            tenantId,
            type: "sms",
            direction: "outbound",
            fromNumber: payload.To,
            toNumber: payload.From,
            body: afterHoursInfo.autoReplyMessage,
            externalId: `az_${Date.now()}`,
            status: "sent",
            contactId,
            contactName,
            contactType,
            isAcknowledged: true, // Auto-replies are auto-acknowledged
            isAfterHours: true,
            aiGenerated: true,
            sentAt: new Date(),
          });

          console.log("[Webhook] Auto-reply sent via AgencyZoom");
        } else {
          console.error("[Webhook] Auto-reply failed:", result.error);
        }
      } else {
        console.log("[Webhook] Auto-reply skipped (cooldown):", payload.From);
      }
    }

    // 7. Broadcast via SSE for real-time notifications
    try {
      const { broadcastNewMessage } = await import("@/app/api/messages/stream/route");
      broadcastNewMessage(storedMessage);
    } catch (err) {
      // Non-critical — SSE clients will pick up via polling fallback
      console.warn("[Webhook] SSE broadcast failed:", err);
    }

    // Always return TwiML response (empty is fine)
    return new NextResponse(
      '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
      {
        status: 200,
        headers: { "Content-Type": "text/xml" },
      }
    );
  } catch (error) {
    console.error("[Webhook] Error processing incoming message:", error);
    // Still return 200 to prevent Twilio retries
    return new NextResponse("OK", { status: 200 });
  }
}

// =============================================================================
// HELPERS
// =============================================================================

const SIDECAR_URL = process.env.SIDECAR_URL || "https://tcds-sidecar-production.up.railway.app";

async function sendSMSViaAgencyZoom(
  phoneNumber: string,
  message: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(`${SIDECAR_URL}/agencyzoom/sms`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phone_number: phoneNumber.replace(/\D/g, ""), // Digits only
        message,
      }),
    });

    const data = await response.json();
    return {
      success: data.success === true,
      error: data.error || undefined,
    };
  } catch (error) {
    console.error("[sendSMSViaAgencyZoom] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

interface AfterHoursInfo {
  isAfterHours: boolean;
  enabled: boolean;
  autoReplyMessage: string | null;
  cooldownHours: number;
}

async function checkAfterHours(tenantId: string): Promise<AfterHoursInfo> {
  try {
    const [tenant] = await db
      .select({
        timezone: tenants.timezone,
        businessHours: tenants.businessHours,
        features: tenants.features,
      })
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);

    if (!tenant) {
      return {
        isAfterHours: false,
        enabled: false,
        autoReplyMessage: null,
        cooldownHours: 4,
      };
    }

    const features = tenant.features as any;
    const enabled = features?.afterHoursAutoReply ?? false;
    const autoReplyMessage = features?.afterHoursMessage || null;
    const cooldownHours = features?.afterHoursCooldown ?? 4;

    if (!enabled) {
      return {
        isAfterHours: false,
        enabled: false,
        autoReplyMessage,
        cooldownHours,
      };
    }

    // Check current time against business hours
    const timezone = tenant.timezone || "America/Chicago";
    const now = new Date();

    // Get current day/time in tenant's timezone
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      weekday: "long",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

    const parts = formatter.formatToParts(now);
    const weekday = parts.find((p) => p.type === "weekday")?.value?.toLowerCase();
    const hour = parts.find((p) => p.type === "hour")?.value;
    const minute = parts.find((p) => p.type === "minute")?.value;

    const currentTime = `${hour}:${minute}`;
    const businessHours = tenant.businessHours as Record<string, any>;
    const todayHours = weekday ? businessHours?.[weekday] : null;

    if (!todayHours || todayHours.closed) {
      return {
        isAfterHours: true,
        enabled,
        autoReplyMessage,
        cooldownHours,
      };
    }

    const isWithinHours =
      currentTime >= todayHours.open && currentTime < todayHours.close;

    return {
      isAfterHours: !isWithinHours,
      enabled,
      autoReplyMessage,
      cooldownHours,
    };
  } catch (error) {
    console.error("[Webhook] Error checking after-hours:", error);
    return {
      isAfterHours: false,
      enabled: false,
      autoReplyMessage: null,
      cooldownHours: 4,
    };
  }
}

async function checkAutoReplyCooldown(
  tenantId: string,
  phone: string,
  cooldownHours: number
): Promise<boolean> {
  try {
    // Use atomic Redis SET NX to prevent race conditions where two simultaneous
    // messages both pass the cooldown check before either writes the outbound record
    const IORedis = (await import('ioredis')).default;
    const redisUrl = process.env.REDIS_URL;
    if (redisUrl) {
      const redis = new IORedis(redisUrl, { tls: { rejectUnauthorized: false }, lazyConnect: true });
      try {
        await redis.connect();
        const cooldownKey = `auto-reply-cooldown:${tenantId}:${phone}`;
        const ttlSeconds = cooldownHours * 3600;
        const result = await redis.set(cooldownKey, '1', 'EX', ttlSeconds, 'NX');
        await redis.quit();
        return result === 'OK'; // true if lock acquired (no recent reply)
      } catch (redisError) {
        console.error("[Webhook] Redis cooldown check failed, falling back to DB:", redisError);
        try { await redis.quit(); } catch { /* ignore */ }
        // Fall through to DB-based check below
      }
    }

    // Fallback: DB-based cooldown check (still works, just has the race window)
    const cooldownStart = new Date();
    cooldownStart.setHours(cooldownStart.getHours() - cooldownHours);

    const [recentReply] = await db
      .select({ id: messages.id })
      .from(messages)
      .where(
        and(
          eq(messages.tenantId, tenantId),
          eq(messages.direction, "outbound"),
          eq(messages.toNumber, phone),
          eq(messages.isAfterHours, true),
          eq(messages.aiGenerated, true),
          gte(messages.sentAt, cooldownStart)
        )
      )
      .limit(1);

    return !recentReply;
  } catch (error) {
    console.error("[Webhook] Error checking cooldown:", error);
    return true; // Default to allowing the reply
  }
}
