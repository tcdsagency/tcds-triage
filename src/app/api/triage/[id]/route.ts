// API Route: /api/triage/[id]
// Individual triage item actions - supports same actions as pending-review
// Actions: claim, complete, cancel, note, ticket, ncm, skip, void

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { triageItems, messages, customers } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getAgencyZoomClient } from "@/lib/api/agencyzoom";

// NCM (No Customer Match) customer ID in AgencyZoom
const NCM_CUSTOMER_ID = process.env.NCM_CUSTOMER_ID || '0';

// =============================================================================
// TYPES
// =============================================================================

interface ActionRequest {
  action: 'claim' | 'complete' | 'cancel' | 'note' | 'ticket' | 'ncm' | 'skip' | 'void' | 'escalate';
  userId?: string;
  resolution?: string;
  reason?: string;
  customerId?: string;
  isLead?: boolean;
  noteContent?: string;
  ticketDetails?: {
    subject?: string;
    description?: string;
    priority?: 'low' | 'medium' | 'high';
    assigneeAgentId?: number;
  };
}

// =============================================================================
// HELPERS
// =============================================================================

function formatNoteText(
  content: string,
  metadata?: {
    phone?: string;
    requestType?: string;
    callerName?: string;
  }
): string {
  const timestamp = new Date().toLocaleString("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "America/Chicago",
  });

  const lines = ["After-Hours Call Note:", content, ""];

  if (metadata?.callerName) {
    lines.push(`Caller: ${metadata.callerName}`);
  }
  if (metadata?.phone) {
    lines.push(`Phone: ${metadata.phone}`);
  }
  if (metadata?.requestType) {
    lines.push(`Request Type: ${metadata.requestType}`);
  }

  lines.push(`Date/Time: ${timestamp}`);

  return lines.join("\n");
}

