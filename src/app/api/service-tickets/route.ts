/**
 * Service Tickets API
 * POST /api/service-tickets - Create a new service ticket from triage
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { serviceTickets, wrapupDrafts, messages } from '@/db/schema';
import { eq, inArray } from 'drizzle-orm';
import { getAgencyZoomClient } from '@/lib/api/agencyzoom';
import {
  SERVICE_PIPELINES,
  SERVICE_PRIORITIES,
  SERVICE_CATEGORIES,
} from '@/lib/api/agencyzoom-service-tickets';

// Priority name lookup
const PRIORITY_NAMES: Record<number, string> = {
  [SERVICE_PRIORITIES.URGENT]: 'Urgent',
  [SERVICE_PRIORITIES.TWO_HOUR]: '2 Hour',
  [SERVICE_PRIORITIES.STANDARD]: 'Standard',
};

// Category name lookup (simplified - just the most common ones)
// Note: GENERAL_SERVICE and SERVICE_QUESTION have the same ID (37345)
const CATEGORY_NAMES: Record<number, string> = {
  [SERVICE_CATEGORIES.SERVICE_QUESTION]: 'Service Question',
  [SERVICE_CATEGORIES.CLAIMS_FILED]: 'Claims - Filed',
  [SERVICE_CATEGORIES.CLAIMS_NOT_FILED]: 'Claims - Not Filed',
  [SERVICE_CATEGORIES.CLAIMS_STATUS]: 'Claims - Status',
  [SERVICE_CATEGORIES.CLAIMS_PAYMENT]: 'Claims - Payment',
  [SERVICE_CATEGORIES.CLAIMS_CONSULT]: 'Claims - Consult',
  [SERVICE_CATEGORIES.SERVICE_DRIVER]: '+/- Driver',
  [SERVICE_CATEGORIES.SERVICE_VEHICLE]: '+/- Vehicle',
  [SERVICE_CATEGORIES.SERVICE_PROPERTY]: '+/- Property',
  [SERVICE_CATEGORIES.SERVICE_INSURED]: '+/- Insured',
  [SERVICE_CATEGORIES.SERVICE_LIENHOLDER]: '+/- Lienholder',
  [SERVICE_CATEGORIES.SERVICE_COVERAGE_CHANGE]: 'Coverage Change',
  [SERVICE_CATEGORIES.SERVICE_BILLING_QUESTIONS]: 'Billing Question',
  [SERVICE_CATEGORIES.SERVICE_BILLING_PAYMENTS]: 'Billing Payment',
  [SERVICE_CATEGORIES.SERVICE_BILLING_CHANGES]: 'Billing Changes',
  [SERVICE_CATEGORIES.SERVICE_ID_CARDS]: 'ID Cards',
  [SERVICE_CATEGORIES.SERVICE_COI]: 'Certificate of Insurance',
  [SERVICE_CATEGORIES.SERVICE_LOSS_RUN]: 'Loss Run',
  [SERVICE_CATEGORIES.SERVICE_CLIENT_CANCELLING]: 'Client Cancelling',
  [SERVICE_CATEGORIES.SERVICE_PENDING_CANCELLATION]: 'Pending Cancellation',
  [SERVICE_CATEGORIES.SERVICE_CARRIER_REQUEST]: 'Carrier Request',
  [SERVICE_CATEGORIES.SERVICE_REMARKET]: 'Remarket',
  [SERVICE_CATEGORIES.QUOTE_REQUEST]: 'Quote Request',
};

// Stage names
const STAGE_NAMES: Record<number, string> = {
  111160: 'New',
  111161: 'In Progress',
  111162: 'Waiting on Info',
};

interface CreateTicketRequest {
  // Triage item reference (optional for manual tickets)
  triageItemId?: string;
  triageItemType?: 'wrapup' | 'message' | 'manual';
  messageIds?: string[];

  // Ticket details
  subject: string;
  customerId: number;
  customerName: string;
  categoryId: number;
  priorityId: number;
  assigneeId: number;
  stageId: number;
  dueDate?: string;
  description?: string;

  // Reviewer
  reviewerId?: string;
}

export async function POST(request: NextRequest) {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ success: false, error: 'Tenant not configured' }, { status: 500 });
    }

    const body: CreateTicketRequest = await request.json();

    // Validate required fields
    if (!body.subject || !body.customerId || !body.assigneeId) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }

    // For non-manual tickets, require triage item reference
    const isManualTicket = body.triageItemType === 'manual' || !body.triageItemType;
    if (!isManualTicket && !body.triageItemId) {
      return NextResponse.json({ success: false, error: 'Missing triage item reference' }, { status: 400 });
    }

    // Create AgencyZoom client
    const azClient = getAgencyZoomClient();

    // First, post a note with the description/summary
    let noteId: number | undefined;
    if (body.description) {
      const noteText = `Service Ticket Created\n\n${body.description}\n\nCreated via Triage Pipeline`;
      const noteResult = await azClient.addNote(body.customerId, noteText);
      if (noteResult.success) {
        noteId = noteResult.id;
      }
    }

    // Create ticket in AgencyZoom
    const ticketResult = await azClient.createServiceTicket({
      subject: body.subject,
      description: body.description,
      customerId: body.customerId,
      pipelineId: SERVICE_PIPELINES.POLICY_SERVICE,
      stageId: body.stageId,
      priorityId: body.priorityId,
      categoryId: body.categoryId,
      csrId: body.assigneeId,
      dueDate: body.dueDate,
    });

    if (!ticketResult.success || !ticketResult.serviceTicketId) {
      console.error('[Service Tickets] AgencyZoom create failed:', JSON.stringify(ticketResult, null, 2));
      console.error('[Service Tickets] Request payload was:', JSON.stringify({
        subject: body.subject,
        customerId: body.customerId,
        pipelineId: SERVICE_PIPELINES.POLICY_SERVICE,
        stageId: body.stageId,
        priorityId: body.priorityId,
        categoryId: body.categoryId,
        csrId: body.assigneeId,
      }, null, 2));
      const errorMsg = (ticketResult as any)?.error || (ticketResult as any)?.message || 'Failed to create ticket in AgencyZoom';
      return NextResponse.json({ success: false, error: errorMsg, details: ticketResult }, { status: 500 });
    }

    const azTicketId = ticketResult.serviceTicketId;

    // Save to local database
    const [newTicket] = await db
      .insert(serviceTickets)
      .values({
        tenantId,
        azTicketId,
        azHouseholdId: body.customerId,
        wrapupDraftId: body.triageItemType === 'wrapup' && body.triageItemId ? body.triageItemId : null,
        subject: body.subject,
        description: body.description,
        status: 'active',
        pipelineId: SERVICE_PIPELINES.POLICY_SERVICE,
        pipelineName: 'Policy Service Pipeline',
        stageId: body.stageId,
        stageName: STAGE_NAMES[body.stageId] || 'New',
        categoryId: body.categoryId,
        categoryName: CATEGORY_NAMES[body.categoryId] || 'General Service',
        priorityId: body.priorityId,
        priorityName: PRIORITY_NAMES[body.priorityId] || 'Standard',
        csrId: body.assigneeId,
        csrName: null, // Will be filled by sync or we could add it to the request
        dueDate: body.dueDate || null,
        azCreatedAt: new Date(),
      })
      .returning();

    // Mark triage item as completed (skip for manual tickets)
    if (!isManualTicket && body.triageItemId) {
      if (body.triageItemType === 'wrapup') {
        await db
          .update(wrapupDrafts)
          .set({
            status: 'completed',
            reviewerDecision: 'approved',
            outcome: 'ticket_created',
            agencyzoomNoteId: noteId?.toString(),
            agencyzoomTicketId: azTicketId.toString(),
            completedAt: new Date(),
            reviewerId: body.reviewerId,
            reviewedAt: new Date(),
          })
          .where(eq(wrapupDrafts.id, body.triageItemId));
      } else if (body.triageItemType === 'message') {
        // Mark all related messages as acknowledged
        const messageIdsToAck = body.messageIds?.length ? body.messageIds : [body.triageItemId];

        await db
          .update(messages)
          .set({
            isAcknowledged: true,
            acknowledgedAt: new Date(),
            acknowledgedById: body.reviewerId,
          })
          .where(inArray(messages.id, messageIdsToAck));
      }
    }

    return NextResponse.json({
      success: true,
      ticketId: newTicket.id,
      azTicketId,
    });
  } catch (error) {
    console.error('[Service Tickets] Error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
