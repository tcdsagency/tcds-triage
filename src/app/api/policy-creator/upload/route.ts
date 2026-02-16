/**
 * API Route: /api/policy-creator/upload
 * Upload PDF dec pages and extract policy data using Claude Vision.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { policyCreatorDocuments } from '@/db/schema';
import { eq } from 'drizzle-orm';
import {
  pdfToBase64,
  extractWithClaudePDF,
  computeConfidenceScores,
  normalizeCoverage,
  normalizeVehicles,
  normalizeDrivers,
  normalizeProperties,
  normalizeMortgagees,
  normalizeDiscounts,
  normalizeLOB,
  associateCoverages,
} from '@/lib/pdf/extraction';

// =============================================================================
// POST - Upload and Extract
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant not configured' }, { status: 500 });
    }

    // Parse multipart form data
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file type
    if (
      file.type !== 'application/pdf' &&
      !file.name.toLowerCase().endsWith('.pdf')
    ) {
      return NextResponse.json(
        { success: false, error: 'Only PDF files are supported' },
        { status: 400 }
      );
    }

    // Create initial document record
    const [document] = await db
      .insert(policyCreatorDocuments)
      .values({
        tenantId,
        originalFileName: file.name,
        fileSize: file.size,
        status: 'extracting',
      })
      .returning();

    try {
      // Read file content
      const arrayBuffer = await file.arrayBuffer();

      // Convert PDF to base64 for Claude
      const pdfBase64 = pdfToBase64(arrayBuffer);

      // Extract data using Claude's native PDF support
      const extracted = await extractWithClaudePDF(pdfBase64);

      // Compute confidence scores
      const confidenceScores = computeConfidenceScores(extracted);

      // Normalize the extracted data
      const coverages = normalizeCoverage(extracted.coverages);
      const vehicles = normalizeVehicles(extracted.vehicles);
      const drivers = normalizeDrivers(extracted.drivers);
      const properties = normalizeProperties(extracted.properties);
      const mortgagees = normalizeMortgagees(extracted.mortgagees);
      const discounts = normalizeDiscounts(extracted.discounts);

      // Associate coverages with vehicles/properties
      associateCoverages(coverages, vehicles, properties);

      // Update document with extracted data
      const [updated] = await db
        .update(policyCreatorDocuments)
        .set({
          status: 'extracted',
          policyNumber: extracted.policyNumber || null,
          carrier: extracted.carrier || null,
          carrierNAIC: extracted.carrierNAIC || null,
          lineOfBusiness: normalizeLOB(extracted.lineOfBusiness) || null,
          effectiveDate: extracted.effectiveDate || null,
          expirationDate: extracted.expirationDate || null,
          totalPremium: extracted.totalPremium || null,
          transactionType: extracted.transactionType || 'NBS',
          insuredFirstName: extracted.insuredFirstName || null,
          insuredLastName: extracted.insuredLastName || null,
          insuredName: extracted.insuredName || null,
          insuredEntityType: extracted.insuredEntityType || 'P',
          insuredAddress: extracted.insuredAddress || null,
          insuredCity: extracted.insuredCity || null,
          insuredState: extracted.insuredState || null,
          insuredZip: extracted.insuredZip || null,
          insuredPhone: extracted.insuredPhone || null,
          insuredEmail: extracted.insuredEmail || null,
          insuredDOB: extracted.insuredDOB || null,
          coverages: coverages.filter(
            (c) => !c.vehicleNumber && !c.propertyNumber
          ),
          vehicles,
          drivers,
          properties,
          mortgagees,
          discounts,
          confidenceScores,
          rawExtraction: extracted as Record<string, unknown>,
          updatedAt: new Date(),
        })
        .where(
          eq(policyCreatorDocuments.id, document.id)
        )
        .returning();

      return NextResponse.json({
        success: true,
        document: updated,
        message: 'Policy data extracted successfully',
      });
    } catch (extractError: unknown) {
      // Update status to error
      const errorMessage =
        extractError instanceof Error ? extractError.message : 'Extraction failed';

      await db
        .update(policyCreatorDocuments)
        .set({
          status: 'error',
          extractionError: errorMessage,
          updatedAt: new Date(),
        })
        .where(
          eq(policyCreatorDocuments.id, document.id)
        );

      return NextResponse.json(
        {
          success: false,
          error: 'Extraction failed',
          details: errorMessage,
          documentId: document.id,
        },
        { status: 500 }
      );
    }
  } catch (error: unknown) {
    console.error('[Policy Creator] Upload error:', error);
    const errorMessage =
      error instanceof Error ? error.message : 'Upload failed';
    return NextResponse.json(
      { success: false, error: 'Upload failed', details: errorMessage },
      { status: 500 }
    );
  }
}
