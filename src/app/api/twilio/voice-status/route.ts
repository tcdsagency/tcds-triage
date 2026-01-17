// =============================================================================
// Twilio Voice Status Webhook - Screen Pop for Forwarded Calls
// =============================================================================
// POST /api/twilio/voice-status
// Configure this URL as statusCallback in Twilio call routing.
// Receives: initiated, ringing, answered, in-progress, completed
// Creates call records and triggers screen pops for calls forwarded via Twilio.
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { calls, users, customers } from "@/db/schema";
import { eq, and, or, ilike, desc } from "drizzle-orm";

// =============================================================================
// Realtime Notification
// =============================================================================

async function notifyRealtimeServer(event: Record<string, unknown>) {
  const realtimeUrl = process.env.REALTIME_SERVER_URL;
  if (!realtimeUrl) return; // Skip if no realtime server configured

  try {
    const response = await fetch(`${realtimeUrl}/api/broadcast`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": process.env.REALTIME_API_KEY || "",
      },
      body: JSON.stringify(event),
    });

    if (!response.ok) {
      console.error(`[Twilio Status] Realtime broadcast failed: ${response.status}`);
    }
  } catch (error) {
    console.error("[Twilio Status] Failed to notify realtime:", error);
  }
}

// =============================================================================
// Phone Normalization
// =============================================================================

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "").slice(-10);
}

// =============================================================================
// Customer Lookup
// =============================================================================

async function findCustomerByPhone(phone: string, tenantId: string) {
  const digits = normalizePhone(phone);
  if (digits.length < 10) return null;

  const [customer] = await db
    .select({
      id: customers.id,
      firstName: customers.firstName,
      lastName: customers.lastName,
    })
    .from(customers)
    .where(
      and(
        eq(customers.tenantId, tenantId),
        or(
          ilike(customers.phone, `%${digits}`),
          ilike(customers.phoneAlt, `%${digits}`)
        )
      )
    )
    .limit(1);

  return customer;
}

// =============================================================================
// Twilio Status Webhook Types
// =============================================================================

interface TwilioStatusPayload {
  CallSid: string;
  AccountSid: string;
  From: string;
  To: string;
  CallStatus: "initiated" | "ringing" | "in-progress" | "answered" | "completed" | "busy" | "no-answer" | "canceled" | "failed";
  Direction: "inbound" | "outbound-api" | "outbound-dial";
  CallerName?: string;
  ForwardedFrom?: string;
  CallDuration?: string;
  RecordingUrl?: string;
  RecordingSid?: string;
  Timestamp?: string;
}

