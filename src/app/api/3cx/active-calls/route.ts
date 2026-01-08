// API Route: /api/3cx/active-calls
// Poll 3CX/VoIPTools for active calls to trigger call popup

import { NextRequest, NextResponse } from "next/server";
import { getThreeCXClient } from "@/lib/api/threecx";
import { getVoIPToolsRelayClient } from "@/lib/api/voiptools-relay";
import { db } from "@/db";
import { users, customers, calls } from "@/db/schema";
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

    // Find agent by extension
    let agentId: string | undefined;
    try {
      const [agent] = await db
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.tenantId, tenantId), eq(users.extension, extension)))
        .limit(1);
      agentId = agent?.id;
    } catch (e) {
      console.error("[Active Calls] Agent lookup error:", e);
    }

    // Check VoIPTools presence first to know if agent is actually on a call
    let isOnCallPerVoIP = false;
    let voipError: string | null = null;
    const voiptools = await getVoIPToolsRelayClient();

    if (voiptools) {
      try {
        const presence = await voiptools.getPresence(extension);
        const statusText = presence?.StatusText?.toLowerCase() || "";
        // Check for "isincall: true" (case insensitive - VoIPTools returns "IsInCall: True")
        isOnCallPerVoIP = statusText.includes("isincall: true") ||
                         statusText.includes("isincall:true") ||
                         statusText.includes("talking") ||
                         statusText.includes("ringing");
        console.log(`[Active Calls] VoIPTools presence: ${statusText}, isOnCall: ${isOnCallPerVoIP}`);
      } catch (err) {
        voipError = err instanceof Error ? err.message : String(err);
        console.error("[Active Calls] VoIPTools error:", voipError);
        // Continue - we can still check DB
      }
    }

    // Check database for active calls (created by webhook)
    if (agentId) {
      try {
        const [activeCall] = await db
          .select({
            id: calls.id,
            externalCallId: calls.externalCallId,
            direction: calls.directionLive,
            status: calls.status,
            fromNumber: calls.fromNumber,
            toNumber: calls.toNumber,
            customerId: calls.customerId,
            startedAt: calls.startedAt,
            customerFirstName: customers.firstName,
            customerLastName: customers.lastName,
          })
          .from(calls)
          .leftJoin(customers, eq(calls.customerId, customers.id))
          .where(
            and(
              eq(calls.tenantId, tenantId),
              eq(calls.agentId, agentId),
              or(
                eq(calls.status, "ringing"),
                eq(calls.status, "in_progress")
              )
            )
          )
          .limit(1);

        if (activeCall) {
          // Cross-check with VoIPTools: if presence says NOT on call, mark as completed
          if (voiptools && !isOnCallPerVoIP) {
            console.log(`[Active Calls] DB has active call but VoIPTools says not on call - marking completed`);
            await db
              .update(calls)
              .set({
                status: "completed",
                endedAt: new Date(),
              })
              .where(eq(calls.id, activeCall.id));

            return NextResponse.json({
              success: true,
              hasActiveCall: false,
              calls: [],
              source: "database+voiptools",
              message: "Call ended (verified by VoIPTools presence)",
            });
          }

          // Active call confirmed - return with full info
          const phoneNumber = activeCall.direction === "inbound"
            ? activeCall.fromNumber
            : activeCall.toNumber;
          const customerName = activeCall.customerFirstName && activeCall.customerLastName
            ? `${activeCall.customerFirstName} ${activeCall.customerLastName}`
            : null;

          console.log(`[Active Calls] Found active call in DB: ${activeCall.id} - ${phoneNumber}`);

          return NextResponse.json({
            success: true,
            hasActiveCall: true,
            calls: [{
              sessionId: activeCall.id,
              callId: activeCall.externalCallId,
              direction: activeCall.direction?.toLowerCase() as "inbound" | "outbound",
              phoneNumber: phoneNumber || "Unknown",
              extension,
              status: activeCall.status,
              startTime: activeCall.startedAt?.toISOString(),
              customerId: activeCall.customerId,
              customerName,
            }],
            source: "database",
          });
        }
      } catch (dbError) {
        console.error("[Active Calls] Database check error:", dbError);
      }
    }

    // No call in database - if VoIPTools says on call, return generic active call
    if (isOnCallPerVoIP) {
      // Agent is on a call per VoIPTools but no DB record yet
      // This happens when webhooks aren't configured - use presence as fallback
      return NextResponse.json({
        success: true,
        hasActiveCall: true,
        calls: [{
          sessionId: `voip_${extension}_active`,
          direction: "inbound",
          phoneNumber: "Active Call",
          extension,
          status: "in_progress",
          startTime: new Date().toISOString(),
        }],
        source: "voiptools",
        message: "Active call detected via presence (webhook not configured)",
      });
    }

    // VoIPTools says not on call
    if (voiptools && !voipError) {
      return NextResponse.json({
        success: true,
        hasActiveCall: false,
        calls: [],
        source: "voiptools",
      });
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
