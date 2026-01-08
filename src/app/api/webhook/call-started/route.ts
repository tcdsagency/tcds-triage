// API Route: /api/webhook/call-started
// VoIPTools webhook endpoint for incoming/outgoing call initiation
//
// Flow:
// 1. VoIPTools (3CX) sends call data when call starts
// 2. Create call session in database with phone number
// 3. Look up customer by phone number
// 4. Find agent by extension
// 5. Return session ID for tracking

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { calls, customers, users } from "@/db/schema";
import { eq, or, ilike, and } from "drizzle-orm";
import { getVMBridgeClient } from "@/lib/api/vm-bridge";

// =============================================================================
// AUTHENTICATION
// =============================================================================

function verifyWebhookAuth(_request: NextRequest): boolean {
  // TEMPORARY: Allow all requests for testing
  // TODO: Re-enable auth after VoIPTools is configured
  console.log("[Call-Started] Auth check - allowing request for testing");
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
// VOIPTOOLS PAYLOAD
// =============================================================================

interface VoIPToolsCallStartedPayload {
  // Call identifiers
  callId: string;
  sessionId?: string;

  // Phone numbers (may be SIP URIs)
  callerPhone?: string;
  callerNumber?: string;
  calledNumber?: string;
  fromNumber?: string;
  toNumber?: string;

  // Direction
  direction: string;

  // Agent/Extension
  extension?: string;
  agentExtension?: string;
  agentName?: string;

  // Timestamps
  timestamp?: string;
  callStartTime?: string;
  startTime?: string;

  // Additional fields
  queueId?: string;
  queueName?: string;
  status?: string;
}

// =============================================================================
// MAIN WEBHOOK HANDLER
// =============================================================================

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Verify authentication
    if (!verifyWebhookAuth(request)) {
      console.warn("[Call-Started] Unauthorized request");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: VoIPToolsCallStartedPayload = await request.json();
    console.log("[Call-Started] Received:", JSON.stringify(body, null, 2));

    const tenantId = process.env.DEFAULT_TENANT_ID || "00000000-0000-0000-0000-000000000001";

    // Normalize field names
    const rawTimestamp = body.timestamp || body.callStartTime || body.startTime;
    const timestamp = new Date(rawTimestamp || Date.now());
    const direction = body.direction?.toLowerCase() === "outbound" ? "outbound" : "inbound";

    // Extract phone numbers from SIP URIs if needed
    const callerNumber = extractPhoneFromSIP(body.callerPhone || body.callerNumber || body.fromNumber);
    const calledNumber = extractPhoneFromSIP(body.calledNumber || body.toNumber);
    const extension = (body.extension || body.agentExtension || "").replace(/\D/g, "");

    console.log("[Call-Started] Normalized - direction:", direction, "caller:", callerNumber, "called:", calledNumber, "ext:", extension);

    // Determine customer phone based on direction
    const customerPhone = direction === "inbound" ? callerNumber : calledNumber;
    const customerPhoneDigits = customerPhone.replace(/\D/g, "");

    // 1. Look up customer by phone number
    let customer: { id: string; firstName: string; lastName: string } | undefined;
    if (customerPhoneDigits.length >= 10) {
      const last10 = customerPhoneDigits.slice(-10);
      const [found] = await db
        .select({ id: customers.id, firstName: customers.firstName, lastName: customers.lastName })
        .from(customers)
        .where(
          and(
            eq(customers.tenantId, tenantId),
            or(
              ilike(customers.phone, `%${last10}`),
              ilike(customers.phoneAlt, `%${last10}`)
            )
          )
        )
        .limit(1);
      customer = found;

      if (customer) {
        console.log(`[Call-Started] Found customer: ${customer.firstName} ${customer.lastName} (${customer.id})`);
      }
    }

    // 2. Find agent by extension
    let agent: { id: string; firstName: string; lastName: string } | undefined;
    if (extension) {
      const [found] = await db
        .select({ id: users.id, firstName: users.firstName, lastName: users.lastName })
        .from(users)
        .where(and(eq(users.tenantId, tenantId), eq(users.extension, extension)))
        .limit(1);
      agent = found;

      if (agent) {
        console.log(`[Call-Started] Found agent: ${agent.firstName} ${agent.lastName} (${agent.id})`);
      }
    }

    // 3. Create call record in database
    const [call] = await db
      .insert(calls)
      .values({
        tenantId,
        externalCallId: body.callId || body.sessionId,
        direction: direction as "inbound" | "outbound",
        directionLive: direction as "inbound" | "outbound",
        status: "ringing",
        fromNumber: normalizePhone(callerNumber),
        toNumber: normalizePhone(calledNumber || extension),
        customerId: customer?.id,
        agentId: agent?.id,
        startedAt: timestamp,
      })
      .returning();

    console.log(`[Call-Started] Created call session: ${call.id}`);

    // 4. Trigger VM Bridge to start transcription
    let transcriptionStarted = false;
    let transcriptionError: string | null = null;
    try {
      const vmBridge = await getVMBridgeClient();
      if (vmBridge) {
        console.log(`[Call-Started] Triggering VM Bridge for session ${call.id}, extension ${extension}`);
        const result = await vmBridge.startTranscription(call.id, extension);
        transcriptionStarted = !!result;
        console.log(`[Call-Started] VM Bridge response:`, result);
      } else {
        console.log(`[Call-Started] VM Bridge not configured`);
      }
    } catch (err) {
      transcriptionError = err instanceof Error ? err.message : String(err);
      console.error(`[Call-Started] VM Bridge error:`, transcriptionError);
    }

    const processingTime = Date.now() - startTime;
    console.log(`[Call-Started] Processed in ${processingTime}ms`);

    // Return comprehensive response for debugging
    return NextResponse.json({
      success: true,
      sessionId: call.id,
      externalCallId: body.callId || body.sessionId,
      direction,
      phoneNumber: customerPhone,
      normalizedPhone: normalizePhone(customerPhone),
      extension,
      customerId: customer?.id || null,
      customerName: customer ? `${customer.firstName} ${customer.lastName}` : null,
      agentId: agent?.id || null,
      agentName: agent ? `${agent.firstName} ${agent.lastName}` : null,
      status: "ringing",
      startTime: timestamp.toISOString(),
      transcriptionStarted,
      transcriptionError,
      processingTimeMs: processingTime,
    });
  } catch (error) {
    console.error("[Call-Started] Error:", error);
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
    message: "VoIPTools call-started webhook is ready",
    endpoint: "/api/webhook/call-started",
    description: "Creates call session when call starts from VoIPTools (3CX)",
    flow: [
      "1. Receive call data from VoIPTools",
      "2. Parse SIP URIs to extract phone numbers",
      "3. Look up customer by phone number",
      "4. Find agent by extension",
      "5. Create call session in database",
      "6. Return session ID with customer/agent info",
    ],
    webhook_url: "https://tcds-triage.vercel.app/api/webhook/call-started",
    authentication: "Currently disabled for testing",
    example_payload: {
      callId: "CAee09eecf5928957c2c607c9dc4fd5182",
      callerPhone: "sip:12055551234@domain.pstn.twilio.com",
      calledNumber: "+12055559876",
      direction: "inbound",
      extension: "102",
      callStartTime: "2024-01-15T10:30:00Z",
    },
  });
}
