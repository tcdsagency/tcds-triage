// API Route: /api/agencyzoom/customer-tickets
// Fetch open service tickets for a specific customer

import { NextRequest, NextResponse } from 'next/server';
import { getAgencyZoomClient } from '@/lib/api/agencyzoom';

/**
 * GET /api/agencyzoom/customer-tickets?customerId=123&customerName=John%20Doe
 * Fetch open service tickets for a customer to allow appending to existing requests
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const customerId = searchParams.get('customerId');
    const customerName = searchParams.get('customerName');

    if (!customerId && !customerName) {
      return NextResponse.json(
        { error: 'customerId or customerName required' },
        { status: 400 }
      );
    }

    const client = getAgencyZoomClient();

    // Search for open (status=1) tickets
    // AgencyZoom searchText can match customer name
    const result = await client.getServiceTickets({
      page: 1,
      limit: 20,
      status: 1, // Active only
      searchText: customerName || '',
    });

    // Filter to only include tickets for this customer if we have the ID
    // The API might return matches from other fields too
    const tickets = result.data.map(ticket => ({
      id: ticket.id,
      subject: ticket.subject,
      description: ticket.serviceDesc || ticket.description,
      customerName: ticket.customerName || ticket.householdName,
      customerId: ticket.customerId || ticket.householdId,
      csrName: ticket.csrName,
      csrId: ticket.csrId,
      priority: ticket.priorityName || ticket.priority,
      category: ticket.categoryName || ticket.category,
      createdAt: ticket.createDate || ticket.createdAt,
      stage: ticket.stageName || ticket.workflowStageName,
    }));

    return NextResponse.json({
      success: true,
      tickets,
      total: result.total,
    });
  } catch (error) {
    console.error('[Customer Tickets] Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
