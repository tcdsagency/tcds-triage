import { NextRequest, NextResponse } from 'next/server';
import { getAgencyZoomClient } from '@/lib/api/agencyzoom';

/**
 * GET /api/agencyzoom/service-tickets
 * Fetch service tickets from AgencyZoom for debugging/testing
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const status = searchParams.get('status'); // 0=removed, 1=active, 2=completed

    const client = getAgencyZoomClient();
    
    const result = await client.getServiceTickets({
      page,
      limit,
      status: status ? parseInt(status) : 1, // Default to active
    });

    return NextResponse.json({
      success: true,
      ...result,
      _debug: {
        page,
        limit,
        status: status || '1 (active)',
      },
    });
  } catch (error) {
    console.error('Service tickets API error:', error);
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        _hint: 'Check AGENCYZOOM_API_USERNAME and AGENCYZOOM_API_PASSWORD env vars'
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/agencyzoom/service-tickets
 * Create a new service ticket
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const { subject, description, customerId, pipelineId, stageId, priorityId, csrId } = body;

    if (!subject || !customerId) {
      return NextResponse.json(
        { error: 'Missing required fields: subject, customerId' },
        { status: 400 }
      );
    }

    const client = getAgencyZoomClient();
    
    // If no pipeline specified, get the first available one
    let targetPipelineId = pipelineId;
    let targetStageId = stageId;
    
    if (!targetPipelineId || !targetStageId) {
      const pipelines = await client.getPipelinesAndStages('service');
      if (pipelines.length === 0) {
        return NextResponse.json(
          { error: 'No service pipelines configured in AgencyZoom' },
          { status: 400 }
        );
      }
      
      const defaultPipeline = pipelines[0];
      targetPipelineId = targetPipelineId || defaultPipeline.id;
      
      // Get first stage of the pipeline
      if (!targetStageId && defaultPipeline.stages && defaultPipeline.stages.length > 0) {
        targetStageId = defaultPipeline.stages[0].id;
      }
    }

    const result = await client.createServiceTicket({
      subject,
      description,
      customerId: parseInt(customerId),
      pipelineId: targetPipelineId,
      stageId: targetStageId,
      priorityId,
      csrId,
    });

    return NextResponse.json({ success: true, ticket: result });
  } catch (error) {
    console.error('Create service ticket error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
