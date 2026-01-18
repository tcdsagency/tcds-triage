// API Route: /api/pending-review
// Unified pending items API - consolidates wrapups and messages for intake/service
// NOTE: Leads are NOT included - they belong to the sales workflow (/leads page)

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { wrapupDrafts, messages, users, calls } from "@/db/schema";
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

    // Get current user to determine filtering rules
    const currentUser = await getCurrentUser();
    const isAgent = currentUser?.role === 'agent';
    const userExtension = currentUser?.extension;

    // For agents without an extension configured, they can't see any wrapups
    const agentCanSeeWrapups = !isAgent || (isAgent && userExtension);

    const items: PendingItem[] = [];
    const now = new Date();

    // =======================================================================
    // 1. Fetch Pending Wrapups
    // =======================================================================
    if ((!typeFilter || typeFilter === 'wrapup') && agentCanSeeWrapups) {
      // Build where conditions
      // For agents: only show wrapups where agent_extension matches their extension
      // For CSRs/admins: show all wrapups
      const whereConditions = [
        eq(wrapupDrafts.tenantId, tenantId),
        eq(wrapupDrafts.status, 'pending_review'),
      ];

      // Add extension filter for agents only
      if (isAgent && userExtension) {
        // Agent can see calls they handled (agent_extension) OR calls to/from their extension
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
          // Join call data
          callFromNumber: calls.fromNumber,
          callToNumber: calls.toNumber,
          transcription: calls.transcription,
          agentId: calls.agentId,
        })
        .from(wrapupDrafts)
        .leftJoin(calls, eq(wrapupDrafts.callId, calls.id))
        .where(and(...whereConditions))
        .orderBy(desc(wrapupDrafts.createdAt))
        .limit(limit);

      // Get agent details for wrapups
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
        return [a.id, {
          id: a.id,
          name,
          avatar: a.avatarUrl,
          extension: a.extension,
          initials,
        }];
      }));

      for (const w of wrapups) {
        const extraction = w.aiExtraction as any || {};
        const trestle = w.trestleData as any || {};

        // Determine match status and reason
        let matchStatus: PendingItem['matchStatus'] = 'unmatched';
        let matchReason: string | null = null;
        if (w.matchStatus === 'matched') {
          matchStatus = 'matched';
          matchReason = null;
        } else if (w.matchStatus === 'multiple_matches') {
          matchStatus = 'needs_review';
          matchReason = 'Multiple matches found in AgencyZoom';
        } else if (w.matchStatus === 'unmatched') {
          matchStatus = 'unmatched';
          matchReason = trestle.person ? 'No match in database - Trestle identified caller' : 'No match found in database';
        }

        // Skip if filtering by status and doesn't match
        if (statusFilter && statusFilter !== matchStatus) continue;

        const ageMinutes = Math.floor((now.getTime() - new Date(w.createdAt).getTime()) / 60000);

        // Use external phone number based on call direction
        // Inbound: customer called us, so fromNumber is the customer
        // Outbound: we called customer, so toNumber is the customer
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
    // 2. Fetch Unacknowledged Messages - GROUPED BY PHONE NUMBER
    // =======================================================================
    if (!typeFilter || typeFilter === 'message') {
      // Get all unacknowledged inbound messages
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

      // Group messages by phone number
      const messagesByPhone = new Map<string, typeof unreadMessages>();
      for (const m of unreadMessages) {
        const phone = m.fromNumber || '';
        if (!messagesByPhone.has(phone)) {
          messagesByPhone.set(phone, []);
        }
        messagesByPhone.get(phone)!.push(m);
      }

      // For each phone group, also fetch recent conversation (including auto-replies)
      for (const [phone, phoneMessages] of messagesByPhone) {
        const firstMsg = phoneMessages[0]; // Most recent unread message
        const oldestMsg = phoneMessages[phoneMessages.length - 1];

        // Get the full conversation thread (last 24 hours or since oldest unread)
        const conversationCutoff = new Date(Math.min(
          oldestMsg.createdAt.getTime(),
          now.getTime() - 24 * 60 * 60 * 1000 // 24 hours ago
        ));

        const fullThread = await db
          .select({
            id: messages.id,
            direction: messages.direction,
            body: messages.body,
            createdAt: messages.createdAt,
            aiGenerated: messages.aiGenerated,
          })
          .from(messages)
          .where(
            and(
              eq(messages.tenantId, tenantId),
              sql`(${messages.fromNumber} = ${phone} OR ${messages.toNumber} = ${phone})`,
              sql`${messages.createdAt} >= ${conversationCutoff.toISOString()}`
            )
          )
          .orderBy(messages.createdAt)
          .limit(20);

        // Build conversation summary
        const unreadCount = phoneMessages.length;
        const hasAutoReply = fullThread.some(m => m.direction === 'outbound' && m.aiGenerated);

        // Create summary showing all unread messages
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

        // Skip if filtering by status and doesn't match
        if (statusFilter && statusFilter !== matchStatus) continue;

        const ageMinutes = Math.floor((now.getTime() - new Date(oldestMsg.createdAt).getTime()) / 60000);

        items.push({
          id: firstMsg.id, // Use first message ID as group ID
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
          // Include conversation thread for display
          conversationThread: fullThread.map(t => ({
            direction: t.direction,
            body: t.body,
            timestamp: t.createdAt.toISOString(),
            isAutoReply: t.aiGenerated || false,
          })),
          messageIds: phoneMessages.map(m => m.id), // All message IDs in this group
        });
      }
    }

    // NOTE: Leads are NOT included in pending review - they belong to sales workflow
    // Leads are managed separately in /leads page

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
        eq(messages.isRead, false)
      ));

    deletedMessages = Number(messageCountResult[0]?.count || 0);

    if (deletedMessages > 0) {
      await db
        .delete(messages)
        .where(and(
          eq(messages.tenantId, tenantId),
          eq(messages.direction, "inbound"),
          eq(messages.isRead, false)
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
