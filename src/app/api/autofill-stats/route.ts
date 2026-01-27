/**
 * Autofill Usage Stats API
 * =========================
 * Records field-level acceptance/edit stats for AI autofill suggestions.
 *
 * POST /api/autofill-stats - Record stats for all fields on form submit
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { autofillUsageStats, serviceRequestExtractions } from '@/db/schema';
import { eq } from 'drizzle-orm';

// =============================================================================
// TYPES
// =============================================================================

interface FieldStat {
  fieldName: 'summary' | 'category' | 'priority' | 'description';
  aiSuggestedValue: string | null;
  aiConfidence: number | null;
  finalValue: string;
  wasAccepted: boolean;
  wasEdited: boolean;
}

interface AutofillStatsRequest {
  wrapupDraftId: string;
  extractionId?: string;
  userId?: string;
  fields: FieldStat[];
  timeToDecisionMs?: number;
}

// =============================================================================
// MAIN HANDLER
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

    const body: AutofillStatsRequest = await request.json();

    // Validate required fields
    if (!body.wrapupDraftId) {
      return NextResponse.json(
        { success: false, error: 'wrapupDraftId is required' },
        { status: 400 }
      );
    }

    if (!body.fields || body.fields.length === 0) {
      return NextResponse.json(
        { success: false, error: 'At least one field stat is required' },
        { status: 400 }
      );
    }

    // Get extraction ID if not provided
    let extractionId = body.extractionId;
    if (!extractionId) {
      const [extraction] = await db
        .select({ id: serviceRequestExtractions.id })
        .from(serviceRequestExtractions)
        .where(eq(serviceRequestExtractions.wrapupDraftId, body.wrapupDraftId))
        .limit(1);
      extractionId = extraction?.id;
    }

    // Insert stats for each field
    const records = body.fields.map((field) => ({
      tenantId,
      wrapupDraftId: body.wrapupDraftId,
      extractionId: extractionId || null,
      userId: body.userId || null,
      fieldName: field.fieldName,
      aiSuggestedValue: field.aiSuggestedValue,
      aiConfidence: field.aiConfidence,
      finalValue: field.finalValue,
      wasAccepted: field.wasAccepted,
      wasEdited: field.wasEdited,
      timeToDecisionMs: body.timeToDecisionMs || null,
    }));

    await db.insert(autofillUsageStats).values(records);

    // Calculate summary stats for response
    const accepted = body.fields.filter(f => f.wasAccepted).length;
    const edited = body.fields.filter(f => f.wasEdited).length;
    const total = body.fields.length;

    return NextResponse.json({
      success: true,
      data: {
        recordsCreated: records.length,
        summary: {
          total,
          accepted,
          edited,
          acceptanceRate: total > 0 ? (accepted / total) * 100 : 0,
        },
      },
    });
  } catch (error) {
    console.error('[Autofill Stats API] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to record autofill stats' },
      { status: 500 }
    );
  }
}

// =============================================================================
// GET - Retrieve aggregate stats (for future analytics dashboard)
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

    // Get aggregate stats by field
    const stats = await db
      .select({
        fieldName: autofillUsageStats.fieldName,
        wasAccepted: autofillUsageStats.wasAccepted,
        wasEdited: autofillUsageStats.wasEdited,
        aiConfidence: autofillUsageStats.aiConfidence,
      })
      .from(autofillUsageStats)
      .where(eq(autofillUsageStats.tenantId, tenantId));

    // Aggregate by field
    const fieldStats: Record<string, {
      total: number;
      accepted: number;
      edited: number;
      avgConfidence: number;
      confidenceSum: number;
    }> = {};

    for (const stat of stats) {
      if (!fieldStats[stat.fieldName]) {
        fieldStats[stat.fieldName] = {
          total: 0,
          accepted: 0,
          edited: 0,
          avgConfidence: 0,
          confidenceSum: 0,
        };
      }

      const field = fieldStats[stat.fieldName];
      field.total++;
      if (stat.wasAccepted) field.accepted++;
      if (stat.wasEdited) field.edited++;
      if (stat.aiConfidence) field.confidenceSum += stat.aiConfidence;
    }

    // Calculate averages
    const result = Object.entries(fieldStats).map(([fieldName, data]) => ({
      fieldName,
      total: data.total,
      accepted: data.accepted,
      edited: data.edited,
      acceptanceRate: data.total > 0 ? (data.accepted / data.total) * 100 : 0,
      avgConfidence: data.total > 0 ? (data.confidenceSum / data.total) * 100 : 0,
    }));

    return NextResponse.json({
      success: true,
      data: {
        totalRecords: stats.length,
        byField: result,
      },
    });
  } catch (error) {
    console.error('[Autofill Stats API] Error getting stats:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get autofill stats' },
      { status: 500 }
    );
  }
}
