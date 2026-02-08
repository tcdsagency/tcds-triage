/**
 * API Route: /api/policy-creator/documents/[id]/generate
 * Generate AL3-XML from a policy creator document.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { policyCreatorDocuments } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { generateAL3XMLValidated, generateAL3XMLFilename, validateForAL3 } from '@/lib/al3/xml-wrapper';
import type { PolicyCreatorDocument } from '@/types/policy-creator.types';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant not configured' }, { status: 500 });
    }

    const { id } = await context.params;

    // Fetch the document
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

    // Convert database document to PolicyCreatorDocument type
    const doc: PolicyCreatorDocument = {
      id: document.id,
      tenantId: document.tenantId,
      originalFileName: document.originalFileName,
      fileSize: document.fileSize ?? undefined,
      policyNumber: document.policyNumber ?? undefined,
      carrier: document.carrier ?? undefined,
      carrierNAIC: document.carrierNAIC ?? undefined,
      lineOfBusiness: document.lineOfBusiness as PolicyCreatorDocument['lineOfBusiness'],
      effectiveDate: document.effectiveDate ?? undefined,
      expirationDate: document.expirationDate ?? undefined,
      totalPremium: document.totalPremium ?? undefined,
      transactionType: document.transactionType ?? undefined,
      insuredFirstName: document.insuredFirstName ?? undefined,
      insuredLastName: document.insuredLastName ?? undefined,
      insuredName: document.insuredName ?? undefined,
      insuredEntityType: document.insuredEntityType as 'P' | 'C' | undefined,
      insuredAddress: document.insuredAddress ?? undefined,
      insuredCity: document.insuredCity ?? undefined,
      insuredState: document.insuredState ?? undefined,
      insuredZip: document.insuredZip ?? undefined,
      insuredPhone: document.insuredPhone ?? undefined,
      insuredEmail: document.insuredEmail ?? undefined,
      insuredDOB: document.insuredDOB ?? undefined,
      coverages: document.coverages as PolicyCreatorDocument['coverages'],
      vehicles: document.vehicles as PolicyCreatorDocument['vehicles'],
      drivers: document.drivers as PolicyCreatorDocument['drivers'],
      properties: document.properties as PolicyCreatorDocument['properties'],
      mortgagees: document.mortgagees as PolicyCreatorDocument['mortgagees'],
      discounts: document.discounts as PolicyCreatorDocument['discounts'],
      status: document.status as PolicyCreatorDocument['status'],
      confidenceScores: document.confidenceScores as PolicyCreatorDocument['confidenceScores'],
      extractionError: document.extractionError ?? undefined,
      rawExtraction: document.rawExtraction as PolicyCreatorDocument['rawExtraction'],
      generatedAL3Raw: document.generatedAL3Raw ?? undefined,
      generatedAL3XML: document.generatedAL3XML ?? undefined,
      validationErrors: document.validationErrors as string[] | undefined,
      validationWarnings: document.validationWarnings as string[] | undefined,
      generatedAt: document.generatedAt?.toISOString(),
      createdAt: document.createdAt.toISOString(),
      updatedAt: document.updatedAt.toISOString(),
    };

    // Step 1: Basic document validation (required fields)
    const preValidation = validateForAL3(doc);
    if (!preValidation.valid) {
      return NextResponse.json(
        {
          success: false,
          error: 'Required fields missing',
          errors: preValidation.errors,
          warnings: preValidation.warnings,
        },
        { status: 400 }
      );
    }

    // Step 2: Generate AL3-XML with compiler validation (Gate E)
    const generateResult = generateAL3XMLValidated(doc);
    const filename = generateAL3XMLFilename(doc);

    // Combine all errors and warnings
    const allErrors: string[] = [
      ...generateResult.compilerErrors.map((e) => `[${e.groupCode}${e.field ? '.' + e.field : ''}] ${e.message}`),
      ...generateResult.roundTripErrors,
    ];
    const allWarnings: string[] = [
      ...preValidation.warnings,
      ...generateResult.compilerWarnings,
      ...generateResult.roundTripWarnings,
    ];

    // Step 3: Block if compiler validation failed
    if (!generateResult.valid) {
      // Still save the raw AL3 and errors for debugging
      await db
        .update(policyCreatorDocuments)
        .set({
          generatedAL3Raw: generateResult.rawAL3,
          validationErrors: allErrors,
          validationWarnings: allWarnings,
          status: 'error',
          updatedAt: new Date(),
        })
        .where(eq(policyCreatorDocuments.id, id));

      return NextResponse.json(
        {
          success: false,
          error: 'AL3 compiler validation failed (Gate E)',
          errors: allErrors,
          warnings: allWarnings,
          recordCount: generateResult.recordCount,
          // Include raw AL3 for debugging
          rawAL3Preview: generateResult.rawAL3.substring(0, 500) + '...',
        },
        { status: 400 }
      );
    }

    // Step 4: Update the document with generated output
    await db
      .update(policyCreatorDocuments)
      .set({
        generatedAL3Raw: generateResult.rawAL3,
        generatedAL3XML: generateResult.al3xml,
        validationErrors: [], // Clear any previous errors
        validationWarnings: allWarnings,
        generatedAt: new Date(),
        status: 'generated',
        updatedAt: new Date(),
      })
      .where(eq(policyCreatorDocuments.id, id));

    return NextResponse.json({
      success: true,
      al3xml: generateResult.al3xml,
      filename,
      recordCount: generateResult.recordCount,
      warnings: allWarnings,
    });
  } catch (error: unknown) {
    console.error('[Policy Creator] Generate AL3-XML error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to generate AL3-XML';
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}

// GET - Download the previously generated AL3
// Query params:
//   format=xml (default) - Download AL3-XML wrapped format
//   format=raw - Download raw AL3 (plain text, fixed-width records)
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant not configured' }, { status: 500 });
    }

    const { id } = await context.params;
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'xml';

    // Fetch the document
    const [document] = await db
      .select({
        generatedAL3Raw: policyCreatorDocuments.generatedAL3Raw,
        generatedAL3XML: policyCreatorDocuments.generatedAL3XML,
        carrier: policyCreatorDocuments.carrier,
        policyNumber: policyCreatorDocuments.policyNumber,
      })
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

    // Generate base filename
    const carrier = (document.carrier ?? 'UNKNOWN')
      .replace(/[^a-zA-Z0-9]/g, '_')
      .toUpperCase()
      .substring(0, 20);
    const policyNum = (document.policyNumber ?? 'NEW')
      .replace(/[^a-zA-Z0-9]/g, '')
      .toUpperCase()
      .substring(0, 20);
    const date = new Date().toISOString().substring(0, 10).replace(/-/g, '');

    // Return based on format
    if (format === 'raw') {
      // Raw AL3 format (plain text, fixed-width records)
      if (!document.generatedAL3Raw) {
        return NextResponse.json(
          { success: false, error: 'AL3 has not been generated yet' },
          { status: 404 }
        );
      }
      const filename = `${carrier}_${policyNum}_${date}.al3`;
      return new NextResponse(document.generatedAL3Raw, {
        headers: {
          'Content-Type': 'text/plain',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      });
    } else {
      // XML format (default)
      if (!document.generatedAL3XML) {
        return NextResponse.json(
          { success: false, error: 'AL3-XML has not been generated yet' },
          { status: 404 }
        );
      }
      const filename = `${carrier}_${policyNum}_${date}.al3.xml`;
      return new NextResponse(document.generatedAL3XML, {
        headers: {
          'Content-Type': 'application/xml',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      });
    }
  } catch (error: unknown) {
    console.error('[Policy Creator] Download AL3-XML error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to download AL3-XML';
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