// =============================================================================
// POST - Perform Action on Triage Item
// =============================================================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body: ActionRequest = await request.json();
    const { action, userId, resolution, reason, customerId, isLead, noteContent, ticketDetails } = body;

    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    // First try to find in triageItems table
    const triageItem = await db.query.triageItems.findFirst({
      where: and(
        eq(triageItems.id, id),
        eq(triageItems.tenantId, tenantId)
      ),
    });

    // Also try messages table for backwards compatibility
    const message = !triageItem ? await db.query.messages.findFirst({
      where: and(
        eq(messages.id, id),
        eq(messages.tenantId, tenantId),
        eq(messages.isAfterHours, true)
      ),
    }) : null;

    if (!triageItem && !message) {
      return NextResponse.json(
        { success: false, error: "Item not found" },
        { status: 404 }
      );
    }

    // Get item details for actions
    const itemPhone = triageItem
      ? (await getPhoneFromTriageItem(triageItem.messageId))
      : message?.fromNumber;
    const itemBody = triageItem?.description || message?.body || '';
    const itemTitle = triageItem?.title || message?.contactName || 'Unknown Caller';

    // =======================================================================
    // HANDLE ACTIONS
    // =======================================================================

    const now = new Date();
    let result: { success: boolean; action: string; message?: string; noteId?: number; ticketId?: number } =
      { success: false, action };

    // Get AgencyZoom client for note/ticket/ncm actions
    const azClient = ['note', 'ticket', 'ncm'].includes(action)
      ? await getAgencyZoomClient()
      : null;

    switch (action) {
      // ----- Basic Status Actions -----
      case 'claim':
        if (triageItem) {
          await db.update(triageItems).set({
            status: 'in_progress',
            assignedToId: userId,
            assignedAt: now,
            updatedAt: now,
          }).where(eq(triageItems.id, id));
        }
        if (message) {
          await db.update(messages).set({
            acknowledgedById: userId,
          }).where(eq(messages.id, id));
        }
        result = { success: true, action: 'claim', message: 'Item claimed' };
        break;

      case 'complete':
        if (triageItem) {
          await db.update(triageItems).set({
            status: 'completed',
            resolvedAt: now,
            resolvedById: userId,
            resolution: resolution || 'Completed',
            updatedAt: now,
          }).where(eq(triageItems.id, id));
        }
        if (message) {
          await db.update(messages).set({
            isAcknowledged: true,
            acknowledgedById: userId,
            acknowledgedAt: now,
          }).where(eq(messages.id, id));
        }
        result = { success: true, action: 'complete', message: 'Item completed' };
        break;

      case 'cancel':
      case 'void':
        if (triageItem) {
          await db.update(triageItems).set({
            status: 'cancelled',
            resolvedAt: now,
            resolvedById: userId,
            resolution: reason || 'Cancelled/Voided',
            updatedAt: now,
          }).where(eq(triageItems.id, id));
        }
        if (message) {
          await db.update(messages).set({
            isAcknowledged: true,
            acknowledgedById: userId,
            acknowledgedAt: now,
          }).where(eq(messages.id, id));
        }
        result = { success: true, action, message: 'Item voided' };
        break;

      case 'skip':
        if (triageItem) {
          await db.update(triageItems).set({
            status: 'completed',
            resolvedAt: now,
            resolution: 'Skipped',
            updatedAt: now,
          }).where(eq(triageItems.id, id));
        }
        if (message) {
          await db.update(messages).set({
            isAcknowledged: true,
            acknowledgedAt: now,
          }).where(eq(messages.id, id));
        }
        result = { success: true, action: 'skip', message: 'Item skipped' };
        break;

      case 'escalate':
        if (triageItem) {
          await db.update(triageItems).set({
            status: 'escalated',
            priority: 'urgent',
            updatedAt: now,
          }).where(eq(triageItems.id, id));
        }
        result = { success: true, action: 'escalate', message: 'Item escalated' };
        break;

      // ----- Note Action -----
      case 'note':
        if (!customerId) {
          return NextResponse.json({ error: "Customer ID required for note" }, { status: 400 });
        }
        if (!azClient) {
          return NextResponse.json({ error: "AgencyZoom not configured" }, { status: 500 });
        }

        const noteText = formatNoteText(noteContent || itemBody, {
          phone: itemPhone || undefined,
          callerName: itemTitle,
          requestType: 'After Hours Call',
        });

        const noteResult = isLead
          ? await azClient.addLeadNote(parseInt(customerId), noteText)
          : await azClient.addNote(parseInt(customerId), noteText);

        if (noteResult.success) {
          // Mark as completed
          if (triageItem) {
            await db.update(triageItems).set({
              status: 'completed',
              customerId: await getInternalCustomerId(customerId),
              resolvedAt: now,
              resolution: 'Note posted to AgencyZoom',
              updatedAt: now,
            }).where(eq(triageItems.id, id));
          }
          if (message) {
            await db.update(messages).set({
              isAcknowledged: true,
              acknowledgedAt: now,
              contactId: customerId,
            }).where(eq(messages.id, id));
          }
          result = { success: true, action: 'note', noteId: noteResult.id };
        } else {
          return NextResponse.json({ error: "Failed to post note" }, { status: 500 });
        }
        break;

      // ----- Service Request/Ticket Action -----
      case 'ticket':
        if (!customerId) {
          return NextResponse.json({ error: "Customer ID required for service request" }, { status: 400 });
        }

        const ticketPayload = {
          customerId: customerId,
          customerName: itemTitle,
          customerEmail: null,
          customerPhone: itemPhone,
          customerType: isLead ? 'lead' : 'customer',
          summary: noteContent || itemBody,
          serviceRequestTypeName: 'After Hours Callback',
          assigneeAgentId: ticketDetails?.assigneeAgentId || 94007,
        };

        const baseUrl = process.env.NEXT_PUBLIC_APP_URL ||
          (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://tcds-triage.vercel.app');

        const ticketResponse = await fetch(`${baseUrl}/api/service-request`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(ticketPayload),
        });

        const ticketResult = await ticketResponse.json();
        if (ticketResult.success) {
          if (triageItem) {
            await db.update(triageItems).set({
              status: 'completed',
              customerId: await getInternalCustomerId(customerId),
              resolvedAt: now,
              resolution: 'Service request created',
              updatedAt: now,
            }).where(eq(triageItems.id, id));
          }
          if (message) {
            await db.update(messages).set({
              isAcknowledged: true,
              acknowledgedAt: now,
              contactId: customerId,
            }).where(eq(messages.id, id));
          }
          result = { success: true, action: 'ticket', ticketId: ticketResult.ticketId };
        } else {
          return NextResponse.json({ error: ticketResult.error || "Failed to create service request" }, { status: 500 });
        }
        break;

      // ----- NCM (No Customer Match) Action -----
      case 'ncm':
        if (!NCM_CUSTOMER_ID || NCM_CUSTOMER_ID === '0') {
          return NextResponse.json({
            error: "NCM customer not configured. Please set NCM_CUSTOMER_ID environment variable."
          }, { status: 500 });
        }

        const ncmDescription = [
          noteContent || itemBody,
          '',
          '--- Caller Information ---',
          `Name: ${itemTitle}`,
          `Phone: ${itemPhone || 'Unknown'}`,
          '',
          '--- Call Details ---',
          'Type: After-Hours Call',
          `Date/Time: ${now.toLocaleString('en-US', { timeZone: 'America/Chicago' })}`,
        ].join('\n');

        const ncmPayload = {
          customerId: NCM_CUSTOMER_ID,
          customerName: itemTitle,
          customerEmail: null,
          customerPhone: itemPhone,
          customerType: 'customer',
          summary: ncmDescription,
          serviceRequestTypeName: 'NCM: After Hours Call',
          assigneeAgentId: ticketDetails?.assigneeAgentId || 94007,
        };

        const ncmBaseUrl = process.env.NEXT_PUBLIC_APP_URL ||
          (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://tcds-triage.vercel.app');

        const ncmResponse = await fetch(`${ncmBaseUrl}/api/service-request`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(ncmPayload),
        });

        const ncmResult = await ncmResponse.json();
        if (ncmResult.success) {
          if (triageItem) {
            await db.update(triageItems).set({
              status: 'completed',
              resolvedAt: now,
              resolution: 'Posted to No Customer Match queue',
              updatedAt: now,
            }).where(eq(triageItems.id, id));
          }
          if (message) {
            await db.update(messages).set({
              isAcknowledged: true,
              acknowledgedAt: now,
            }).where(eq(messages.id, id));
          }
          result = { success: true, action: 'ncm', ticketId: ncmResult.ticketId };
        } else {
          return NextResponse.json({ error: ncmResult.error || "Failed to create NCM service request" }, { status: 500 });
        }
        break;

      default:
        return NextResponse.json(
          { success: false, error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("[Triage] Action error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Action failed" },
      { status: 500 }
    );
  }
}

