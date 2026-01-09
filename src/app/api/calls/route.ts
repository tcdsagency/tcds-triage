// API Route: /api/calls
// Fetch call records from database

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { calls, customers, users } from "@/db/schema";
import { desc, eq, and, gte, lte, or, ilike } from "drizzle-orm";

export async function GET(request: NextRequest) {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const direction = searchParams.get("direction"); // inbound, outbound, all
    const status = searchParams.get("status"); // completed, missed, voicemail, all, or comma-separated like "ringing,in_progress"
    const agentId = searchParams.get("agentId");
    const extension = searchParams.get("extension"); // filter by agent extension
    const dateRange = searchParams.get("dateRange"); // today, yesterday, 7d, 30d
    const search = searchParams.get("search");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    // If filtering by extension, find the agent ID first
    let extensionAgentId: string | null = null;
    if (extension) {
      const [agent] = await db
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.tenantId, tenantId), eq(users.extension, extension)))
        .limit(1);
      extensionAgentId = agent?.id || null;
    }

    // Build date filter
    let startDate: Date | undefined;
    let endDate = new Date();

    switch (dateRange) {
      case "today":
        startDate = new Date();
        startDate.setHours(0, 0, 0, 0);
        break;
      case "yesterday":
        startDate = new Date();
        startDate.setDate(startDate.getDate() - 1);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date();
        endDate.setDate(endDate.getDate() - 1);
        endDate.setHours(23, 59, 59, 999);
        break;
      case "7d":
        startDate = new Date();
        startDate.setDate(startDate.getDate() - 7);
        break;
      case "30d":
        startDate = new Date();
        startDate.setDate(startDate.getDate() - 30);
        break;
    }

    // Query calls with customer and agent data
    const callRecords = await db
      .select({
        id: calls.id,
        direction: calls.directionFinal,
        directionLive: calls.directionLive,
        status: calls.status,
        fromNumber: calls.fromNumber,
        toNumber: calls.toNumber,
        customerId: calls.customerId,
        agentId: calls.agentId,
        startedAt: calls.startedAt,
        endedAt: calls.endedAt,
        durationSeconds: calls.durationSeconds,
        recordingUrl: calls.recordingUrl,
        transcription: calls.transcription,
        aiSummary: calls.aiSummary,
        aiSentiment: calls.aiSentiment,
        disposition: calls.disposition,
        customerFirstName: customers.firstName,
        customerLastName: customers.lastName,
        customerPhone: customers.phone,
        agentFirstName: users.firstName,
        agentLastName: users.lastName,
      })
      .from(calls)
      .leftJoin(customers, eq(calls.customerId, customers.id))
      .leftJoin(users, eq(calls.agentId, users.id))
      .where(
        and(
          eq(calls.tenantId, tenantId),
          direction && direction !== "all"
            ? or(
                eq(calls.directionFinal, direction as any),
                eq(calls.directionLive, direction as any)
              )
            : undefined,
          // Handle comma-separated status values like "ringing,in_progress"
          status && status !== "all"
            ? status.includes(",")
              ? or(...status.split(",").map(s => eq(calls.status, s.trim() as any)))
              : eq(calls.status, status as any)
            : undefined,
          // Filter by agent (either by agentId or extension)
          extensionAgentId
            ? eq(calls.agentId, extensionAgentId)
            : agentId && agentId !== "all"
              ? eq(calls.agentId, agentId)
              : undefined,
          startDate ? gte(calls.startedAt, startDate) : undefined,
          endDate ? lte(calls.startedAt, endDate) : undefined
        )
      )
      .orderBy(desc(calls.startedAt))
      .limit(limit)
      .offset(offset);

    // Get all unique phone numbers from calls without customer links
    const phonesToLookup = callRecords
      .filter(c => !c.customerId)
      .map(c => c.direction === "inbound" ? c.fromNumber : c.toNumber)
      .filter((p): p is string => !!p);

    // Look up customers by phone number
    const phoneCustomerMap = new Map<string, { firstName: string; lastName: string; id: string }>();
    if (phonesToLookup.length > 0) {
      const customerMatches = await db
        .select({
          id: customers.id,
          firstName: customers.firstName,
          lastName: customers.lastName,
          phone: customers.phone,
          phoneAlt: customers.phoneAlt,
        })
        .from(customers)
        .where(eq(customers.tenantId, tenantId));

      // Build map of normalized phone -> customer
      for (const c of customerMatches) {
        const phones = [c.phone, c.phoneAlt].filter(Boolean);
        for (const p of phones) {
          if (p) {
            const normalized = p.replace(/\D/g, '').slice(-10);
            if (normalized.length === 10) {
              phoneCustomerMap.set(normalized, { id: c.id, firstName: c.firstName, lastName: c.lastName });
            }
          }
        }
      }
    }

    // Transform to match expected format
    const formattedCalls = callRecords.map((call) => {
      // Determine customer phone (external number) based on direction
      // Inbound: customer called us, so fromNumber is customer's phone
      // Outbound: we called customer, so toNumber is customer's phone
      const direction = call.direction || call.directionLive || "inbound";
      const customerPhone = direction === "inbound" ? call.fromNumber : call.toNumber;
      const agentPhone = direction === "inbound" ? call.toNumber : call.fromNumber;
      const normalizedPhone = customerPhone?.replace(/\D/g, '').slice(-10) || '';
      const matchedCustomer = !call.customerId ? phoneCustomerMap.get(normalizedPhone) : null;

      return {
        id: call.id,
        direction,
        status: call.status || "completed",
        phoneNumber: customerPhone, // Customer's phone number (external)
        agentPhone, // Agent's/our phone number
        fromNumber: call.fromNumber,
        toNumber: call.toNumber,
        customerName: call.customerFirstName && call.customerLastName
          ? `${call.customerFirstName} ${call.customerLastName}`
          : matchedCustomer
          ? `${matchedCustomer.firstName} ${matchedCustomer.lastName}`
          : "Unknown",
        customerId: call.customerId || matchedCustomer?.id || null,
        agentName: call.agentFirstName && call.agentLastName
          ? `${call.agentFirstName} ${call.agentLastName}`
          : "Unassigned",
        agentId: call.agentId || "",
        startTime: call.startedAt?.toISOString() || new Date().toISOString(),
        endTime: call.endedAt?.toISOString(),
        duration: call.durationSeconds || 0,
        disposition: call.disposition,
        sentiment: (call.aiSentiment as any)?.score,
        hasRecording: !!call.recordingUrl,
        hasTranscript: !!call.transcription,
        transcript: call.transcription, // Include actual transcript
        summary: call.aiSummary,
        tags: [],
      };
    });

    // Get agents for filter dropdown
    const agents = await db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
      })
      .from(users)
      .where(eq(users.tenantId, tenantId));

    const agentOptions = [
      { id: "all", name: "All Agents" },
      ...agents.map((a) => ({ id: a.id, name: `${a.firstName} ${a.lastName}` })),
    ];

    return NextResponse.json({
      success: true,
      calls: formattedCalls,
      agents: agentOptions,
      total: formattedCalls.length,
    });
  } catch (error: any) {
    console.error("[Calls API] Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch calls", details: error.message },
      { status: 500 }
    );
  }
}
