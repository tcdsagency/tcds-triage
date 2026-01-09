// API Route: /api/pending-review
// Unified pending items API - consolidates wrapups, messages, and leads

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { wrapupDrafts, messages, customers, users, calls } from "@/db/schema";
import { eq, and, desc, isNull, sql, gte, inArray } from "drizzle-orm";

// =============================================================================
// TYPES
// =============================================================================

interface PendingItem {
  id: string;
  type: 'wrapup' | 'message' | 'lead';

  // Display info
  direction: 'inbound' | 'outbound' | null;
  contactName: string | null;
  contactPhone: string;
  contactEmail: string | null;
  contactType: 'customer' | 'lead' | null;

  // Status/matching
  matchStatus: 'matched' | 'needs_review' | 'unmatched' | 'after_hours';
  sentiment: 'positive' | 'neutral' | 'frustrated' | null;
  isAutoPosted: boolean;

  // Content
  summary: string;
  requestType: string | null;
  actionItems: string[];
  policies: string[];

  // Metadata
  handledBy: string | null;
  timestamp: string;
  ageMinutes: number;

  // Trestle enrichment
  trestleData: {
    name?: string;
    address?: string;
    email?: string;
    altPhones?: string[];
  } | null;

  // Match info
  matchSuggestions: {
    id: string;
    name: string;
    type: 'customer' | 'lead';
    phone?: string;
    confidence: number;
    reason: string;
  }[];

  // Original reference
  callId?: string;
  transcription?: string;
  agencyzoomCustomerId?: string;
  agencyzoomLeadId?: string;
}

interface PendingCounts {
  wrapups: number;
  messages: number;
  leads: number;
  total: number;
  byStatus: {
    matched: number;
    needsReview: number;
    unmatched: number;
    afterHours: number;
  };
}

