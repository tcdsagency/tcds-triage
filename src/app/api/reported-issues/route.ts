import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { reportedIssues, wrapupDrafts, messages, triageItems } from '@/db/schema';
import { eq, desc, and } from 'drizzle-orm';

/**
 * POST /api/reported-issues
 * Submit a new issue report for debugging
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      itemType,
      itemId,
      issueType,
      description,
      userCorrections,
      errorMessage,
      requestPayload,
      responsePayload,
    } = body;

    if (!itemType || !itemId) {
      return NextResponse.json(
        { error: 'itemType and itemId are required' },
        { status: 400 }
      );
    }

    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant not configured' }, { status: 500 });
    }

    // Get a snapshot of the item for debugging
    let itemSnapshot: Record<string, unknown> | null = null;

    if (itemType === 'wrapup') {
      const wrapup = await db.query.wrapupDrafts.findFirst({
        where: eq(wrapupDrafts.id, itemId),
      });
      if (wrapup) {
        itemSnapshot = wrapup as unknown as Record<string, unknown>;
      }
    } else if (itemType === 'message') {
      const message = await db.query.messages.findFirst({
        where: eq(messages.id, itemId),
      });
      if (message) {
        itemSnapshot = message as unknown as Record<string, unknown>;
      }
    } else if (itemType === 'triage') {
      const triage = await db.query.triageItems.findFirst({
        where: eq(triageItems.id, itemId),
      });
      if (triage) {
        itemSnapshot = triage as unknown as Record<string, unknown>;
      }
    }

    // Create the issue report
    const [report] = await db
      .insert(reportedIssues)
      .values({
        tenantId,
        itemType,
        itemId,
        issueType: issueType || 'general',
        description,
        itemSnapshot,
        userCorrections,
        errorMessage,
        requestPayload,
        responsePayload,
      })
      .returning();

    return NextResponse.json({
      success: true,
      reportId: report.id,
      message: 'Issue reported successfully. This will help us debug and fix the problem.',
    });
  } catch (error) {
    console.error('[Report Issue] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to report issue' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/reported-issues
 * Retrieve issue reports for debugging
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const resolved = searchParams.get('resolved');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200);

    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant not configured' }, { status: 500 });
    }

    // Build query conditions
    const conditions = [eq(reportedIssues.tenantId, tenantId)];
    if (resolved === 'true') {
      conditions.push(eq(reportedIssues.isResolved, true));
    } else if (resolved === 'false') {
      conditions.push(eq(reportedIssues.isResolved, false));
    }

    const issues = await db
      .select()
      .from(reportedIssues)
      .where(and(...conditions))
      .orderBy(desc(reportedIssues.createdAt))
      .limit(limit);

    return NextResponse.json({
      success: true,
      issues,
      count: issues.length,
    });
  } catch (error) {
    console.error('[Get Issues] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get issues' },
      { status: 500 }
    );
  }
}
