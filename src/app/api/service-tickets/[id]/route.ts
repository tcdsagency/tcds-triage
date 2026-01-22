/**
 * Service Ticket API - Single Ticket Operations
 * PATCH /api/service-tickets/[id] - Update a service ticket
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAgencyZoomClient } from '@/lib/api/agencyzoom';

interface UpdateTicketRequest {
  stageId?: number;
  csrId?: number;
  priorityId?: number;
  categoryId?: number;
  dueDate?: string;
  subject?: string;
  description?: string;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const ticketId = parseInt(id);

    if (isNaN(ticketId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid ticket ID' },
        { status: 400 }
      );
    }

    const body: UpdateTicketRequest = await request.json();

    // Validate at least one field is being updated
    const hasUpdates = Object.values(body).some(v => v !== undefined);
    if (!hasUpdates) {
      return NextResponse.json(
        { success: false, error: 'No fields to update' },
        { status: 400 }
      );
    }

    const azClient = getAgencyZoomClient();

    // Build update object
    const updates: Parameters<typeof azClient.updateServiceTicket>[1] = {};

    if (body.stageId !== undefined) updates.stageId = body.stageId;
    if (body.csrId !== undefined) updates.csrId = body.csrId;
    if (body.priorityId !== undefined) updates.priorityId = body.priorityId;
    if (body.categoryId !== undefined) updates.categoryId = body.categoryId;
    if (body.dueDate !== undefined) updates.dueDate = body.dueDate;
    if (body.subject !== undefined) updates.subject = body.subject;
    if (body.description !== undefined) updates.description = body.description;

    const result = await azClient.updateServiceTicket(ticketId, updates);

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: 'Ticket updated successfully',
      });
    } else {
      return NextResponse.json(
        { success: false, error: 'Failed to update ticket in AgencyZoom' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('[Update Ticket] Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to update ticket' },
      { status: 500 }
    );
  }
}
