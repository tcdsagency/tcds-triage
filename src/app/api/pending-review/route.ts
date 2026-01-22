// API Route: /api/pending-review
// Unified pending items API - consolidates wrapups, messages, and after-hours items
// NOTE: Leads are NOT included - they belong to the sales workflow (/leads page)

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { wrapupDrafts, messages, users, calls, triageItems, customers, serviceTickets } from "@/db/schema";
import { eq, and, desc, sql, inArray, or } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";

// Helper to get current user's role and extension
async function getCurrentUser(): Promise<{ id: string; role: string | null; extension: string | null } | null> {
  try {
    const supabase = await createClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();

    if (!authUser?.email) return null;

    const [dbUser] = await db
      .select({
        id: users.id,
        role: users.role,
        extension: users.extension,
      })
      .from(users)
      .where(eq(users.email, authUser.email))
      .limit(1);

    return dbUser || null;
  } catch (error) {
    console.error("[Pending Review] Failed to get current user:", error);
    return null;
  }
}

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
  matchReason: string | null;
  sentiment: 'positive' | 'neutral' | 'frustrated' | null;
  isAutoPosted: boolean;

  // Content
  summary: string;
  requestType: string | null;
  actionItems: string[];
  policies: string[];

  // Metadata
  handledBy: string | null;
  handledByAgent: {
    id: string;
    name: string;
    avatar: string | null;
    extension: string | null;
    initials: string;
  } | null;
  timestamp: string;
  ageMinutes: number;

  // Trestle enrichment
  trestleData: {
    name?: string;
    address?: string;
    email?: string;
    altPhones?: string[];
    // Lead quality scoring
    leadQuality?: {
      grade: 'A' | 'B' | 'C' | 'D' | 'F';
      activityScore: number;
      phoneValid?: boolean;
      phoneLineType?: string;
      isDisconnected?: boolean;
      isSpam?: boolean;
    };
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

  // Message grouping (for SMS conversations)
  conversationThread?: {
    direction: string;
    body: string | null;
    timestamp: string;
    isAutoReply: boolean;
  }[];
  messageIds?: string[]; // All message IDs in this group (for bulk acknowledge)

  // After-hours triage item reference
  triageItemId?: string;

  // Linked service ticket (if ticket was created from this wrapup)
  linkedTicket?: {
    id: string;
    azTicketId: number;
    status: 'active' | 'completed' | 'removed';
    stageName: string | null;
    subject: string;
    csrName: string | null;
  } | null;
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
// GET - List Pending Items (Optimized with parallel queries)
// =============================================================================

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const statusFilter = searchParams.get('status'); // matched, needs_review, unmatched, after_hours
    const typeFilter = searchParams.get('type'); // wrapup, message, lead
    const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 200);

    const tenantIdEnv = process.env.DEFAULT_TENANT_ID;
    if (!tenantIdEnv) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }
    // Capture as const for use in nested functions
    const tenantId: string = tenantIdEnv;

    // Get current user to determine filtering rules
    const currentUser = await getCurrentUser();
    const isAgent = currentUser?.role === 'agent';
    const userExtension = currentUser?.extension;

    // For agents without an extension configured, they can't see any wrapups
    const agentCanSeeWrapups = !isAgent || (isAgent && userExtension);

    const now = new Date();

    // =======================================================================
    // PARALLEL DATA FETCHING - Run all queries concurrently
    // =======================================================================

    // Helper function to fetch wrapups
    async function fetchWrapups(): Promise<PendingItem[]> {
      if (typeFilter && typeFilter !== 'wrapup') return [];
      if (!agentCanSeeWrapups) return [];

      const whereConditions = [
        eq(wrapupDrafts.tenantId, tenantId),
        eq(wrapupDrafts.status, 'pending_review'),
      ];

      if (isAgent && userExtension) {
        whereConditions.push(
          or(
            eq(wrapupDrafts.agentExtension, userExtension),
            eq(calls.extension, userExtension)
          )!
        );
      }

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
          callFromNumber: calls.fromNumber,
          callToNumber: calls.toNumber,
          transcription: calls.transcription,
          agentId: calls.agentId,
          // Linked service ticket (if any)
          ticketId: serviceTickets.id,
          ticketAzId: serviceTickets.azTicketId,
          ticketStatus: serviceTickets.status,
          ticketStageName: serviceTickets.stageName,
          ticketSubject: serviceTickets.subject,
          ticketCsrName: serviceTickets.csrName,
        })
        .from(wrapupDrafts)
        .leftJoin(calls, eq(wrapupDrafts.callId, calls.id))
        .leftJoin(serviceTickets, eq(serviceTickets.wrapupDraftId, wrapupDrafts.id))
        .where(and(...whereConditions))
        .orderBy(desc(wrapupDrafts.createdAt))
        .limit(limit);

      // Get agent details in parallel
      const agentIds = wrapups.map(w => w.agentId).filter(Boolean) as string[];
      const agents = agentIds.length > 0
        ? await db
            .select({
              id: users.id,
              firstName: users.firstName,
              lastName: users.lastName,
              avatarUrl: users.avatarUrl,
              extension: users.extension,
            })
            .from(users)
            .where(inArray(users.id, agentIds))
        : [];

      const agentMap = new Map(agents.map(a => {
        const name = `${a.firstName} ${a.lastName}`.trim();
        const initials = `${a.firstName?.[0] || ''}${a.lastName?.[0] || ''}`.toUpperCase();
        return [a.id, { id: a.id, name, avatar: a.avatarUrl, extension: a.extension, initials }];
      }));

      const items: PendingItem[] = [];
      for (const w of wrapups) {
        const extraction = w.aiExtraction as any || {};
        const trestle = w.trestleData as any || {};

        let matchStatus: PendingItem['matchStatus'] = 'unmatched';
        let matchReason: string | null = null;
        if (w.matchStatus === 'matched') {
          matchStatus = 'matched';
        } else if (w.matchStatus === 'multiple_matches') {
          matchStatus = 'needs_review';
          matchReason = 'Multiple matches found in AgencyZoom';
        } else if (w.matchStatus === 'unmatched') {
          matchStatus = 'unmatched';
          matchReason = trestle.person ? 'No match in database - Trestle identified caller' : 'No match found in database';
        }

        if (statusFilter && statusFilter !== matchStatus) continue;

        const ageMinutes = Math.floor((now.getTime() - new Date(w.createdAt).getTime()) / 60000);
        const isInbound = w.direction?.toLowerCase() === 'inbound';
        const externalPhone = isInbound ? w.callFromNumber : w.callToNumber;

        items.push({
          id: w.id,
          type: 'wrapup',
          direction: w.direction?.toLowerCase() as 'inbound' | 'outbound' | null,
          contactName: w.customerName,
          contactPhone: w.customerPhone || externalPhone || '',
          contactEmail: w.customerEmail,
          contactType: extraction.matchType === 'customer' ? 'customer' : extraction.matchType === 'lead' ? 'lead' : null,
          matchStatus,
          matchReason,
          sentiment: extraction.sentiment || null,
          isAutoPosted: w.outcome === 'note_posted' || w.outcome === 'posted_to_agencyzoom',
          summary: w.aiCleanedSummary || w.summary || '',
          requestType: w.requestType || extraction.serviceRequestType || null,
          actionItems: extraction.actionItems || [],
          policies: extraction.extractedData?.policyNumber ? [extraction.extractedData.policyNumber] : [],
          handledBy: w.agentId ? agentMap.get(w.agentId)?.name || null : null,
          handledByAgent: w.agentId ? agentMap.get(w.agentId) || null : null,
          timestamp: w.createdAt.toISOString(),
          ageMinutes,
          trestleData: (trestle.person || trestle.leadQuality) ? {
            name: trestle.person?.name || `${trestle.person?.firstName || ''} ${trestle.person?.lastName || ''}`.trim() || undefined,
            address: trestle.address ? `${trestle.address.street}, ${trestle.address.city}, ${trestle.address.state} ${trestle.address.zip}` : undefined,
            email: trestle.emails?.[0],
            altPhones: trestle.alternatePhones,
            leadQuality: trestle.leadQuality ? {
              grade: trestle.leadQuality.grade,
              activityScore: trestle.leadQuality.activityScore,
              phoneValid: trestle.leadQuality.phoneValid,
              phoneLineType: trestle.leadQuality.phoneLineType,
              isDisconnected: trestle.leadQuality.isDisconnected,
              isSpam: trestle.leadQuality.isSpam,
            } : undefined,
          } : null,
          matchSuggestions: [],
          callId: w.callId || undefined,
          transcription: w.transcription || undefined,
          agencyzoomCustomerId: extraction.agencyZoomCustomerId,
          agencyzoomLeadId: extraction.agencyZoomLeadId,
          // Linked service ticket (if any)
          linkedTicket: w.ticketId ? {
            id: w.ticketId,
            azTicketId: w.ticketAzId!,
            status: w.ticketStatus as 'active' | 'completed' | 'removed',
            stageName: w.ticketStageName,
            subject: w.ticketSubject!,
            csrName: w.ticketCsrName,
          } : null,
        });
      }
      return items;
    }

    // Helper function to fetch messages with BATCHED conversation threads
    async function fetchMessages(): Promise<PendingItem[]> {
      if (typeFilter && typeFilter !== 'message') return [];

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

      if (unreadMessages.length === 0) return [];

      // Group messages by phone number
      const messagesByPhone = new Map<string, typeof unreadMessages>();
      for (const m of unreadMessages) {
        const phone = m.fromNumber || '';
        if (!messagesByPhone.has(phone)) {
          messagesByPhone.set(phone, []);
        }
        messagesByPhone.get(phone)!.push(m);
      }

      // OPTIMIZATION: Batch fetch all conversation threads in ONE query
      const phoneNumbers = Array.from(messagesByPhone.keys()).filter(Boolean);
      const cutoff24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      // Fetch all recent messages for all phone numbers in one query
      const allThreadMessages = phoneNumbers.length > 0 ? await db
        .select({
          id: messages.id,
          direction: messages.direction,
          body: messages.body,
          fromNumber: messages.fromNumber,
          toNumber: messages.toNumber,
          createdAt: messages.createdAt,
          aiGenerated: messages.aiGenerated,
        })
        .from(messages)
        .where(
          and(
            eq(messages.tenantId, tenantId),
            sql`${messages.createdAt} >= ${cutoff24h.toISOString()}`,
            sql`(${messages.fromNumber} IN (${sql.join(phoneNumbers.map(p => sql`${p}`), sql`, `)}) OR ${messages.toNumber} IN (${sql.join(phoneNumbers.map(p => sql`${p}`), sql`, `)}))`
          )
        )
        .orderBy(messages.createdAt) : [];

      // Group thread messages by phone number
      const threadsByPhone = new Map<string, typeof allThreadMessages>();
      for (const m of allThreadMessages) {
        const phone = m.fromNumber && phoneNumbers.includes(m.fromNumber) ? m.fromNumber : m.toNumber;
        if (phone && phoneNumbers.includes(phone)) {
          if (!threadsByPhone.has(phone)) {
            threadsByPhone.set(phone, []);
          }
          threadsByPhone.get(phone)!.push(m);
        }
      }

      const items: PendingItem[] = [];
      for (const [phone, phoneMessages] of messagesByPhone) {
        const firstMsg = phoneMessages[0];
        const oldestMsg = phoneMessages[phoneMessages.length - 1];
        const fullThread = (threadsByPhone.get(phone) || []).slice(0, 20);

        const unreadCount = phoneMessages.length;
        const hasAutoReply = fullThread.some(m => m.direction === 'outbound' && m.aiGenerated);

        let summary = phoneMessages.map(m => m.body || '').filter(Boolean).join('\n---\n');
        if (unreadCount > 1) {
          summary = `[${unreadCount} unread messages]\n\n${summary}`;
        }

        const matchStatus: PendingItem['matchStatus'] = firstMsg.isAfterHours
          ? 'after_hours'
          : firstMsg.contactName && !firstMsg.contactName.match(/^[\d\(\)\-\s\.]+$/)
            ? 'matched'
            : 'unmatched';
        const msgMatchReason = matchStatus === 'unmatched' ? 'No match found in database' :
                              matchStatus === 'after_hours' ? 'After hours message' + (hasAutoReply ? ' (auto-reply sent)' : '') : null;

        if (statusFilter && statusFilter !== matchStatus) continue;

        const ageMinutes = Math.floor((now.getTime() - new Date(oldestMsg.createdAt).getTime()) / 60000);

        items.push({
          id: firstMsg.id,
          type: 'message',
          direction: 'inbound',
          contactName: firstMsg.contactName,
          contactPhone: phone,
          contactEmail: null,
          contactType: firstMsg.contactType as 'customer' | 'lead' | null,
          matchStatus,
          matchReason: msgMatchReason,
          sentiment: null,
          isAutoPosted: hasAutoReply,
          summary,
          requestType: firstMsg.isAfterHours ? 'After Hours' : (unreadCount > 1 ? `${unreadCount} Messages` : 'SMS'),
          actionItems: [],
          policies: [],
          handledBy: null,
          handledByAgent: null,
          timestamp: firstMsg.createdAt.toISOString(),
          ageMinutes,
          trestleData: null,
          matchSuggestions: [],
          agencyzoomCustomerId: firstMsg.contactId || undefined,
          conversationThread: fullThread.map(t => ({
            direction: t.direction,
            body: t.body,
            timestamp: t.createdAt.toISOString(),
            isAutoReply: t.aiGenerated || false,
          })),
          messageIds: phoneMessages.map(m => m.id),
        });
      }
      return items;
    }

    // Helper function to fetch after-hours triage items
    async function fetchTriageItems(): Promise<PendingItem[]> {
      if (typeFilter && typeFilter !== 'after_hours') return [];

      const afterHoursTriageItems = await db
        .select({
          id: triageItems.id,
          type: triageItems.type,
          status: triageItems.status,
          priority: triageItems.priority,
          title: triageItems.title,
          description: triageItems.description,
          aiSummary: triageItems.aiSummary,
          customerId: triageItems.customerId,
          messageId: triageItems.messageId,
          createdAt: triageItems.createdAt,
        })
        .from(triageItems)
        .where(and(
          eq(triageItems.tenantId, tenantId),
          eq(triageItems.type, 'after_hours'),
          eq(triageItems.status, 'pending'),
        ))
        .orderBy(desc(triageItems.createdAt))
        .limit(limit);

      if (afterHoursTriageItems.length === 0) return [];

      // Batch fetch customer and message details in parallel
      const triageCustomerIds = afterHoursTriageItems.map(t => t.customerId).filter(Boolean) as string[];
      const triageMessageIds = afterHoursTriageItems.map(t => t.messageId).filter(Boolean) as string[];

      const [triageCustomers, triageMessages] = await Promise.all([
        triageCustomerIds.length > 0
          ? db.select({ id: customers.id, firstName: customers.firstName, lastName: customers.lastName, phone: customers.phone })
              .from(customers)
              .where(inArray(customers.id, triageCustomerIds))
          : Promise.resolve([]),
        triageMessageIds.length > 0
          ? db.select({ id: messages.id, fromNumber: messages.fromNumber, body: messages.body })
              .from(messages)
              .where(inArray(messages.id, triageMessageIds))
          : Promise.resolve([]),
      ]);

      const triageCustomerMap = new Map(triageCustomers.map(c => [c.id, c]));
      const triageMessageMap = new Map(triageMessages.map(m => [m.id, m]));

      const items: PendingItem[] = [];
      for (const t of afterHoursTriageItems) {
        const linkedMessage = t.messageId ? triageMessageMap.get(t.messageId) : null;
        const phone = linkedMessage?.fromNumber || '';

        if (statusFilter && statusFilter !== 'after_hours') continue;

        const customer = t.customerId ? triageCustomerMap.get(t.customerId) : null;
        const ageMinutes = Math.floor((now.getTime() - new Date(t.createdAt).getTime()) / 60000);

        items.push({
          id: t.id,
          type: 'message',
          direction: 'inbound',
          contactName: t.title || (customer ? `${customer.firstName || ''} ${customer.lastName || ''}`.trim() : null),
          contactPhone: phone.replace('+1', ''),
          contactEmail: null,
          contactType: customer ? 'customer' : null,
          matchStatus: 'after_hours',
          matchReason: 'After-hours callback required',
          sentiment: t.priority === 'urgent' ? 'frustrated' : null,
          isAutoPosted: false,
          summary: t.aiSummary || t.description || '',
          requestType: 'After Hours',
          actionItems: [],
          policies: [],
          handledBy: null,
          handledByAgent: null,
          timestamp: t.createdAt.toISOString(),
          ageMinutes,
          trestleData: null,
          matchSuggestions: [],
          agencyzoomCustomerId: customer?.id,
          triageItemId: t.id,
        });
      }
      return items;
    }

    // =======================================================================
    // RUN ALL FETCHES IN PARALLEL
    // =======================================================================
    const [wrapupItems, messageItems, triageItemsList] = await Promise.all([
      fetchWrapups(),
      fetchMessages(),
      fetchTriageItems(),
    ]);

    // Combine all items
    const items = [...wrapupItems, ...messageItems, ...triageItemsList];

    // =======================================================================
    // Deduplicate items (same phone + similar time = duplicate)
    // =======================================================================
    const deduplicatedItems: PendingItem[] = [];
    const seenKeys = new Set<string>();

    for (const item of items) {
      // Create a dedup key: phone + type + 5-minute window
      const timeWindow = Math.floor(new Date(item.timestamp).getTime() / (5 * 60 * 1000));
      const dedupKey = `${item.contactPhone}-${item.type}-${timeWindow}`;

      // For messages with same body, also dedupe by content
      const bodyHash = item.summary ? item.summary.slice(0, 50) : '';
      const contentKey = `${item.contactPhone}-${bodyHash}`;

      if (!seenKeys.has(dedupKey) && !seenKeys.has(contentKey)) {
        seenKeys.add(dedupKey);
        if (bodyHash) seenKeys.add(contentKey);
        deduplicatedItems.push(item);
      }
    }

    // =======================================================================
    // Sort by timestamp (newest first) and apply limit
    // =======================================================================
    deduplicatedItems.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    const limitedItems = deduplicatedItems.slice(0, limit);

    // =======================================================================
    // Calculate Counts (Leads excluded - they're in sales workflow)
    // Use deduplicated items for accurate counts
    // =======================================================================
    const counts: PendingCounts = {
      wrapups: deduplicatedItems.filter(i => i.type === 'wrapup').length,
      messages: deduplicatedItems.filter(i => i.type === 'message').length,
      leads: 0, // Leads not included in pending review
      total: deduplicatedItems.length,
      byStatus: {
        matched: deduplicatedItems.filter(i => i.matchStatus === 'matched').length,
        needsReview: deduplicatedItems.filter(i => i.matchStatus === 'needs_review').length,
        unmatched: deduplicatedItems.filter(i => i.matchStatus === 'unmatched').length,
        afterHours: deduplicatedItems.filter(i => i.matchStatus === 'after_hours').length,
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

// =============================================================================
// DELETE - Clear all pending items (wrapups and messages)
// =============================================================================

export async function DELETE(request: NextRequest) {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ success: false, error: "Tenant not configured" }, { status: 500 });
    }

    let deletedWrapups = 0;
    let deletedMessages = 0;

    // Delete pending wrapups
    const wrapupCountResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(wrapupDrafts)
      .where(and(
        eq(wrapupDrafts.tenantId, tenantId),
        eq(wrapupDrafts.status, "pending_review")
      ));

    deletedWrapups = Number(wrapupCountResult[0]?.count || 0);

    if (deletedWrapups > 0) {
      await db
        .delete(wrapupDrafts)
        .where(and(
          eq(wrapupDrafts.tenantId, tenantId),
          eq(wrapupDrafts.status, "pending_review")
        ));
    }

    // Delete pending messages (unread inbound)
    const messageCountResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(messages)
      .where(and(
        eq(messages.tenantId, tenantId),
        eq(messages.direction, "inbound"),
        eq(messages.isAcknowledged, false)
      ));

    deletedMessages = Number(messageCountResult[0]?.count || 0);

    if (deletedMessages > 0) {
      await db
        .delete(messages)
        .where(and(
          eq(messages.tenantId, tenantId),
          eq(messages.direction, "inbound"),
          eq(messages.isAcknowledged, false)
        ));
    }

    console.log(`[Pending Review] Cleared ${deletedWrapups} wrapups and ${deletedMessages} messages`);

    return NextResponse.json({
      success: true,
      message: `Cleared ${deletedWrapups + deletedMessages} pending items`,
      deleted: {
        wrapups: deletedWrapups,
        messages: deletedMessages,
        total: deletedWrapups + deletedMessages,
      },
    });
  } catch (error) {
    console.error("[Pending Review] DELETE Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to clear pending items" },
      { status: 500 }
    );
  }
}
