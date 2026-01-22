// API Route: /api/sync/service-tickets
// Sync service ticket status from AgencyZoom
// Triggered by cron (every 15 minutes) or on-demand

import { NextRequest, NextResponse } from 'next/server';
import { syncServiceTickets, syncSingleTicket, importTicketsFromAgencyZoom } from '@/lib/api/service-ticket-sync';

// Verify cron authorization
function isAuthorized(request: NextRequest): boolean {
  // Check for Vercel cron header
  if (request.headers.get('x-vercel-cron') === '1') {
    return true;
  }

  // Check for CRON_SECRET authorization
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
    return true;
  }

  // Check for internal call header
  if (request.headers.get('x-internal-call') === 'true') {
    return true;
  }

  return false;
}

// =============================================================================
// POST - Run service ticket sync
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant not configured' }, { status: 500 });
    }

    // Parse options from request body (if any)
    let options: {
      action?: 'sync' | 'import';
      staleMinutes?: number;
      batchSize?: number;
      dryRun?: boolean;
      ticketId?: string;
      // Import options
      status?: number;
      limit?: number;
      pipelineId?: number;
    } = {};
    try {
      const body = await request.json();
      options = body || {};
    } catch {
      // No body or invalid JSON - use defaults
    }

    // Import existing tickets from AgencyZoom
    if (options.action === 'import') {
      const result = await importTicketsFromAgencyZoom({
        tenantId,
        status: options.status,      // 0=removed, 1=active, 2=completed
        limit: options.limit || 100,
        pipelineId: options.pipelineId,
      });
      return NextResponse.json({
        success: true,
        action: 'import',
        ...result,
      });
    }

    // Single ticket sync
    if (options.ticketId) {
      const result = await syncSingleTicket(options.ticketId);
      return NextResponse.json({
        success: result.success,
        updated: result.updated,
        error: result.error,
      });
    }

    // Batch sync (default)
    const result = await syncServiceTickets({
      tenantId,
      staleMinutes: options.staleMinutes || 30,
      batchSize: options.batchSize || 25,
      dryRun: options.dryRun || false,
    });

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('[ServiceTicketSync API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Sync failed' },
      { status: 500 }
    );
  }
}

// =============================================================================
// GET - Cron trigger (Vercel crons use GET)
// =============================================================================

export async function GET(request: NextRequest) {
  // Verify cron authorization
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant not configured' }, { status: 500 });
    }

    console.log('[ServiceTicketSync] Cron triggered');

    const result = await syncServiceTickets({
      tenantId,
      staleMinutes: 30,
      batchSize: 25,
    });

    return NextResponse.json({
      success: true,
      message: 'Service ticket sync completed',
      ...result,
    });
  } catch (error) {
    console.error('[ServiceTicketSync API] Cron error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Sync failed' },
      { status: 500 }
    );
  }
}
