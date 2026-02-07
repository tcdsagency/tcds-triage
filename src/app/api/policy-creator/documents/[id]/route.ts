/**
 * API Route: /api/policy-creator/documents/[id]
 * GET, PATCH, DELETE individual documents.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { policyCreatorDocuments } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET - Fetch single document with all details
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant not configured' }, { status: 500 });
    }

    const { id } = await context.params;

    const [document] = await db
      .select()
      .from(policyCreatorDocuments)
      .where(
        and(
          eq(policyCreatorDocuments.id, id),
          eq(policyCreatorDocuments.tenantId, tenantId)
        )
      )
      .limit(1);

    if (!document) {
      return NextResponse.json(
        { success: false, error: 'Document not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      document,
    });
  } catch (error: unknown) {
    console.error('[Policy Creator] Get document error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to get document';
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}

// PATCH - Update document fields
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant not configured' }, { status: 500 });
    }

    const { id } = await context.params;
    const body = await request.json();

    // Allowed fields for update
    const allowedFields = [
      'policyNumber',
      'carrier',
      'carrierNAIC',
      'lineOfBusiness',
      'effectiveDate',
      'expirationDate',
      'totalPremium',
      'transactionType',
      'insuredFirstName',
      'insuredLastName',
      'insuredName',
      'insuredEntityType',
      'insuredAddress',
      'insuredCity',
      'insuredState',
      'insuredZip',
      'insuredPhone',
      'insuredEmail',
      'insuredDOB',
      'coverages',
      'vehicles',
      'drivers',
      'properties',
      'mortgagees',
      'discounts',
      'status',
    ];

    // Build update object with only allowed fields
    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    for (const field of allowedFields) {
      if (field in body) {
        updateData[field] = body[field];
      }
    }

    // If marked as reviewed, update status
    if (body.markReviewed && updateData.status !== 'error') {
      updateData.status = 'reviewed';
    }

    const [updated] = await db
      .update(policyCreatorDocuments)
      .set(updateData)
      .where(
        and(
          eq(policyCreatorDocuments.id, id),
          eq(policyCreatorDocuments.tenantId, tenantId)
        )
      )
      .returning();

    if (!updated) {
      return NextResponse.json(
        { success: false, error: 'Document not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      document: updated,
    });
  } catch (error: unknown) {
    console.error('[Policy Creator] Update document error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to update document';
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}

// DELETE - Remove document
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant not configured' }, { status: 500 });
    }

    const { id } = await context.params;

    const [deleted] = await db
      .delete(policyCreatorDocuments)
      .where(
        and(
          eq(policyCreatorDocuments.id, id),
          eq(policyCreatorDocuments.tenantId, tenantId)
        )
      )
      .returning({ id: policyCreatorDocuments.id });

    if (!deleted) {
      return NextResponse.json(
        { success: false, error: 'Document not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Document deleted',
    });
  } catch (error: unknown) {
    console.error('[Policy Creator] Delete document error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to delete document';
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
