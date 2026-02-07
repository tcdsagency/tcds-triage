/**
 * API Route: /api/policy-creator/documents
 * List all policy creator documents.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { policyCreatorDocuments } from '@/db/schema';
import { desc, eq, and, count } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant not configured' }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    // Build query conditions
    const conditions = [eq(policyCreatorDocuments.tenantId, tenantId)];

    if (status && status !== 'all') {
      conditions.push(
        eq(policyCreatorDocuments.status, status as any)
      );
    }

    // Query documents
    const documents = await db
      .select({
        id: policyCreatorDocuments.id,
        originalFileName: policyCreatorDocuments.originalFileName,
        fileSize: policyCreatorDocuments.fileSize,
        policyNumber: policyCreatorDocuments.policyNumber,
        carrier: policyCreatorDocuments.carrier,
        lineOfBusiness: policyCreatorDocuments.lineOfBusiness,
        effectiveDate: policyCreatorDocuments.effectiveDate,
        expirationDate: policyCreatorDocuments.expirationDate,
        totalPremium: policyCreatorDocuments.totalPremium,
        insuredName: policyCreatorDocuments.insuredName,
        insuredFirstName: policyCreatorDocuments.insuredFirstName,
        insuredLastName: policyCreatorDocuments.insuredLastName,
        status: policyCreatorDocuments.status,
        extractionError: policyCreatorDocuments.extractionError,
        generatedAt: policyCreatorDocuments.generatedAt,
        createdAt: policyCreatorDocuments.createdAt,
        updatedAt: policyCreatorDocuments.updatedAt,
      })
      .from(policyCreatorDocuments)
      .where(and(...conditions))
      .orderBy(desc(policyCreatorDocuments.createdAt))
      .limit(limit)
      .offset(offset);

    // Get total count for pagination
    const countResult = await db
      .select({ count: count() })
      .from(policyCreatorDocuments)
      .where(and(...conditions));

    const total = countResult[0]?.count || 0;

    return NextResponse.json({
      success: true,
      documents,
      total,
      limit,
      offset,
    });
  } catch (error: unknown) {
    console.error('[Policy Creator] List documents error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to list documents';
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
