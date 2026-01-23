/**
 * Customer Context API for Triage Inbox
 * =====================================
 * Returns comprehensive customer context for the triage inbox right panel.
 *
 * GET /api/triage/customer-context?customerId=123
 * GET /api/triage/customer-context?phone=2055551234
 * GET /api/triage/customer-context?agencyzoomId=456
 *
 * Returns:
 * - Customer info (name, phone, email, client level)
 * - Open service tickets from AgencyZoom
 * - Active policies summary
 * - Recent calls (from wrapup_drafts)
 * - Recent messages
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { customers, wrapupDrafts, messages, calls } from "@/db/schema";
import { eq, and, desc, or, sql } from "drizzle-orm";
import { getAgencyZoomClient } from "@/lib/api/agencyzoom";
import { getHawkSoftClient } from "@/lib/api/hawksoft";

// Response types
interface CustomerInfo {
  id: string;
  agencyzoomId: string | null;
  hawksoftId: string | null;
  name: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  email: string | null;
  clientLevel: string | null;
  agencyzoomUrl: string | null;
  isLead: boolean;
}

interface OpenTicket {
  id: number;
  subject: string;
  stageName: string | null;
  csrName: string | null;
  createdAt: string;
  daysOpen: number;
  priorityName: string | null;
  categoryName: string | null;
}

interface PolicySummary {
  policyNumber: string;
  type: string;
  carrier: string;
  status: string;
  premium: number | null;
  expirationDate: string | null;
}

interface RecentCall {
  id: string;
  date: string;
  summary: string | null;
  agentName: string | null;
  direction: string;
  duration: number | null;
}

interface RecentMessage {
  id: string;
  date: string;
  body: string;
  direction: string;
}

interface CustomerContextResponse {
  success: boolean;
  customer: CustomerInfo | null;
  policies: PolicySummary[];
  openTickets: OpenTicket[];
  recentCalls: RecentCall[];
  recentMessages: RecentMessage[];
  error?: string;
}

// Calculate days between dates
function daysBetween(date1: Date, date2: Date): number {
  const diffTime = Math.abs(date2.getTime() - date1.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

// Determine client level based on policies
function determineClientLevel(activePolicies: number, totalPremium: number): string {
  if (activePolicies >= 4 || totalPremium >= 10000) return "VIP";
  if (activePolicies >= 2 || totalPremium >= 5000) return "Premium";
  if (activePolicies >= 1) return "Standard";
  return "New";
}

export async function GET(request: NextRequest) {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    const searchParams = request.nextUrl.searchParams;
    const customerId = searchParams.get("customerId");
    const phone = searchParams.get("phone");
    const agencyzoomId = searchParams.get("agencyzoomId");

    if (!customerId && !phone && !agencyzoomId) {
      return NextResponse.json({
        success: false,
        error: "Must provide customerId, phone, or agencyzoomId",
        customer: null,
        policies: [],
        openTickets: [],
        recentCalls: [],
        recentMessages: [],
      } as CustomerContextResponse);
    }

    // Find customer in local database
    let customer: typeof customers.$inferSelect | null = null;

    if (customerId) {
      // Try as UUID first
      if (customerId.includes("-")) {
        [customer] = await db
          .select()
          .from(customers)
          .where(and(eq(customers.tenantId, tenantId), eq(customers.id, customerId)))
          .limit(1);
      }
      // Try as AgencyZoom ID
      if (!customer) {
        [customer] = await db
          .select()
          .from(customers)
          .where(and(eq(customers.tenantId, tenantId), eq(customers.agencyzoomId, customerId)))
          .limit(1);
      }
    } else if (agencyzoomId) {
      [customer] = await db
        .select()
        .from(customers)
        .where(and(eq(customers.tenantId, tenantId), eq(customers.agencyzoomId, agencyzoomId)))
        .limit(1);
    } else if (phone) {
      // Normalize phone for matching
      const normalizedPhone = phone.replace(/\D/g, "").slice(-10);
      [customer] = await db
        .select()
        .from(customers)
        .where(
          and(
            eq(customers.tenantId, tenantId),
            sql`regexp_replace(${customers.phone}, '[^0-9]', '', 'g') LIKE '%' || ${normalizedPhone}`
          )
        )
        .limit(1);
    }

    if (!customer) {
      return NextResponse.json({
        success: true,
        customer: null,
        policies: [],
        openTickets: [],
        recentCalls: [],
        recentMessages: [],
      } as CustomerContextResponse);
    }

    // Prepare parallel fetches
    const azId = customer.agencyzoomId ? parseInt(customer.agencyzoomId) : null;
    const hsId = customer.hawksoftClientCode;

    // Initialize response data
    let openTickets: OpenTicket[] = [];
    let policies: PolicySummary[] = [];
    let recentCalls: RecentCall[] = [];
    let recentMessages: RecentMessage[] = [];

    // Fetch open tickets from AgencyZoom
    if (azId) {
      try {
        const azClient = getAgencyZoomClient();
        const ticketResult = await azClient.getServiceTickets({
          status: 1, // Active tickets only
          searchText: `${customer.firstName} ${customer.lastName}`.trim(),
          limit: 20,
        });

        // Filter tickets that belong to this customer's household
        const customerTickets = ticketResult.data.filter(
          (t) => t.householdId === azId
        );

        openTickets = customerTickets.slice(0, 10).map((ticket) => ({
          id: ticket.id,
          subject: ticket.subject,
          stageName: ticket.workflowStageName || null,
          csrName: ticket.csrFirstname && ticket.csrLastname
            ? `${ticket.csrFirstname} ${ticket.csrLastname}`
            : null,
          createdAt: ticket.createDate,
          daysOpen: daysBetween(new Date(ticket.createDate), new Date()),
          priorityName: ticket.priorityName || null,
          categoryName: ticket.categoryName || null,
        }));
      } catch (err) {
        console.error("[CustomerContext] Failed to fetch tickets:", err);
      }
    }

    // Fetch policies from HawkSoft
    if (hsId) {
      try {
        const hsClient = getHawkSoftClient();
        const clientData = await hsClient.getClient(parseInt(hsId), ["policies"]);

        if (clientData?.policies) {
          policies = clientData.policies
            .filter((p: any) => {
              // Calculate if active
              const status = (p.status || "").toLowerCase();
              const expirationDate = p.expirationDate ? new Date(p.expirationDate) : null;
              const isActive = status === "active" || status === "renewal" || status === "new";
              const notExpired = !expirationDate || expirationDate > new Date();
              return isActive && notExpired;
            })
            .slice(0, 10)
            .map((policy: any) => ({
              policyNumber: policy.policyNumber || "Unknown",
              type: policy.loBs?.[0]?.code || policy.lineOfBusiness || "Unknown",
              carrier: typeof policy.carrier === "string"
                ? policy.carrier
                : policy.carrier?.name || "Unknown",
              status: policy.status || "active",
              premium: policy.annualPremium || policy.premium || null,
              expirationDate: policy.expirationDate || null,
            }));
        }
      } catch (err) {
        console.error("[CustomerContext] Failed to fetch policies:", err);
      }
    }

    // Fetch recent calls (from wrapup_drafts with completed calls)
    try {
      const normalizedPhone = (customer.phone || "").replace(/\D/g, "").slice(-10);

      if (normalizedPhone) {
        const callResults = await db
          .select({
            id: wrapupDrafts.id,
            date: wrapupDrafts.createdAt,
            summary: wrapupDrafts.aiCleanedSummary,
            agentName: wrapupDrafts.agentName,
            direction: wrapupDrafts.direction,
            callId: wrapupDrafts.callId,
          })
          .from(wrapupDrafts)
          .where(
            and(
              eq(wrapupDrafts.tenantId, tenantId),
              sql`regexp_replace(${wrapupDrafts.customerPhone}, '[^0-9]', '', 'g') LIKE '%' || ${normalizedPhone}`
            )
          )
          .orderBy(desc(wrapupDrafts.createdAt))
          .limit(10);

        // Get call durations
        const callIds = callResults.map((c) => c.callId).filter(Boolean);
        let callDurations: Record<string, number> = {};

        if (callIds.length > 0) {
          const callData = await db
            .select({
              id: calls.id,
              durationSeconds: calls.durationSeconds,
            })
            .from(calls)
            .where(sql`${calls.id} = ANY(${callIds})`);

          callDurations = Object.fromEntries(
            callData.map((c) => [c.id, c.durationSeconds || 0])
          );
        }

        recentCalls = callResults.map((call) => ({
          id: call.id,
          date: call.date?.toISOString() || new Date().toISOString(),
          summary: call.summary || null,
          agentName: call.agentName || null,
          direction: call.direction || "Inbound",
          duration: call.callId ? callDurations[call.callId] || null : null,
        }));
      }
    } catch (err) {
      console.error("[CustomerContext] Failed to fetch calls:", err);
    }

    // Fetch recent messages
    try {
      const normalizedPhone = (customer.phone || "").replace(/\D/g, "").slice(-10);

      if (normalizedPhone) {
        const messageResults = await db
          .select({
            id: messages.id,
            date: messages.sentAt,
            body: messages.body,
            direction: messages.direction,
          })
          .from(messages)
          .where(
            and(
              eq(messages.tenantId, tenantId),
              or(
                sql`regexp_replace(${messages.fromNumber}, '[^0-9]', '', 'g') LIKE '%' || ${normalizedPhone}`,
                sql`regexp_replace(${messages.toNumber}, '[^0-9]', '', 'g') LIKE '%' || ${normalizedPhone}`
              )
            )
          )
          .orderBy(desc(sql`COALESCE(${messages.sentAt}, ${messages.createdAt})`))
          .limit(10);

        recentMessages = messageResults.map((msg) => ({
          id: msg.id,
          date: msg.date?.toISOString() || new Date().toISOString(),
          body: msg.body.length > 200 ? msg.body.substring(0, 200) + "..." : msg.body,
          direction: msg.direction,
        }));
      }
    } catch (err) {
      console.error("[CustomerContext] Failed to fetch messages:", err);
    }

    // Calculate client level from policies
    const activePolicies = policies.length;
    const totalPremium = policies.reduce((sum, p) => sum + (p.premium || 0), 0);
    const clientLevel = determineClientLevel(activePolicies, totalPremium);

    // Build customer info response
    const customerInfo: CustomerInfo = {
      id: customer.id,
      agencyzoomId: customer.agencyzoomId,
      hawksoftId: customer.hawksoftClientCode,
      name: `${customer.firstName || ""} ${customer.lastName || ""}`.trim() || "Unknown",
      firstName: customer.firstName,
      lastName: customer.lastName,
      phone: customer.phone,
      email: customer.email,
      clientLevel,
      agencyzoomUrl: customer.agencyzoomId
        ? `https://app.agencyzoom.com/customer/index?id=${customer.agencyzoomId}`
        : null,
      isLead: customer.isLead || false,
    };

    return NextResponse.json({
      success: true,
      customer: customerInfo,
      policies,
      openTickets,
      recentCalls,
      recentMessages,
    } as CustomerContextResponse);
  } catch (error) {
    console.error("Customer context fetch error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch customer context",
        customer: null,
        policies: [],
        openTickets: [],
        recentCalls: [],
        recentMessages: [],
      } as CustomerContextResponse,
      { status: 500 }
    );
  }
}