// =============================================================================
// POST Handler
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    // Parse form-urlencoded body (Twilio sends this format)
    const formData = await request.formData();
    const payload: TwilioStatusPayload = {
      CallSid: formData.get("CallSid") as string,
      AccountSid: formData.get("AccountSid") as string,
      From: formData.get("From") as string,
      To: formData.get("To") as string,
      CallStatus: formData.get("CallStatus") as TwilioStatusPayload["CallStatus"],
      Direction: formData.get("Direction") as TwilioStatusPayload["Direction"],
      CallerName: formData.get("CallerName") as string || undefined,
      ForwardedFrom: formData.get("ForwardedFrom") as string || undefined,
      CallDuration: formData.get("CallDuration") as string || undefined,
    };

    console.log(`[Twilio Status] ${payload.CallStatus} - CallSid=${payload.CallSid} From=${payload.From} To=${payload.To}`);

    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      console.error("[Twilio Status] No DEFAULT_TENANT_ID configured");
      return NextResponse.json({ success: false });
    }

    // Extract phone numbers
    const callerPhone = payload.From;
    const destinationPhone = payload.To;
    const callDirection = payload.Direction === "inbound" ? "inbound" : "outbound";

    // Try to find the agent by destination number (for inbound) or caller (for outbound)
    let agent = null;
    const phoneToMatch = callDirection === "inbound" ? destinationPhone : callerPhone;
    const digits = normalizePhone(phoneToMatch);

    // Try matching by phone number to extension mapping
    // In 3CX forwarding, the "To" number might be the agent's forwarded number
    // Try to find agent by matching their phone or extension
    const [matchedAgent] = await db
      .select({ id: users.id, extension: users.extension })
      .from(users)
      .where(
        and(
          eq(users.tenantId, tenantId),
          or(
            eq(users.extension, digits.slice(-3)), // Last 3 digits as extension
            ilike(users.phone, `%${digits}`)
          )
        )
      )
      .limit(1);

    agent = matchedAgent;

    // Handle based on call status
    switch (payload.CallStatus) {
      case "ringing":
      case "in-progress":
      case "answered": {
        // Check if call already exists
        const [existingCall] = await db
          .select({ id: calls.id, status: calls.status })
          .from(calls)
          .where(eq(calls.externalCallId, payload.CallSid))
          .limit(1);

        if (existingCall) {
          // Update status if needed
          if (existingCall.status !== "in_progress" && payload.CallStatus === "in-progress") {
            await db
              .update(calls)
              .set({
                status: "in_progress",
                answeredAt: new Date(),
                updatedAt: new Date(),
              })
              .where(eq(calls.id, existingCall.id));
            console.log(`[Twilio Status] Updated call ${existingCall.id} to in_progress`);
          }
          return NextResponse.json({ success: true, existing: true });
        }

        // Create new call record
        const customer = await findCustomerByPhone(callerPhone, tenantId);

        const [newCall] = await db
          .insert(calls)
          .values({
            tenantId,
            externalCallId: payload.CallSid,
            fromNumber: callerPhone,
            toNumber: destinationPhone,
            externalNumber: callDirection === "inbound" ? callerPhone : destinationPhone,
            direction: callDirection,
            status: payload.CallStatus === "ringing" ? "ringing" : "in_progress",
            agentId: agent?.id || null,
            customerId: customer?.id || null,
            startedAt: new Date(),
            answeredAt: payload.CallStatus !== "ringing" ? new Date() : undefined,
            transcriptionStatus: null, // No live transcription for Twilio-routed calls
            disposition: null, // Will be determined later (might be after_hours)
          })
          .returning();

        console.log(`[Twilio Status] Created call ${newCall.id} for Twilio CallSid=${payload.CallSid}`);

        // Broadcast to trigger screen pop
        await notifyRealtimeServer({
          type: payload.CallStatus === "ringing" ? "call_ringing" : "call_started",
          callId: newCall.id,
          sessionId: newCall.id,
          externalCallId: payload.CallSid,
          extension: agent?.extension,
          direction: callDirection,
          fromNumber: callerPhone,
          toNumber: destinationPhone,
          phoneNumber: callDirection === "inbound" ? callerPhone : destinationPhone,
          customerId: customer?.id,
          customerName: customer ? `${customer.firstName} ${customer.lastName}`.trim() : null,
          source: "twilio_webhook",
        });

        return NextResponse.json({
          success: true,
          callId: newCall.id,
          created: true,
        });
      }

      case "completed":
      case "busy":
      case "no-answer":
      case "canceled":
      case "failed": {
        // Find and update the call
        const [existingCall] = await db
          .select({ id: calls.id })
          .from(calls)
          .where(eq(calls.externalCallId, payload.CallSid))
          .limit(1);

        if (existingCall) {
          // Map Twilio status to our call status enum
          // valid values: 'ringing', 'in_progress', 'completed', 'missed', 'voicemail', 'transferred'
          const status = payload.CallStatus === "completed" ? "completed" : "missed";

          await db
            .update(calls)
            .set({
              status,
              endedAt: new Date(),
              durationSeconds: payload.CallDuration ? parseInt(payload.CallDuration, 10) : undefined,
              updatedAt: new Date(),
            })
            .where(eq(calls.id, existingCall.id));

          console.log(`[Twilio Status] Updated call ${existingCall.id} to ${status}`);

          // Broadcast call ended
          await notifyRealtimeServer({
            type: "call_ended",
            callId: existingCall.id,
            sessionId: existingCall.id,
            externalCallId: payload.CallSid,
            status,
            duration: payload.CallDuration ? parseInt(payload.CallDuration, 10) : 0,
          });
        } else {
          console.log(`[Twilio Status] No call found for completed CallSid=${payload.CallSid}`);
        }

        return NextResponse.json({ success: true });
      }

      default:
        console.log(`[Twilio Status] Ignoring status: ${payload.CallStatus}`);
        return NextResponse.json({ success: true });
    }
  } catch (error) {
    console.error("[Twilio Status] Error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Webhook error" },
      { status: 500 }
    );
  }
}

// =============================================================================
// GET Handler - Health check
// =============================================================================

export async function GET() {
  return NextResponse.json({
    status: "ok",
    endpoint: "/api/twilio/voice-status",
    description: "Twilio voice status webhook for screen pop triggers",
    configureAs: "statusCallback URL in Twilio voice routing",
  });
}
