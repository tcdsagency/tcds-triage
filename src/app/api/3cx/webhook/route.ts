// API Route: /api/3cx/webhook
// Webhook endpoint to receive call events from 3CX/VoIPTools
// This is the critical link that connects 3CX to:
// 1. Call popup (via real-time server)
// 2. VM Bridge transcription
// 3. Call database records

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { calls, customers, users, pendingVmEvents } from "@/db/schema";
import { eq, or, ilike, sql, and, gte, desc } from "drizzle-orm";
import { VMBridgeClient, getVMBridgeClient } from "@/lib/api/vm-bridge";

// Verify webhook authentication
function verifyWebhookAuth(request: NextRequest): boolean {
  const webhookKey = process.env.WEBHOOK_API_KEY || process.env.THREECX_WEBHOOK_KEY;

  if (!webhookKey) {
    console.warn("[3CX Webhook] No webhook key configured - allowing all requests");
    return true;
  }

  // Check X-Api-Key header
  const xApiKey = request.headers.get("X-Api-Key");
  if (xApiKey === webhookKey) return true;

  // Check Authorization: Bearer header
  const authHeader = request.headers.get("Authorization");
  if (authHeader) {
    const [type, token] = authHeader.split(" ");
    if (type === "Bearer" && token === webhookKey) return true;
  }

  // Check query param (for simple integrations)
  const { searchParams } = new URL(request.url);
  if (searchParams.get("key") === webhookKey) return true;

  return false;
}

// Normalize phone number to E.164-ish format
function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return phone;
}

// Find customer by phone number
async function findCustomerByPhone(phone: string, tenantId: string) {
  const normalized = normalizePhone(phone);
  const digits = phone.replace(/\D/g, "");

  const [customer] = await db
    .select({ id: customers.id, firstName: customers.firstName, lastName: customers.lastName })
    .from(customers)
    .where(
      and(
        eq(customers.tenantId, tenantId),
        or(
          ilike(customers.phone, `%${digits.slice(-10)}`),
          ilike(customers.phoneAlt, `%${digits.slice(-10)}`),
          eq(customers.phone, normalized),
          eq(customers.phoneAlt, normalized)
        )
      )
    )
    .limit(1);

  return customer || null;
}

// Find agent by extension
async function findAgentByExtension(extension: string, tenantId: string) {
  const [agent] = await db
    .select({ id: users.id, firstName: users.firstName, lastName: users.lastName })
    .from(users)
    .where(
      and(
        eq(users.tenantId, tenantId),
        eq(users.extension, extension)
      )
    )
    .limit(1);

  return agent || null;
}

// Predict call reason based on customer data
async function predictCallReason(customerId: string | undefined, tenantId: string): Promise<string | null> {
  if (!customerId) return null;

  const predictions: string[] = [];

  try {
    // Check for upcoming renewals (next 30 days)
    // Note: This queries policies_cache if it exists
    const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const now = new Date();

    const renewals = await db.execute(sql`
      SELECT policy_number, line_of_business, expiration_date
      FROM policies_cache
      WHERE customer_id = ${customerId}
        AND expiration_date >= ${now}
        AND expiration_date <= ${thirtyDaysFromNow}
      LIMIT 1
    `).catch(() => [] as any[]);

    const renewalRows = Array.isArray(renewals) ? renewals : [];
    if (renewalRows.length > 0) {
      const renewal = renewalRows[0] as any;
      const days = Math.ceil((new Date(renewal.expiration_date).getTime() - Date.now()) / (24 * 60 * 60 * 1000));
      predictions.push(`${renewal.line_of_business || 'Policy'} renewal in ${days} days`);
    }

    // Check for open claims
    const claims = await db.execute(sql`
      SELECT id, claim_number
      FROM claims_cache
      WHERE customer_id = ${customerId}
        AND status = 'open'
      LIMIT 1
    `).catch(() => [] as any[]);

    const claimRows = Array.isArray(claims) ? claims : [];
    if (claimRows.length > 0) {
      predictions.push('Open claim follow-up');
    }

    // Check for recent calls from this customer (repeat caller)
    const recentCalls = await db
      .select({ id: calls.id })
      .from(calls)
      .where(and(
        eq(calls.customerId, customerId),
        gte(calls.startedAt, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
      ))
      .limit(3);

    if (recentCalls.length >= 2) {
      predictions.push('Repeat caller this week');
    }

  } catch (error) {
    console.error('[3CX Webhook] Error predicting call reason:', error);
  }

  return predictions.length > 0 ? predictions[0] : null;
}

// Check for pending VM Bridge events (race condition handling)
async function checkPendingVmEvents(externalCallId: string, callId: string): Promise<void> {
  try {
    const [pendingEvent] = await db
      .select()
      .from(pendingVmEvents)
      .where(eq(pendingVmEvents.threecxCallId, externalCallId))
      .limit(1);

    if (pendingEvent) {
      console.log(`[3CX Webhook] Found pending VM event for call ${callId}, linking session ${pendingEvent.sessionId}`);

      // Update call with VM session info
      await db
        .update(calls)
        .set({
          vmSessionId: pendingEvent.sessionId,
          externalNumber: pendingEvent.externalNumber,
          updatedAt: new Date(),
        })
        .where(eq(calls.id, callId));

      // Delete pending event
      await db
        .delete(pendingVmEvents)
        .where(eq(pendingVmEvents.id, pendingEvent.id));

      console.log(`[3CX Webhook] Linked VM session and cleaned up pending event`);
    }
  } catch (error) {
    console.error('[3CX Webhook] Error checking pending VM events:', error);
  }
}

// Notify real-time server to broadcast event to CallProvider
async function notifyRealtimeServer(event: {
  type: string;
  sessionId: string;
  phoneNumber?: string;
  direction?: string;
  customerId?: string;
  customerName?: string;
  extension?: string;
  status?: string;
  predictedReason?: string | null;
}) {
  const realtimeUrl = process.env.REALTIME_SERVER_URL;
  if (!realtimeUrl) return; // Skip if no realtime server configured

  try {
    // POST to real-time server's HTTP API to broadcast via WebSocket
    const response = await fetch(`${realtimeUrl}/api/broadcast`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": process.env.REALTIME_API_KEY || "",
      },
      body: JSON.stringify(event),
    });

    if (!response.ok) {
      console.error(`[3CX Webhook] Real-time server returned ${response.status}`);
    } else {
      console.log(`[3CX Webhook] Broadcasted ${event.type} to real-time server`);
    }
  } catch (error) {
    console.error("[3CX Webhook] Failed to notify real-time server:", error);
  }
}

