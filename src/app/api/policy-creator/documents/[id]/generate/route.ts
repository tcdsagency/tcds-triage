/**
 * API Route: /api/policy-creator/documents/[id]/generate
 * Generate EZLynx XML from a policy creator document for HawkSoft import.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { policyCreatorDocuments } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { generateEZLynxXML } from '@/lib/ezlynx/emitter';
import type { PolicyCreatorDocument } from '@/types/policy-creator.types';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// Validate document has required fields for EZLynx generation
function validateForEZLynx(doc: PolicyCreatorDocument): { valid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Required fields
  if (!doc.insuredName && !doc.insuredFirstName && !doc.insuredLastName) {
    errors.push('Insured name is required');
  }
  if (!doc.insuredAddress) {
    warnings.push('Address is missing - may need manual entry');
  }
  if (!doc.insuredCity) {
    warnings.push('City is missing');
  }
  if (!doc.insuredState) {
    errors.push('State is required');
  }
  if (!doc.insuredZip) {
    warnings.push('ZIP code is missing');
  }
  if (!doc.effectiveDate) {
    errors.push('Effective date is required');
  }

  // Line of business detection
  const lob = doc.lineOfBusiness?.toLowerCase() || '';
  const isAuto =
    lob.includes('auto') ||
    lob.includes('vehicle') ||
    lob.includes('car') ||
    lob.includes('pauto') ||
    (doc.vehicles && doc.vehicles.length > 0 && !doc.properties?.length);

  if (isAuto) {
    // Auto-specific validation
    if (!doc.vehicles || doc.vehicles.length === 0) {
      errors.push('At least one vehicle is required for auto policies');
    }
    if (!doc.drivers || doc.drivers.length === 0) {
      warnings.push('No drivers found - will need manual entry');
    }
  } else {
    // Home-specific validation
    if (!doc.properties || doc.properties.length === 0) {
      warnings.push('No property details found');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
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

    // Build full name if not present
    let insuredName = document.insuredName;
    if (!insuredName && (document.insuredFirstName || document.insuredLastName)) {
      insuredName = [document.insuredFirstName, document.insuredLastName].filter(Boolean).join(' ');
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
      insuredName: insuredName ?? undefined,
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

    // Step 1: Validate required fields
    const validation = validateForEZLynx(doc);
    if (!validation.valid) {
      return NextResponse.json(
        {
          success: false,
          error: 'Required fields missing',
          errors: validation.errors,
          warnings: validation.warnings,
        },
        { status: 400 }
      );
    }

    // Step 2: Generate EZLynx XML
    const result = generateEZLynxXML(doc);

    // Step 3: Update the document with generated output
    await db
      .update(policyCreatorDocuments)
      .set({
        generatedAL3XML: result.xml, // Store EZLynx XML in this field
        validationErrors: [],
        validationWarnings: validation.warnings,
        generatedAt: new Date(),
        status: 'generated',
        updatedAt: new Date(),
      })
      .where(eq(policyCreatorDocuments.id, id));

    return NextResponse.json({
      success: true,
      xml: result.xml,
      format: result.format,
      filename: result.filename,
      warnings: validation.warnings,
    });
  } catch (error: unknown) {
    console.error('[Policy Creator] Generate EZLynx XML error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to generate EZLynx XML';
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}

// GET - Download the previously generated EZLynx XML
export async function GET(request: NextRequest, context: RouteContext) {
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

    if (!document.generatedAL3XML) {
      return NextResponse.json(
        { success: false, error: 'EZLynx XML has not been generated yet' },
        { status: 404 }
      );
    }

    // Build full name if not present
    let insuredName = document.insuredName;
    if (!insuredName && (document.insuredFirstName || document.insuredLastName)) {
      insuredName = [document.insuredFirstName, document.insuredLastName].filter(Boolean).join(' ');
    }

    // Generate filename
    const safeName = (insuredName || 'Policy')
      .replace(/[^a-zA-Z0-9]/g, '_')
      .replace(/_+/g, '_')
      .substring(0, 50);

    // Detect if home or auto based on LOB
    const lob = document.lineOfBusiness?.toLowerCase() || '';
    const isAuto =
      lob.includes('auto') ||
      lob.includes('vehicle') ||
      lob.includes('car') ||
      lob.includes('pauto');

    const filename = `${safeName}_${isAuto ? 'Auto' : 'Home'}.CMSEZLynxXML`;

    return new NextResponse(document.generatedAL3XML, {
      headers: {
        'Content-Type': 'application/xml',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error: unknown) {
    console.error('[Policy Creator] Download EZLynx XML error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to download EZLynx XML';
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
