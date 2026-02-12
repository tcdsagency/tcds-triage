import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { serviceTickets } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getAgencyZoomClient } from '@/lib/api/agencyzoom';

/**
 * PATCH /api/service-tickets/{id}/assign
 * Update a service ticket's CSR/assignee in AgencyZoom and local DB
 *
 * Body: { csrId: number, csrName?: string }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { csrId, csrName } = body;

    if (!csrId) {
      return NextResponse.json(
        { success: false, error: 'csrId is required' },
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
      csr: csrId,
    });

    // 3. Update local DB
    await db
      .update(serviceTickets)
      .set({
        csrId,
        csrName: csrName || null,
        updatedAt: new Date(),
      })
      .where(eq(serviceTickets.id, id));

    return NextResponse.json({
      success: true,
      ticket: {
        id,
        csrId,
        csrName,
      },
    });
  } catch (error) {
    console.error('[Service Ticket Assign] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to assign ticket'
      },
      { status: 500 }
    );
  }
}
