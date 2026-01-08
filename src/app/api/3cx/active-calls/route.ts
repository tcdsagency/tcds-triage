// API Route: /api/3cx/active-calls
// Poll 3CX/VoIPTools for active calls to trigger call popup

import { NextRequest, NextResponse } from "next/server";
import { getThreeCXClient } from "@/lib/api/threecx";
import { getVoIPToolsRelayClient } from "@/lib/api/voiptools-relay";
import { db } from "@/db";
import { users, customers } from "@/db/schema";
import { eq, and, or, ilike } from "drizzle-orm";

// Normalize phone number for lookup
function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "").slice(-10);
}

// Find customer by phone
async function findCustomerByPhone(phone: string, tenantId: string) {
  const digits = normalizePhone(phone);
  if (digits.length < 10) return null;

  const [customer] = await db
    .select({ id: customers.id, firstName: customers.firstName, lastName: customers.lastName })
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

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const extension = searchParams.get("extension");

    if (!extension) {
      return NextResponse.json({ success: false, error: "Extension required" }, { status: 400 });
    }

    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ success: false, error: "Tenant not configured" }, { status: 500 });
    }

    // Try VoIPTools first (preferred)
    let voipError: string | null = null;
    const voiptools = await getVoIPToolsRelayClient();
    if (voiptools) {
      try {
        // Check if agent is on a call by checking their presence status
        const presence = await voiptools.getPresence(extension);
        const statusText = presence?.StatusText?.toLowerCase() || "";
        const isOnCall = statusText.includes("isincall: true") ||
                         statusText.includes("talking") ||
                         statusText.includes("ringing");

        if (!isOnCall) {
          return NextResponse.json({
            success: true,
            hasActiveCall: false,
            calls: [],
            source: "voiptools",
          });
        }

        // Agent is on a call - return active call with presence info
        return NextResponse.json({
          success: true,
          hasActiveCall: true,
          calls: [{
            sessionId: `voip_active_${Date.now()}`,
            direction: "inbound",
            phoneNumber: "Unknown",
            extension,
            status: "in_progress",
            startTime: new Date().toISOString(),
          }],
          source: "voiptools",
          presenceStatus: statusText,
        });
      } catch (err) {
        voipError = err instanceof Error ? err.message : String(err);
        console.error("[Active Calls] VoIPTools error:", voipError);
        // Fall through to 3CX
      }
    }

    // Try 3CX Native API
    const threecx = await getThreeCXClient();
    if (threecx) {
      try {
        const activeCalls = await threecx.getActiveCalls();
        const myCalls = activeCalls.filter(call => call.Extension === extension);

        if (myCalls.length === 0) {
          return NextResponse.json({
            success: true,
            hasActiveCall: false,
            calls: [],
            source: "3cx",
          });
        }

        const enrichedCalls = await Promise.all(
          myCalls.map(async (call) => {
            const customerPhone = call.Direction === "inbound" ? call.From : call.To;
            const customer = await findCustomerByPhone(customerPhone, tenantId);

            return {
              sessionId: call.SessionId || call.CallId,
              callId: call.CallId,
              direction: call.Direction.toLowerCase() as "inbound" | "outbound",
              phoneNumber: customerPhone,
              extension: call.Extension,
              status: call.State?.toLowerCase() || "in_progress",
              startTime: call.StartTime,
              duration: call.Duration,
              customerId: customer?.id,
              customerName: customer ? `${customer.firstName} ${customer.lastName}`.trim() : null,
            };
          })
        );

        return NextResponse.json({
          success: true,
          hasActiveCall: enrichedCalls.length > 0,
          calls: enrichedCalls,
          source: "3cx",
        });
      } catch (threecxError) {
        console.error("[Active Calls] 3CX error:", threecxError);
      }
    }

    // Neither VoIPTools nor 3CX available
    return NextResponse.json({
      success: false,
      error: "No phone system configured",
      message: "Configure VoIPTools or 3CX API credentials",
      voiptoolsConfigured: !!voiptools,
      voiptoolsError: voipError,
    }, { status: 503 });
  } catch (error) {
    console.error("[Active Calls] Error:", error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to get active calls",
    }, { status: 500 });
  }
}