// Start VM Bridge transcription
async function startTranscription(callId: string, extension: string) {
  console.log(`[3CX Webhook] ========== TRANSCRIPTION START REQUEST ==========`);
  console.log(`[3CX Webhook] Call ID: ${callId}`);
  console.log(`[3CX Webhook] Extension: ${extension}`);

  if (!extension) {
    console.error("[3CX Webhook] Cannot start transcription: No extension provided!");
    return null;
  }

  try {
    const vmBridge = await getVMBridgeClient();
    if (!vmBridge) {
      console.warn("[3CX Webhook] VM Bridge not configured - check VMBRIDGE_URL and DEEPGRAM_API_KEY env vars");
      console.warn("[3CX Webhook] VMBRIDGE_URL:", process.env.VMBRIDGE_URL ? "SET" : "NOT SET");
      console.warn("[3CX Webhook] DEEPGRAM_API_KEY:", process.env.DEEPGRAM_API_KEY ? "SET" : "NOT SET");
      return null;
    }

    console.log(`[3CX Webhook] VM Bridge client obtained, bridge URL: ${vmBridge.getBridgeUrl()}`);
    console.log(`[3CX Webhook] Starting transcription for call ${callId}, extension ${extension}`);

    const session = await vmBridge.startTranscription(callId, extension);

    if (session) {
      console.log(`[3CX Webhook] Transcription started successfully:`, JSON.stringify(session, null, 2));
    } else {
      console.warn(`[3CX Webhook] Transcription start returned null - check VM Bridge logs`);
    }

    console.log(`[3CX Webhook] ========== TRANSCRIPTION START COMPLETE ==========`);
    return session;
  } catch (error) {
    console.error("[3CX Webhook] Failed to start transcription:", error);
    console.error("[3CX Webhook] Error details:", error instanceof Error ? error.message : String(error));
    return null;
  }
}

// Stop VM Bridge transcription
async function stopTranscription(sessionId: string) {
  try {
    const vmBridge = await getVMBridgeClient();
    if (!vmBridge) return;

    await vmBridge.stopTranscription(sessionId);
    console.log(`[3CX Webhook] Stopped transcription for session ${sessionId}`);
  } catch (error) {
    console.error("[3CX Webhook] Failed to stop transcription:", error);
  }
}

// 3CX event types
interface ThreeCXCallEvent {
  // Event type from 3CX
  event?: string;
  Event?: string;
  type?: string;

  // Call identifiers
  callId?: string;
  CallId?: string;
  sessionId?: string;
  SessionId?: string;
  id?: string;

  // Direction
  direction?: "inbound" | "outbound" | "Inbound" | "Outbound";
  Direction?: "inbound" | "outbound" | "Inbound" | "Outbound";

  // Participants
  from?: string;
  From?: string;
  caller?: string;
  Caller?: string;
  callerNumber?: string;
  CallerNumber?: string;

