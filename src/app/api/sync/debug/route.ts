import { NextRequest, NextResponse } from 'next/server';
import { getAgencyZoomClient } from '@/lib/api/agencyzoom';

// GET /api/sync/debug - See raw AgencyZoom response
export async function GET(request: NextRequest) {
  try {
    const client = getAgencyZoomClient();
    const response = await client.getCustomers({ page: 1, limit: 5 });
    
    return NextResponse.json({
      success: true,
      total: response.total,
      sampleCount: response.data.length,
      // Show raw data with all keys
      rawSamples: response.data.map(c => ({
        allKeys: Object.keys(c),
        raw: c,
      })),
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed',
    }, { status: 500 });
  }
}
