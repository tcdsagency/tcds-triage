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

// =============================================================================
// REALTIME SERVER PUSH
// =============================================================================

async function notifyRealtimeServer(event: {
  type: string;
  sessionId: string;
  phoneNumber?: string;
  direction?: string;
  customerId?: string;
  customerName?: string;
  extension?: string;
  status?: string;
}) {
  const realtimeUrl = process.env.REALTIME_SERVER_URL || "https://realtime.tcdsagency.com";

  try {
    console.log(`[Call-Started] Broadcasting to realtime server: ${event.type}`);
    const response = await fetch(`${realtimeUrl}/api/broadcast`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": process.env.REALTIME_API_KEY || "",
      },
      body: JSON.stringify(event),
    });

    if (!response.ok) {
      console.error(`[Call-Started] Realtime server returned ${response.status}`);
    } else {
      console.log(`[Call-Started] Broadcasted ${event.type} to realtime server successfully`);
    }
  } catch (error) {
    console.error("[Call-Started] Failed to notify realtime server:", error);
  }
}

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

/**
 * Find agent by extension using multiple matching strategies
 * 1. Exact match on extension digits
 * 2. Match by last 3 digits (common extension format)
 * 3. Match if extension field contains a known user extension
 */
async function findAgentByExtension(
  tenantId: string,
  extensionRaw: string
): Promise<{ id: string; firstName: string; lastName: string; avatarUrl: string | null; extension: string | null } | undefined> {
  if (!extensionRaw) return undefined;

  const extDigits = extensionRaw.replace(/\D/g, "");
  if (!extDigits) return undefined;

  // Strategy 1: Exact match
  const [exactMatch] = await db
    .select({
      id: users.id,
      firstName: users.firstName,
      lastName: users.lastName,
      avatarUrl: users.avatarUrl,
      extension: users.extension,
    })
    .from(users)
    .where(and(eq(users.tenantId, tenantId), eq(users.extension, extDigits)))
    .limit(1);

  if (exactMatch) return exactMatch;

  // Strategy 2: Match by last 3 digits (typical extension length)
  if (extDigits.length > 3) {
    const last3 = extDigits.slice(-3);
    const [last3Match] = await db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        avatarUrl: users.avatarUrl,
        extension: users.extension,
      })
      .from(users)
      .where(and(eq(users.tenantId, tenantId), eq(users.extension, last3)))
      .limit(1);

    if (last3Match) return last3Match;
  }

  // Strategy 3: Check if any known extension is at the end of the digits
  // This handles cases like "+12051234102" where 102 is the extension
  const allUsers = await db
    .select({
      id: users.id,
      firstName: users.firstName,
      lastName: users.lastName,
      avatarUrl: users.avatarUrl,
      extension: users.extension,
    })
    .from(users)
    .where(and(eq(users.tenantId, tenantId), ilike(users.extension, "%")));

  for (const user of allUsers) {
    if (user.extension && extDigits.endsWith(user.extension)) {
      return user;
    }
  }

  return undefined;
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
    const rawCallerNumber = extractPhoneFromSIP(body.callerPhone || body.callerNumber || body.fromNumber);
    const rawCalledNumber = extractPhoneFromSIP(body.calledNumber || body.toNumber);
    const extension = (body.extension || body.agentExtension || "").replace(/\D/g, "");

    // Detect if caller/called are swapped based on extension match
    // For outbound: if caller looks like external number and called is extension, swap them
    // For inbound: if called looks like external number and caller is extension, swap them
    let callerNumber = rawCallerNumber;
    let calledNumber = rawCalledNumber;

    const callerIsExtension = rawCallerNumber.replace(/\D/g, "") === extension;
    const calledIsExtension = rawCalledNumber.replace(/\D/g, "") === extension;
    const callerIsExternal = rawCallerNumber.length >= 10 || rawCallerNumber.startsWith("+");
    const calledIsExternal = rawCalledNumber.length >= 10 || rawCalledNumber.startsWith("+");

    // Swap if data appears reversed
    if (direction === "outbound" && callerIsExternal && calledIsExtension) {
      console.log("[Call-Started] Detected swapped caller/called for outbound, correcting...");
      callerNumber = rawCalledNumber; // Extension becomes caller
      calledNumber = rawCallerNumber; // External becomes called
    } else if (direction === "inbound" && calledIsExternal && callerIsExtension) {
      console.log("[Call-Started] Detected swapped caller/called for inbound, correcting...");
      callerNumber = rawCalledNumber; // External becomes caller
      calledNumber = rawCallerNumber; // Extension becomes called
    }

    console.log("[Call-Started] Normalized - direction:", direction, "caller:", callerNumber, "called:", calledNumber, "ext:", extension);

    // Determine customer phone based on direction
    // For inbound: customer is the caller (external number calling in)
    // For outbound: customer is the called party (agent calling out)
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
        extension: extension || null, // Store extension for call correlation
        direction: direction as "inbound" | "outbound",
        directionLive: direction as "inbound" | "outbound",
        status: "ringing",
        fromNumber: normalizePhone(callerNumber),
        toNumber: normalizePhone(calledNumber || extension),
        customerId: customer?.id,
        agentId: agent?.id,
        startedAt: timestamp,
        transcriptionStatus: "pending", // Will be updated when call is answered
      })
      .returning();

    console.log(`[Call-Started] Created call session: ${call.id}`);

    // 4. Push to realtime server to notify browser (CallProvider)
    await notifyRealtimeServer({
      type: "call_started",
      sessionId: call.id,
      phoneNumber: customerPhone,
      direction,
      customerId: customer?.id,
      customerName: customer ? `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || undefined : undefined,
      extension,
      status: "ringing",
    });

    // NOTE: Transcription is started in call-answered webhook (when call is actually connected)
    // Starting here caused duplicate transcription attempts and race conditions
    const transcriptionStarted = false;
    const transcriptionError: string | null = null;

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
      customerName: customer ? `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || null : null,
      agentId: agent?.id || null,
      agentName: agent ? `${agent.firstName || ''} ${agent.lastName || ''}`.trim() || null : null,
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