  to?: string;
  To?: string;
  callee?: string;
  Callee?: string;
  dialedNumber?: string;
  DialedNumber?: string;

  // Extension
  extension?: string;
  Extension?: string;
  ext?: string;
  Ext?: string;

  // Status
  status?: string;
  Status?: string;
  state?: string;
  State?: string;

  // Timestamps
  timestamp?: string;
  Timestamp?: string;
  startTime?: string;
  StartTime?: string;
  endTime?: string;
  EndTime?: string;
  duration?: number;
  Duration?: number;
}

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    if (!verifyWebhookAuth(request)) {
      console.warn("[3CX Webhook] Unauthorized request");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: ThreeCXCallEvent = await request.json();
    console.log("[3CX Webhook] Received event:", JSON.stringify(body, null, 2));

    const tenantId = process.env.DEFAULT_TENANT_ID || "00000000-0000-0000-0000-000000000001";

    // Normalize event fields (3CX uses various naming conventions)
    const eventType = (body.event || body.Event || body.type || "").toLowerCase();
    const callId = body.callId || body.CallId || body.sessionId || body.SessionId || body.id || `call_${Date.now()}`;
    const direction = (body.direction || body.Direction || "inbound").toLowerCase() as "inbound" | "outbound";
    const extension = body.extension || body.Extension || body.ext || body.Ext || "";

    // Determine phone numbers based on direction
    let fromNumber: string;
    let toNumber: string;
    let customerPhone: string;

    if (direction === "inbound") {
      fromNumber = body.from || body.From || body.caller || body.Caller || body.callerNumber || body.CallerNumber || "";
      toNumber = body.to || body.To || body.callee || body.Callee || body.dialedNumber || body.DialedNumber || extension;
      customerPhone = fromNumber;
    } else {
      fromNumber = extension || body.from || body.From || "";
      toNumber = body.to || body.To || body.callee || body.Callee || body.dialedNumber || body.DialedNumber || "";
      customerPhone = toNumber;
    }

    // Handle different event types
    switch (eventType) {
      case "call_start":
      case "callstart":
      case "call_ringing":
      case "ringing":
      case "incoming":
      case "outgoing": {
        // Look up customer and agent
        const customer = customerPhone ? await findCustomerByPhone(customerPhone, tenantId) : null;
        const agent = extension ? await findAgentByExtension(extension, tenantId) : null;

        // Predict call reason based on customer data
        const predictedReason = await predictCallReason(customer?.id, tenantId);

        // Create call record (simple insert - no upsert since no unique constraint)
        const [call] = await db
          .insert(calls)
          .values({
            tenantId,
            externalCallId: callId,
            direction,
            directionLive: direction,
            status: "ringing",
            fromNumber: normalizePhone(fromNumber),
            toNumber: normalizePhone(toNumber),
            externalNumber: customerPhone ? normalizePhone(customerPhone) : null,
            customerId: customer?.id,
            agentId: agent?.id,
            extension,
            predictedReason,
            startedAt: new Date(),
          })
          .returning();

        // Check for pending VM Bridge events (race condition handling)
        await checkPendingVmEvents(callId, call.id);

        console.log(`[3CX Webhook] Created call record: ${call.id}`);

        // Notify real-time server for call popup
        await notifyRealtimeServer({
          type: "call_ringing",
          sessionId: call.id,
          phoneNumber: customerPhone,
          direction,
          customerId: customer?.id,
          customerName: customer ? `${customer.firstName} ${customer.lastName}`.trim() : undefined,
          extension,
          predictedReason,
        });

        // Note: Transcription is started on call_answered, not call_ringing
        // VoIPTools Listen2 requires the call to be active first

        return NextResponse.json({
          success: true,
          callId: call.id,
          event: "call_ringing",
          customer: customer ? { id: customer.id, name: `${customer.firstName} ${customer.lastName}` } : null,
          predictedReason,
        });
      }

      case "call_answered":
      case "answered":
      case "connected":
      case "talking": {
        console.log(`[3CX Webhook] ========== CALL ANSWERED EVENT ==========`);
        console.log(`[3CX Webhook] Event type: ${eventType}`);
        console.log(`[3CX Webhook] External Call ID: ${callId}`);
        console.log(`[3CX Webhook] Extension from event: ${extension || "NOT PROVIDED"}`);

        // Update call status - use 'in_progress' (matches DB enum)
        const [call] = await db
          .update(calls)
          .set({
            status: "in_progress",
            answeredAt: new Date(),
          })
          .where(eq(calls.externalCallId, callId))
          .returning();

        if (!call) {
          console.error(`[3CX Webhook] No call found with externalCallId: ${callId}`);
          return NextResponse.json({
            success: false,
            error: `No call found with externalCallId: ${callId}`,
          }, { status: 404 });
        }

        console.log(`[3CX Webhook] Updated call record: ${call.id}`);
        console.log(`[3CX Webhook] Call agent ID: ${call.agentId || "NOT SET"}`);

        await notifyRealtimeServer({
          type: "call_started",
          sessionId: call.id,
          status: "connected", // UI uses 'connected' for display
          extension: extension,
        });

        // Start VM Bridge transcription now that call is answered
        // VoIPTools Listen2 requires an active call
        let agentExtension = extension;
        console.log(`[3CX Webhook] Initial agent extension: ${agentExtension || "NOT PROVIDED"}`);

        // If extension not in event, try to look it up from agent
        if (!agentExtension && call.agentId) {
          console.log(`[3CX Webhook] Looking up extension for agent ID: ${call.agentId}`);
          const [agent] = await db
            .select({ extension: users.extension, firstName: users.firstName, lastName: users.lastName })
            .from(users)
            .where(eq(users.id, call.agentId))
            .limit(1);

          if (agent) {
            agentExtension = agent.extension || "";
            console.log(`[3CX Webhook] Found agent: ${agent.firstName} ${agent.lastName}, extension: ${agentExtension}`);
          } else {
            console.warn(`[3CX Webhook] No agent found with ID: ${call.agentId}`);
          }
        }

        if (agentExtension) {
          console.log(`[3CX Webhook] Starting transcription for call ${call.id}, extension ${agentExtension}`);
          await startTranscription(call.id, agentExtension);
        } else {
          console.error(`[3CX Webhook] Cannot start transcription: No agent extension available`);
          console.error(`[3CX Webhook] Extension from event: ${extension || "NOT PROVIDED"}`);
          console.error(`[3CX Webhook] Call agent ID: ${call.agentId || "NOT SET"}`);
        }

        console.log(`[3CX Webhook] ========== CALL ANSWERED COMPLETE ==========`);

        return NextResponse.json({
          success: true,
          callId: call?.id,
          event: "call_answered",
          transcriptionStarted: !!agentExtension,
        });
      }

      case "call_end":
      case "callend":
      case "call_ended":
      case "ended":
      case "hangup":
      case "disconnected": {
        const duration = body.duration || body.Duration;

        // Update call status - use 'completed' (matches DB enum)
        const [call] = await db
          .update(calls)
          .set({
            status: "completed",
            endedAt: new Date(),
            durationSeconds: duration,
          })
          .where(eq(calls.externalCallId, callId))
          .returning();

        if (call) {
          // Notify real-time server
          await notifyRealtimeServer({
            type: "call_ended",
            sessionId: call.id,
          });

          // Stop transcription
          await stopTranscription(call.id);
        }

        return NextResponse.json({
          success: true,
          callId: call?.id,
          event: "call_ended",
        });
      }

      case "call_hold":
      case "hold": {
        // Note: 'on_hold' is not in enum, use 'in_progress' with note
        const [call] = await db
          .update(calls)
          .set({ status: "in_progress" }) // Keep as in_progress, UI shows hold state
          .where(eq(calls.externalCallId, callId))
          .returning();

        if (call) {
          await notifyRealtimeServer({
            type: "call_updated",
            sessionId: call.id,
            status: "on_hold", // UI uses this for display
          });
        }

        return NextResponse.json({ success: true, event: "call_hold" });
      }

      case "call_unhold":
      case "unhold":
      case "retrieve": {
        const [call] = await db
          .update(calls)
          .set({ status: "in_progress" })
          .where(eq(calls.externalCallId, callId))
          .returning();

        if (call) {
          await notifyRealtimeServer({
            type: "call_updated",
            sessionId: call.id,
            status: "connected", // UI uses this for display
          });
        }

        return NextResponse.json({ success: true, event: "call_unhold" });
      }

      default: {
        console.log(`[3CX Webhook] Unknown event type: ${eventType}`);
        return NextResponse.json({
          success: true,
          message: `Event type '${eventType}' acknowledged but not handled`,
        });
      }
    }
  } catch (error) {
    console.error("[3CX Webhook] Error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Webhook processing failed" },
      { status: 500 }
    );
  }
}

// GET - Test endpoint / health check
export async function GET(request: NextRequest) {
  return NextResponse.json({
    success: true,
    message: "3CX webhook endpoint is ready",
    endpoints: {
      webhook: "POST /api/3cx/webhook",
    },
    supportedEvents: [
      "call_start / call_ringing / incoming / outgoing",
      "call_answered / connected / talking",
      "call_end / call_ended / hangup / disconnected",
      "call_hold / hold",
      "call_unhold / retrieve",
    ],
    authentication: "X-Api-Key header, Authorization: Bearer, or ?key= query param",
    example: {
      event: "call_start",
      callId: "abc123",
      direction: "inbound",
      from: "+12055551234",
      to: "101",
      extension: "101",
    },
  });
}
