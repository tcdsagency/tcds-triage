import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { serviceTickets } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getAgencyZoomClient } from '@/lib/api/agencyzoom';

/**
 * PATCH /api/service-tickets/{id}/stage
 * Update a service ticket's stage in AgencyZoom and local DB
 *
 * Body: { stageId: number, stageName: string }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { stageId, stageName } = body;

    if (!stageId) {
      return NextResponse.json(
        { success: false, error: 'stageId is required' },
        { status: 400 }
      );
    }

    // 1. Get ticket from local DB to get the AgencyZoom ticket ID
    const [ticket] = await db
      .select()
      .from(serviceTickets)
      .where(eq(serviceTickets.id, id))
      .limit(1);

    if (!ticket) {
      return NextResponse.json(
        { success: false, error: 'Service ticket not found' },
        { status: 404 }
      );
    }

    // 2. Update in AgencyZoom
    const client = getAgencyZoomClient();
    await client.updateServiceTicket(ticket.azTicketId, {
      stageId,
    });

    // 3. Update local DB
    await db
      .update(serviceTickets)
      .set({
        stageId,
        stageName: stageName || null,
        updatedAt: new Date(),
      })
      .where(eq(serviceTickets.id, id));

    return NextResponse.json({
      success: true,
      ticket: {
        id,
        stageId,
        stageName,
      },
    });
  } catch (error) {
    console.error('[Service Ticket Stage Update] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update stage'
      },
      { status: 500 }
    );
  }
}
