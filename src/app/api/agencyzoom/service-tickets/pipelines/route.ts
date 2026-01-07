import { NextRequest, NextResponse } from 'next/server';
import { getAgencyZoomClient } from '@/lib/api/agencyzoom';

/**
 * GET /api/agencyzoom/service-tickets/pipelines
 * Get available service ticket pipelines and stages
 */
export async function GET(request: NextRequest) {
  try {
    const client = getAgencyZoomClient();
    
    const pipelines = await client.getServiceTicketPipelines();

    return NextResponse.json({
      success: true,
      pipelines,
      count: pipelines.length,
    });
  } catch (error) {
    console.error('Get pipelines error:', error);
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
