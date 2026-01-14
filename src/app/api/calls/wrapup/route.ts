import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { wrapupDrafts, calls } from '@/db/schema';
import { eq, and, desc, ne, count } from 'drizzle-orm';

// GET /api/calls/wrapup - Get wrapup drafts queue
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const tenantId = process.env.DEFAULT_TENANT_ID;

    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant not configured' }, { status: 500 });
    }

    const filters = [eq(wrapupDrafts.tenantId, tenantId)];
    if (status && status !== 'all') {
      // Cast status to the enum type
      const validStatuses = ['pending_review', 'pending_ai_processing', 'posted', 'completed'] as const;
      if (validStatuses.includes(status as any)) {
        filters.push(eq(wrapupDrafts.status, status as typeof validStatuses[number]));
      }
    }

    const drafts = await db
      .select({
        id: wrapupDrafts.id,
        callId: wrapupDrafts.callId,
        status: wrapupDrafts.status,
        direction: wrapupDrafts.direction,
        agentName: wrapupDrafts.agentName,
        customerName: wrapupDrafts.customerName,
        customerPhone: wrapupDrafts.customerPhone,
        customerEmail: wrapupDrafts.customerEmail,
        policyNumbers: wrapupDrafts.policyNumbers,
        insuranceType: wrapupDrafts.insuranceType,
        requestType: wrapupDrafts.requestType,
        summary: wrapupDrafts.summary,
        aiCleanedSummary: wrapupDrafts.aiCleanedSummary,
        aiConfidence: wrapupDrafts.aiConfidence,
        aiExtraction: wrapupDrafts.aiExtraction,
        matchStatus: wrapupDrafts.matchStatus,
        trestleData: wrapupDrafts.trestleData,
        reviewerDecision: wrapupDrafts.reviewerDecision,
        outcome: wrapupDrafts.outcome,
        createdAt: wrapupDrafts.createdAt,
        // Join call data
        callFromNumber: calls.fromNumber,
        callToNumber: calls.toNumber,
        callStartedAt: calls.startedAt,
        callDurationSeconds: calls.durationSeconds,
        callTranscription: calls.transcription, // Include actual transcript
      })
      .from(wrapupDrafts)
      .leftJoin(calls, eq(wrapupDrafts.callId, calls.id))
      .where(and(...filters))
      .orderBy(desc(calls.startedAt), desc(wrapupDrafts.createdAt))
      .limit(limit);

    // Transform to expected shape
    const wrapups = drafts.map(d => ({
      id: d.id,
      callId: d.callId,
      status: d.status,
      direction: d.direction,
      agentName: d.agentName,
      customerName: d.customerName,
      customerPhone: d.customerPhone,
      customerEmail: d.customerEmail,
      policyNumbers: d.policyNumbers,
      insuranceType: d.insuranceType,
      requestType: d.requestType,
      summary: d.summary,
      aiCleanedSummary: d.aiCleanedSummary,
      aiConfidence: d.aiConfidence,
      aiExtraction: d.aiExtraction,
      matchStatus: d.matchStatus,
      trestleData: d.trestleData,
      reviewerDecision: d.reviewerDecision,
      outcome: d.outcome,
      createdAt: d.createdAt,
      call: d.callFromNumber ? {
        fromNumber: d.callFromNumber,
        toNumber: d.callToNumber,
        startedAt: d.callStartedAt,
        durationSeconds: d.callDurationSeconds,
        transcription: d.callTranscription, // Include actual transcript
      } : null,
    }));

    // Get counts
    const allDrafts = await db
      .select({ status: wrapupDrafts.status, matchStatus: wrapupDrafts.matchStatus })
      .from(wrapupDrafts)
      .where(eq(wrapupDrafts.tenantId, tenantId));

    const counts = {
      total: allDrafts.length,
      pending_ai_processing: allDrafts.filter(d => d.status === 'pending_ai_processing').length,
      pending_review: allDrafts.filter(d => d.status === 'pending_review').length,
      completed: allDrafts.filter(d => d.status === 'completed').length,
      posted: allDrafts.filter(d => d.status === 'posted').length,
      needs_customer_match: allDrafts.filter(d => d.matchStatus === 'no_match').length,
    };

    return NextResponse.json({
      success: true,
      wrapups,
      drafts: wrapups, // Keep for backwards compat
      counts,
    });
  } catch (error) {
    console.error('Wrapup drafts fetch error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Fetch failed' },
      { status: 500 }
    );
  }
}

// PATCH /api/calls/wrapup - Update a wrapup draft
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const tenantId = process.env.DEFAULT_TENANT_ID;

    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant not configured' }, { status: 500 });
    }

    const { id, action, reviewerId } = body;

    if (!id || !action) {
      return NextResponse.json({ error: 'id and action required' }, { status: 400 });
    }

    let updates: Record<string, any> = { updatedAt: new Date() };

    switch (action) {
      case 'approve':
        updates.status = 'completed';
        updates.reviewerDecision = 'approved';
        updates.reviewerId = reviewerId;
        updates.reviewedAt = new Date();
        break;
      case 'reject':
        updates.status = 'completed';
        updates.reviewerDecision = 'rejected';
        updates.outcome = 'rejected';
        updates.reviewerId = reviewerId;
        updates.reviewedAt = new Date();
        break;
      case 'post_to_az':
        updates.status = 'posted';
        updates.outcome = 'posted_to_agencyzoom';
        break;
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    const [updated] = await db
      .update(wrapupDrafts)
      .set(updates)
      .where(and(eq(wrapupDrafts.tenantId, tenantId), eq(wrapupDrafts.id, id)))
      .returning();

    return NextResponse.json({ success: true, draft: updated });
  } catch (error) {
    console.error('Wrapup draft update error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Update failed' },
      { status: 500 }
    );
  }
}

// DELETE /api/calls/wrapup - Purge wrapup drafts
export async function DELETE(request: NextRequest) {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant not configured' }, { status: 500 });
    }

    const searchParams = request.nextUrl.searchParams;
    const keepCompleted = searchParams.get('keepCompleted') === 'true';

    // Count before delete
    const [{ beforeCount }] = await db
      .select({ beforeCount: count() })
      .from(wrapupDrafts)
      .where(eq(wrapupDrafts.tenantId, tenantId));

    // Delete items
    if (keepCompleted) {
      await db
        .delete(wrapupDrafts)
        .where(
          and(
            eq(wrapupDrafts.tenantId, tenantId),
            ne(wrapupDrafts.status, 'completed')
          )
        );
    } else {
      await db
        .delete(wrapupDrafts)
        .where(eq(wrapupDrafts.tenantId, tenantId));
    }

    // Count after delete
    const [{ afterCount }] = await db
      .select({ afterCount: count() })
      .from(wrapupDrafts)
      .where(eq(wrapupDrafts.tenantId, tenantId));

    const deleted = beforeCount - afterCount;

    return NextResponse.json({
      success: true,
      message: `Purged ${deleted} wrapup drafts`,
      deleted,
      remaining: afterCount,
    });
  } catch (error) {
    console.error('Wrapup purge error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Purge failed' },
      { status: 500 }
    );
  }
}