// =============================================================================
// HELPERS
// =============================================================================

async function getPhoneFromTriageItem(messageId: string | null): Promise<string | null> {
  if (!messageId) return null;
  const msg = await db.query.messages.findFirst({
    where: eq(messages.id, messageId),
    columns: { fromNumber: true },
  });
  return msg?.fromNumber || null;
}

async function getInternalCustomerId(agencyzoomId: string): Promise<string | null> {
  const customer = await db.query.customers.findFirst({
    where: eq(customers.agencyzoomId, agencyzoomId),
    columns: { id: true },
  });
  return customer?.id || null;
}

// =============================================================================
// GET - Get Single Triage Item
// =============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const tenantId = process.env.DEFAULT_TENANT_ID;

    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    // Try triageItems first
    const triageItem = await db.query.triageItems.findFirst({
      where: and(
        eq(triageItems.id, id),
        eq(triageItems.tenantId, tenantId)
      ),
      with: {
        customer: true,
        assignedTo: true,
      },
    });

    if (triageItem) {
      return NextResponse.json({ success: true, item: triageItem });
    }

    // Fall back to messages
    const message = await db.query.messages.findFirst({
      where: and(
        eq(messages.id, id),
        eq(messages.tenantId, tenantId),
        eq(messages.isAfterHours, true)
      ),
    });

    if (message) {
      return NextResponse.json({ success: true, item: message });
    }

    return NextResponse.json(
      { success: false, error: "Item not found" },
      { status: 404 }
    );
  } catch (error) {
    console.error("[Triage] GET error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Fetch failed" },
      { status: 500 }
    );
  }
}
