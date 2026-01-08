// API Route: /api/3cx/active-calls
// Poll 3CX directly for active calls to trigger call popup

import { NextRequest, NextResponse } from "next/server";
import { getThreeCXClient } from "@/lib/api/threecx";
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

    // Get 3CX client
    const threecx = await getThreeCXClient();
    if (!threecx) {
      return NextResponse.json({
        success: false,
        error: "3CX not configured",
        message: "Set THREECX_BASE_URL, THREECX_CLIENT_ID, and THREECX_CLIENT_SECRET",
      }, { status: 503 });
    }

    // Get active calls from 3CX
    const activeCalls = await threecx.getActiveCalls();

    // Filter to calls for this extension
    const myCalls = activeCalls.filter(call => call.Extension === extension);

    if (myCalls.length === 0) {
      return NextResponse.json({
        success: true,
        hasActiveCall: false,
        calls: [],
      });
    }

    // Enrich with customer data
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
    });
  } catch (error) {
    console.error("[3CX Active Calls] Error:", error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to get active calls",
    }, { status: 500 });
  }
}