// =============================================================================
// GET - List Pending Items
// =============================================================================

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const statusFilter = searchParams.get('status'); // matched, needs_review, unmatched, after_hours
    const typeFilter = searchParams.get('type'); // wrapup, message, lead
    const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 200);

    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    const items: PendingItem[] = [];
    const now = new Date();

    // =======================================================================
    // 1. Fetch Pending Wrapups
    // =======================================================================
    if (!typeFilter || typeFilter === 'wrapup') {
      const wrapups = await db
        .select({
          id: wrapupDrafts.id,
          callId: wrapupDrafts.callId,
          direction: wrapupDrafts.direction,
          customerName: wrapupDrafts.customerName,
          customerPhone: wrapupDrafts.customerPhone,
          customerEmail: wrapupDrafts.customerEmail,
          requestType: wrapupDrafts.requestType,
          summary: wrapupDrafts.summary,
          aiCleanedSummary: wrapupDrafts.aiCleanedSummary,
          aiExtraction: wrapupDrafts.aiExtraction,
          matchStatus: wrapupDrafts.matchStatus,
          trestleData: wrapupDrafts.trestleData,
          outcome: wrapupDrafts.outcome,
          createdAt: wrapupDrafts.createdAt,
          // Join call data
          callFromNumber: calls.fromNumber,
          callToNumber: calls.toNumber,
          transcription: calls.transcription,
          agentId: calls.agentId,
        })
        .from(wrapupDrafts)
        .leftJoin(calls, eq(wrapupDrafts.callId, calls.id))
        .where(
          and(
            eq(wrapupDrafts.tenantId, tenantId),
            eq(wrapupDrafts.status, 'pending_review')
          )
        )
        .orderBy(desc(wrapupDrafts.createdAt))
        .limit(limit);

      // Get agent names for wrapups
      const agentIds = wrapups.map(w => w.agentId).filter(Boolean) as string[];
      const agents = agentIds.length > 0
        ? await db
            .select({ id: users.id, firstName: users.firstName, lastName: users.lastName })
            .from(users)
            .where(inArray(users.id, agentIds))
        : [];
      const agentMap = new Map(agents.map(a => [a.id, `${a.firstName} ${a.lastName}`.trim()]));

      for (const w of wrapups) {
        const extraction = w.aiExtraction as any || {};
        const trestle = w.trestleData as any || {};

        // Determine match status
        let matchStatus: PendingItem['matchStatus'] = 'unmatched';
        if (w.matchStatus === 'matched') matchStatus = 'matched';
        else if (w.matchStatus === 'multiple_matches') matchStatus = 'needs_review';
        else if (w.matchStatus === 'unmatched') matchStatus = 'unmatched';

        // Skip if filtering by status and doesn't match
        if (statusFilter && statusFilter !== matchStatus) continue;

        const ageMinutes = Math.floor((now.getTime() - new Date(w.createdAt).getTime()) / 60000);

        items.push({
          id: w.id,
          type: 'wrapup',
          direction: w.direction?.toLowerCase() as 'inbound' | 'outbound' | null,
          contactName: w.customerName,
          contactPhone: w.customerPhone || w.callFromNumber || '',
          contactEmail: w.customerEmail,
          contactType: extraction.matchType === 'customer' ? 'customer' : extraction.matchType === 'lead' ? 'lead' : null,
          matchStatus,
          sentiment: extraction.sentiment || null,
          isAutoPosted: w.outcome === 'note_posted' || w.outcome === 'posted_to_agencyzoom',
          summary: w.aiCleanedSummary || w.summary || '',
          requestType: w.requestType || extraction.serviceRequestType || null,
          actionItems: extraction.actionItems || [],
          policies: extraction.extractedData?.policyNumber ? [extraction.extractedData.policyNumber] : [],
          handledBy: w.agentId ? agentMap.get(w.agentId) || null : null,
          timestamp: w.createdAt,
          ageMinutes,
          trestleData: trestle.person ? {
            name: trestle.person.name || `${trestle.person.firstName || ''} ${trestle.person.lastName || ''}`.trim(),
            address: trestle.address ? `${trestle.address.street}, ${trestle.address.city}, ${trestle.address.state} ${trestle.address.zip}` : undefined,
            email: trestle.emails?.[0],
            altPhones: trestle.alternatePhones,
          } : null,
          matchSuggestions: [], // Will be populated from matchSuggestions table if needed
          callId: w.callId || undefined,
          transcription: w.transcription || undefined,
          agencyzoomCustomerId: extraction.agencyZoomCustomerId,
          agencyzoomLeadId: extraction.agencyZoomLeadId,
        });
      }
    }

    // =======================================================================
    // 2. Fetch Unacknowledged Messages
    // =======================================================================
    if (!typeFilter || typeFilter === 'message') {
      const unreadMessages = await db
        .select({
          id: messages.id,
          direction: messages.direction,
          fromNumber: messages.fromNumber,
          toNumber: messages.toNumber,
          body: messages.body,
          contactId: messages.contactId,
          contactName: messages.contactName,
          contactType: messages.contactType,
          isAfterHours: messages.isAfterHours,
          createdAt: messages.createdAt,
        })
        .from(messages)
        .where(
          and(
            eq(messages.tenantId, tenantId),
            eq(messages.direction, 'inbound'),
            eq(messages.isAcknowledged, false)
          )
        )
        .orderBy(desc(messages.createdAt))
        .limit(limit);

      for (const m of unreadMessages) {
        const matchStatus: PendingItem['matchStatus'] = m.isAfterHours
          ? 'after_hours'
          : m.contactName && !m.contactName.match(/^[\d\(\)\-\s\.]+$/)
            ? 'matched'
            : 'unmatched';

        // Skip if filtering by status and doesn't match
        if (statusFilter && statusFilter !== matchStatus) continue;

        const ageMinutes = Math.floor((now.getTime() - new Date(m.createdAt).getTime()) / 60000);

        items.push({
          id: m.id,
          type: 'message',
          direction: m.direction as 'inbound' | 'outbound',
          contactName: m.contactName,
          contactPhone: m.fromNumber || '',
          contactEmail: null,
          contactType: m.contactType as 'customer' | 'lead' | null,
          matchStatus,
          sentiment: null,
          isAutoPosted: false,
          summary: m.body || '',
          requestType: m.isAfterHours ? 'After Hours' : 'SMS',
          actionItems: [],
          policies: [],
          handledBy: null,
          timestamp: m.createdAt,
          ageMinutes,
          trestleData: null,
          matchSuggestions: [],
          agencyzoomCustomerId: m.contactId || undefined,
        });
      }
    }

    // =======================================================================
    // 3. Fetch New Unassigned Leads (last 7 days)
    // =======================================================================
    if (!typeFilter || typeFilter === 'lead') {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const newLeads = await db
        .select({
          id: customers.id,
          firstName: customers.firstName,
          lastName: customers.lastName,
          email: customers.email,
          phone: customers.phone,
          phoneAlt: customers.phoneAlt,
          leadSource: customers.leadSource,
          agencyzoomId: customers.agencyzoomId,
          createdAt: customers.createdAt,
        })
        .from(customers)
        .where(
          and(
            eq(customers.tenantId, tenantId),
            eq(customers.isLead, true),
            isNull(customers.producerId),
            gte(customers.createdAt, sevenDaysAgo)
          )
        )
        .orderBy(desc(customers.createdAt))
        .limit(limit);

      for (const lead of newLeads) {
        // Skip if filtering by status (leads are always 'unmatched' in this context)
        if (statusFilter && statusFilter !== 'unmatched') continue;

        const ageMinutes = Math.floor((now.getTime() - new Date(lead.createdAt).getTime()) / 60000);

        items.push({
          id: lead.id,
          type: 'lead',
          direction: null,
          contactName: `${lead.firstName} ${lead.lastName}`.trim(),
          contactPhone: lead.phone || '',
          contactEmail: lead.email,
          contactType: 'lead',
          matchStatus: 'unmatched',
          sentiment: null,
          isAutoPosted: false,
          summary: `New lead from ${lead.leadSource || 'Unknown source'}`,
          requestType: 'New Lead',
          actionItems: ['Follow up with lead', 'Qualify opportunity'],
          policies: [],
          handledBy: null,
          timestamp: lead.createdAt,
          ageMinutes,
          trestleData: null,
          matchSuggestions: [],
          agencyzoomLeadId: lead.agencyzoomId || undefined,
        });
      }
    }

    // =======================================================================
    // Sort by timestamp (newest first) and apply limit
    // =======================================================================
    items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    const limitedItems = items.slice(0, limit);

    // =======================================================================
    // Calculate Counts
    // =======================================================================
    const counts: PendingCounts = {
      wrapups: items.filter(i => i.type === 'wrapup').length,
      messages: items.filter(i => i.type === 'message').length,
      leads: items.filter(i => i.type === 'lead').length,
      total: items.length,
      byStatus: {
        matched: items.filter(i => i.matchStatus === 'matched').length,
        needsReview: items.filter(i => i.matchStatus === 'needs_review').length,
        unmatched: items.filter(i => i.matchStatus === 'unmatched').length,
        afterHours: items.filter(i => i.matchStatus === 'after_hours').length,
      },
    };

    return NextResponse.json({
      success: true,
      items: limitedItems,
      counts,
    });
  } catch (error) {
    console.error("Pending review fetch error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Fetch failed" },
      { status: 500 }
    );
  }
}
