// API Route: /api/triage
// Triage queue API for after-hours calls and service items
// Used by the After-Hours Queue page

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { triageItems, messages, customers, users } from "@/db/schema";
import { eq, and, desc, inArray, or, isNull } from "drizzle-orm";

// =============================================================================
// TYPES
// =============================================================================

interface TriageItemResponse {
  id: string;
  type: string;
  status: string;
  priority: string;
  title: string;
  description?: string;
  aiSummary?: string;
  aiPriorityScore: number | null;
  aiPriorityReason?: string;
  customerId?: string;
  callId?: string;
  messageId?: string;
  customer?: {
    id: string;
    name: string;
    phone?: string;
    email?: string;
  } | null;
  assignedTo?: {
    id: string;
    name: string;
  } | null;
  dueAt?: string;
  slaBreached: boolean;
  createdAt: string;
  ageMinutes: number;
  // After-hours specific fields
  messageType?: 'call' | 'voicemail' | 'sms';
  autoReplySent?: boolean;
  autoReplyMessage?: string;
  transcript?: string;
}

// =============================================================================
// GET - List Triage Items
// =============================================================================

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const typeFilter = searchParams.get('type'); // after_hours, call, quote, etc.
    const statusFilter = searchParams.get('status'); // pending, in_progress, completed
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200);

    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    const now = new Date();
    const items: TriageItemResponse[] = [];

    // =======================================================================
    // 1. Fetch from triageItems table
    // =======================================================================
    const whereConditions = [eq(triageItems.tenantId, tenantId)];

    if (typeFilter) {
      whereConditions.push(eq(triageItems.type, typeFilter as any));
    }

    if (statusFilter) {
      whereConditions.push(eq(triageItems.status, statusFilter as any));
    }

    const triageResults = await db
      .select({
        id: triageItems.id,
        type: triageItems.type,
        status: triageItems.status,
        priority: triageItems.priority,
        title: triageItems.title,
        description: triageItems.description,
        aiSummary: triageItems.aiSummary,
        aiPriorityScore: triageItems.aiPriorityScore,
        aiPriorityReason: triageItems.aiPriorityReason,
        customerId: triageItems.customerId,
        callId: triageItems.callId,
        messageId: triageItems.messageId,
        assignedToId: triageItems.assignedToId,
        dueAt: triageItems.dueAt,
        slaBreached: triageItems.slaBreached,
        createdAt: triageItems.createdAt,
      })
      .from(triageItems)
      .where(and(...whereConditions))
      .orderBy(desc(triageItems.createdAt))
      .limit(limit);

    // Get customer and user details for triage items
    const customerIds = triageResults.map(t => t.customerId).filter(Boolean) as string[];
    const userIds = triageResults.map(t => t.assignedToId).filter(Boolean) as string[];
    const messageIds = triageResults.map(t => t.messageId).filter(Boolean) as string[];

    const [customerMap, userMap, messageMap] = await Promise.all([
      customerIds.length > 0
        ? db.select({ id: customers.id, firstName: customers.firstName, lastName: customers.lastName, phone: customers.phone, email: customers.email })
            .from(customers)
            .where(inArray(customers.id, customerIds))
            .then(rows => new Map(rows.map(c => [c.id, c])))
        : new Map(),
      userIds.length > 0
        ? db.select({ id: users.id, firstName: users.firstName, lastName: users.lastName })
            .from(users)
            .where(inArray(users.id, userIds))
            .then(rows => new Map(rows.map(u => [u.id, u])))
        : new Map(),
      messageIds.length > 0
        ? db.select({ id: messages.id, body: messages.body, afterHoursAutoReplySent: messages.afterHoursAutoReplySent })
            .from(messages)
            .where(inArray(messages.id, messageIds))
            .then(rows => new Map(rows.map(m => [m.id, m])))
        : new Map(),
    ]);

    for (const t of triageResults) {
      const customer = t.customerId ? customerMap.get(t.customerId) : null;
      const assignedUser = t.assignedToId ? userMap.get(t.assignedToId) : null;
      const message = t.messageId ? messageMap.get(t.messageId) : null;
      const ageMinutes = Math.floor((now.getTime() - new Date(t.createdAt).getTime()) / 60000);

      items.push({
        id: t.id,
        type: t.type,
        status: t.status || 'pending',
        priority: t.priority || 'medium',
        title: t.title,
        description: t.description || undefined,
        aiSummary: t.aiSummary || undefined,
        aiPriorityScore: t.aiPriorityScore ? parseFloat(t.aiPriorityScore) : null,
        aiPriorityReason: t.aiPriorityReason || undefined,
        customerId: t.customerId || undefined,
        callId: t.callId || undefined,
        messageId: t.messageId || undefined,
        customer: customer ? {
          id: customer.id,
          name: `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || 'Unknown',
          phone: customer.phone || undefined,
          email: customer.email || undefined,
        } : null,
        assignedTo: assignedUser ? {
          id: assignedUser.id,
          name: `${assignedUser.firstName || ''} ${assignedUser.lastName || ''}`.trim() || 'Unknown',
        } : null,
        dueAt: t.dueAt?.toISOString(),
        slaBreached: t.slaBreached || false,
        createdAt: t.createdAt.toISOString(),
        ageMinutes,
        messageType: t.type === 'after_hours' ? 'call' : undefined,
        autoReplySent: message?.afterHoursAutoReplySent || false,
        transcript: message?.body || undefined,
      });
    }

    // =======================================================================
    // 2. Also fetch from messages table (for backwards compatibility)
    //    Only if filtering by after_hours type
    // =======================================================================
    if (typeFilter === 'after_hours' || !typeFilter) {
      const msgWhereConditions = [
        eq(messages.tenantId, tenantId),
        eq(messages.isAfterHours, true),
      ];

      // Only show unacknowledged messages as "pending"
      if (statusFilter === 'pending' || !statusFilter) {
        msgWhereConditions.push(
          or(eq(messages.isAcknowledged, false), isNull(messages.isAcknowledged))!
        );
      } else if (statusFilter === 'completed') {
        msgWhereConditions.push(eq(messages.isAcknowledged, true));
      }

      const afterHoursMessages = await db
        .select({
          id: messages.id,
          fromNumber: messages.fromNumber,
          toNumber: messages.toNumber,
          body: messages.body,
          contactName: messages.contactName,
          contactId: messages.contactId,
          customerId: messages.customerId,
          isAcknowledged: messages.isAcknowledged,
          afterHoursAutoReplySent: messages.afterHoursAutoReplySent,
          createdAt: messages.createdAt,
        })
        .from(messages)
        .where(and(...msgWhereConditions))
        .orderBy(desc(messages.createdAt))
        .limit(limit);

      // Get customer details for messages
      const msgCustomerIds = afterHoursMessages
        .map(m => m.customerId)
        .filter(Boolean) as string[];

      const msgCustomerMap = msgCustomerIds.length > 0
        ? await db.select({ id: customers.id, firstName: customers.firstName, lastName: customers.lastName, phone: customers.phone, email: customers.email })
            .from(customers)
            .where(inArray(customers.id, msgCustomerIds))
            .then(rows => new Map(rows.map(c => [c.id, c])))
        : new Map();

      for (const m of afterHoursMessages) {
        // Skip if we already have a triage item for this message
        if (items.some(i => i.messageId === m.id)) continue;

        const customer = m.customerId ? msgCustomerMap.get(m.customerId) : null;
        const ageMinutes = Math.floor((now.getTime() - new Date(m.createdAt).getTime()) / 60000);

        // Determine message type from content
        let messageType: 'call' | 'voicemail' | 'sms' = 'call';
        const bodyLower = (m.body || '').toLowerCase();
        if (bodyLower.includes('voicemail:') || bodyLower.includes('voicemail transcript')) {
          messageType = 'voicemail';
        } else if (!bodyLower.includes('email:') && !bodyLower.includes('summary:')) {
          messageType = 'sms';
        }

        // Extract summary from body if it starts with "Summary:"
        let aiSummary: string | undefined;
        let transcript: string | undefined;
        const summaryMatch = m.body?.match(/^Summary:\s*([\s\S]+?)(?:\n\n|$)/);
        if (summaryMatch) {
          aiSummary = summaryMatch[1].trim();
        }
        // Extract email/reason content
        const emailMatch = m.body?.match(/Email:\s*([\s\S]+?)(?:\n\nAction Items:|$)/);
        if (emailMatch) {
          transcript = emailMatch[1].trim();
        } else {
          transcript = m.body || undefined;
        }

        // Determine priority from content
        let priority = 'medium';
        if (bodyLower.includes('[urgent') || bodyLower.includes('urgent:') ||
            bodyLower.includes('accident') || bodyLower.includes('claim') ||
            bodyLower.includes('emergency')) {
          priority = 'urgent';
        }

        items.push({
          id: m.id,
          type: 'after_hours',
          status: m.isAcknowledged ? 'completed' : 'pending',
          priority,
          title: m.fromNumber || 'Unknown Caller',
          description: transcript,
          aiSummary,
          aiPriorityScore: null,
          aiPriorityReason: undefined,
          customerId: m.customerId || undefined,
          customer: customer ? {
            id: customer.id,
            name: `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || 'Unknown',
            phone: customer.phone || m.fromNumber || undefined,
            email: customer.email || undefined,
          } : m.contactName ? {
            id: m.contactId || m.id,
            name: m.contactName,
            phone: m.fromNumber || undefined,
          } : null,
          assignedTo: null,
          dueAt: undefined,
          slaBreached: ageMinutes > 480, // 8 hours
          createdAt: m.createdAt.toISOString(),
          ageMinutes,
          messageType,
          autoReplySent: m.afterHoursAutoReplySent || false,
          transcript,
        });
      }
    }

    // Sort all items by creation date (newest first)
    items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // Apply final limit
    const limitedItems = items.slice(0, limit);

    return NextResponse.json({
      success: true,
      items: limitedItems,
      counts: {
        total: items.length,
        pending: items.filter(i => i.status === 'pending').length,
        inProgress: items.filter(i => i.status === 'in_progress').length,
        completed: items.filter(i => i.status === 'completed').length,
      },
    });
  } catch (error) {
    console.error("[Triage] GET error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Fetch failed" },
      { status: 500 }
    );
  }
}
