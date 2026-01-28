/**
 * AI Corrections API
 * ==================
 * Endpoints for recording and analyzing agent corrections to AI-extracted data.
 *
 * POST /api/ai-corrections - Record corrections from a wrapup
 * GET /api/ai-corrections - List corrections with filters
 * GET /api/ai-corrections/stats - Get correction statistics
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { aiCorrections, wrapupDrafts, users } from '@/db/schema';
import { eq, desc, and, gte, sql, count } from 'drizzle-orm';

// =============================================================================
// TYPES
// =============================================================================

interface CorrectionInput {
  fieldName: string;
  aiValue: string | null;
  agentValue: string | null;
  correctionType: 'wrong_value' | 'missing_value' | 'extra_value' | 'format_issue' | 'context_error';
}

interface CreateCorrectionsRequest {
  wrapupDraftId: string;
  callId?: string;
  corrections: CorrectionInput[];
  transcriptExcerpt?: string;
  fullTranscript?: string;
}

// =============================================================================
// POST - Record corrections
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json(
        { success: false, error: 'Tenant not configured' },
        { status: 500 }
      );
    }

    const body: CreateCorrectionsRequest = await request.json();

    // Validate required fields
    if (!body.wrapupDraftId) {
      return NextResponse.json(
        { success: false, error: 'wrapupDraftId is required' },
        { status: 400 }
      );
    }

    if (!body.corrections || body.corrections.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No corrections provided' },
        { status: 400 }
      );
    }

    // Verify the wrapup exists
    const [wrapup] = await db
      .select({ id: wrapupDrafts.id, callId: wrapupDrafts.callId })
      .from(wrapupDrafts)
      .where(eq(wrapupDrafts.id, body.wrapupDraftId))
      .limit(1);

    if (!wrapup) {
      return NextResponse.json(
        { success: false, error: 'Wrapup not found' },
        { status: 404 }
      );
    }

    // TODO: Get current user ID from auth when auth is implemented
    const correctedById = null;

    // Insert correction records
    const correctionRecords = body.corrections.map((correction) => ({
      tenantId,
      wrapupDraftId: body.wrapupDraftId,
      callId: body.callId || wrapup.callId || undefined,
      fieldName: correction.fieldName,
      aiValue: correction.aiValue,
      agentValue: correction.agentValue,
      correctionType: correction.correctionType as 'wrong_value' | 'missing_value' | 'extra_value' | 'format_issue' | 'context_error',
      transcriptExcerpt: body.transcriptExcerpt,
      fullTranscript: body.fullTranscript,
      correctedById,
    }));

    const insertedCorrections = await db
      .insert(aiCorrections)
      .values(correctionRecords)
      .returning({ id: aiCorrections.id });

    // Update wrapup with correction tracking
    await db
      .update(wrapupDrafts)
      .set({
        hasCorrections: true,
        correctionCount: body.corrections.length,
        updatedAt: new Date(),
      })
      .where(eq(wrapupDrafts.id, body.wrapupDraftId));

    console.log(`[AI-Corrections] Recorded ${insertedCorrections.length} corrections for wrapup ${body.wrapupDraftId}`);

    return NextResponse.json({
      success: true,
      data: {
        correctionCount: insertedCorrections.length,
        correctionIds: insertedCorrections.map((c) => c.id),
      },
    });
  } catch (error) {
    console.error('[AI-Corrections] Error recording corrections:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to record corrections' },
      { status: 500 }
    );
  }
}

// =============================================================================
// GET - List corrections with filters
// =============================================================================

export async function GET(request: NextRequest) {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json(
        { success: false, error: 'Tenant not configured' },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(request.url);

    // Parse query parameters
    const fieldName = searchParams.get('fieldName');
    const correctionType = searchParams.get('correctionType');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const usedInEvaluation = searchParams.get('usedInEvaluation');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 500);
    const offset = parseInt(searchParams.get('offset') || '0');

    // Check if this is a stats request
    if (searchParams.get('stats') === 'true') {
      return getStats(tenantId, startDate);
    }

    // Build query conditions
    const conditions = [eq(aiCorrections.tenantId, tenantId)];

    if (fieldName) {
      conditions.push(eq(aiCorrections.fieldName, fieldName));
    }

    if (correctionType) {
      conditions.push(
        eq(aiCorrections.correctionType, correctionType as any)
      );
    }

    if (startDate) {
      conditions.push(gte(aiCorrections.correctedAt, new Date(startDate)));
    }

    if (usedInEvaluation === 'false') {
      conditions.push(eq(aiCorrections.usedInEvaluation, false));
    } else if (usedInEvaluation === 'true') {
      conditions.push(eq(aiCorrections.usedInEvaluation, true));
    }

    // Query corrections
    const corrections = await db
      .select({
        id: aiCorrections.id,
        fieldName: aiCorrections.fieldName,
        aiValue: aiCorrections.aiValue,
        agentValue: aiCorrections.agentValue,
        correctionType: aiCorrections.correctionType,
        correctedAt: aiCorrections.correctedAt,
        usedInEvaluation: aiCorrections.usedInEvaluation,
        wrapupDraftId: aiCorrections.wrapupDraftId,
        transcriptExcerpt: aiCorrections.transcriptExcerpt,
      })
      .from(aiCorrections)
      .where(and(...conditions))
      .orderBy(desc(aiCorrections.correctedAt))
      .limit(limit)
      .offset(offset);

    // Get total count for pagination
    const [countResult] = await db
      .select({ total: count() })
      .from(aiCorrections)
      .where(and(...conditions));

    return NextResponse.json({
      success: true,
      data: {
        corrections,
        pagination: {
          total: countResult.total,
          limit,
          offset,
          hasMore: offset + corrections.length < countResult.total,
        },
      },
    });
  } catch (error) {
    console.error('[AI-Corrections] Error listing corrections:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to list corrections' },
      { status: 500 }
    );
  }
}

// =============================================================================
// STATS HELPER
// =============================================================================

async function getStats(tenantId: string, startDate: string | null) {
  try {
    const conditions = [eq(aiCorrections.tenantId, tenantId)];

    if (startDate) {
      conditions.push(gte(aiCorrections.correctedAt, new Date(startDate)));
    } else {
      // Default to last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      conditions.push(gte(aiCorrections.correctedAt, thirtyDaysAgo));
    }

    // Total corrections
    const [totalResult] = await db
      .select({ total: count() })
      .from(aiCorrections)
      .where(and(...conditions));

    // Corrections by field
    const byField = await db
      .select({
        fieldName: aiCorrections.fieldName,
        count: count(),
      })
      .from(aiCorrections)
      .where(and(...conditions))
      .groupBy(aiCorrections.fieldName)
      .orderBy(desc(count()));

    // Corrections by type
    const byType = await db
      .select({
        correctionType: aiCorrections.correctionType,
        count: count(),
      })
      .from(aiCorrections)
      .where(and(...conditions))
      .groupBy(aiCorrections.correctionType)
      .orderBy(desc(count()));

    // Daily trend (last 14 days)
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

    const dailyTrend = await db
      .select({
        date: sql<string>`DATE(${aiCorrections.correctedAt})`.as('date'),
        count: count(),
      })
      .from(aiCorrections)
      .where(
        and(
          eq(aiCorrections.tenantId, tenantId),
          gte(aiCorrections.correctedAt, fourteenDaysAgo)
        )
      )
      .groupBy(sql`DATE(${aiCorrections.correctedAt})`)
      .orderBy(sql`DATE(${aiCorrections.correctedAt})`);

    // Most corrected AI values (to identify patterns)
    const topMistakes = await db
      .select({
        fieldName: aiCorrections.fieldName,
        aiValue: aiCorrections.aiValue,
        count: count(),
      })
      .from(aiCorrections)
      .where(and(...conditions))
      .groupBy(aiCorrections.fieldName, aiCorrections.aiValue)
      .orderBy(desc(count()))
      .limit(10);

    // Calculate accuracy per field (assuming 100 wrapups per field)
    // This is a rough approximation - in production, we'd track total extractions
    const fieldAccuracies: Record<string, number> = {};
    const estimatedTotalPerField = 100; // Placeholder - should be tracked
    for (const field of byField) {
      const errorRate = field.count / estimatedTotalPerField;
      fieldAccuracies[field.fieldName] = Math.max(0, 1 - errorRate);
    }

    return NextResponse.json({
      success: true,
      data: {
        totalCorrections: totalResult.total,
        byField: byField.map((f) => ({
          field: f.fieldName,
          count: f.count,
        })),
        byType: byType.map((t) => ({
          type: t.correctionType,
          count: t.count,
        })),
        dailyTrend: dailyTrend.map((d) => ({
          date: d.date,
          count: d.count,
        })),
        topMistakes: topMistakes.map((m) => ({
          field: m.fieldName,
          aiValue: m.aiValue?.substring(0, 50),
          count: m.count,
        })),
        estimatedFieldAccuracies: fieldAccuracies,
      },
    });
  } catch (error) {
    console.error('[AI-Corrections] Error getting stats:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get stats' },
      { status: 500 }
    );
  }
}
