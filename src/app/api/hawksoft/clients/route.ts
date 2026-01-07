import { NextRequest, NextResponse } from 'next/server';
import { getHawkSoftClient } from '@/lib/api/hawksoft';

/**
 * GET /api/hawksoft/clients
 * Get clients changed since a date, or get specific client by ID
 * 
 * Query params:
 * - id: Get specific client by ID
 * - asOf: Get clients changed since this ISO date
 * - hours: Get clients changed in last N hours (default: 24)
 * - include: Comma-separated list (details,policies,people,contacts,claims,invoices)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const clientId = searchParams.get('id');
    const asOf = searchParams.get('asOf');
    const hours = searchParams.get('hours');
    const include = searchParams.get('include')?.split(',') as any[] | undefined;

    const client = getHawkSoftClient();

    // Get specific client by ID
    if (clientId) {
      const clientData = await client.getClient(
        parseInt(clientId),
        include || ['details', 'policies']
      );
      return NextResponse.json({
        success: true,
        client: clientData,
      });
    }

    // Get changed client IDs
    let changedIds: number[];
    
    if (asOf) {
      changedIds = await client.getChangedClients({ asOf });
    } else {
      const hoursNum = hours ? parseInt(hours) : 24;
      changedIds = await client.getRecentlyChangedClients(hoursNum);
    }

    return NextResponse.json({
      success: true,
      count: changedIds.length,
      clientIds: changedIds,
      _hint: 'Use ?id={clientId} to get full client data, or POST with { clientNumbers: [...] }',
    });
  } catch (error) {
    console.error('HawkSoft clients API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/hawksoft/clients
 * Get multiple clients by ID
 * 
 * Body: { clientNumbers: [1, 2, 3], include?: ['details', 'policies'] }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { clientNumbers, include } = body;

    if (!clientNumbers || !Array.isArray(clientNumbers)) {
      return NextResponse.json(
        { error: 'clientNumbers array is required' },
        { status: 400 }
      );
    }

    const client = getHawkSoftClient();
    
    const clients = await client.getClients(
      clientNumbers,
      include || ['details', 'policies']
    );

    return NextResponse.json({
      success: true,
      count: clients.length,
      clients,
    });
  } catch (error) {
    console.error('HawkSoft clients POST error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
