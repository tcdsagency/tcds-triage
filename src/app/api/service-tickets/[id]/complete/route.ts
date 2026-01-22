/**
 * Complete Service Ticket API
 * POST /api/service-tickets/[id]/complete
 *
 * Marks a service ticket as completed in AgencyZoom
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAgencyZoomClient } from '@/lib/api/agencyzoom';

interface CompleteTicketRequest {
  resolutionId: number;
  resolutionDesc?: string;
  cancelRelatedTasks?: boolean;
}

export async function POST(
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

    const body: CompleteTicketRequest = await request.json();

    if (!body.resolutionId) {
      return NextResponse.json(
        { success: false, error: 'Resolution ID is required' },
        { status: 400 }
      );
    }

    const azClient = getAgencyZoomClient();

    // Complete the ticket by updating status to 2 (completed) with resolution
    const result = await azClient.updateServiceTicket(ticketId, {
      status: 2, // Completed
      resolutionId: body.resolutionId,
      resolutionDesc: body.resolutionDesc,
    });

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: 'Ticket completed successfully',
      });
    } else {
      return NextResponse.json(
        { success: false, error: 'Failed to complete ticket in AgencyZoom' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('[Complete Ticket] Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to complete ticket' },
      { status: 500 }
    );
  }
}
