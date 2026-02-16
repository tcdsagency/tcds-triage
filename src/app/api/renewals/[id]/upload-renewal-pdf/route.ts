/**
 * POST /api/renewals/[id]/upload-renewal-pdf
 * Upload a renewal dec page PDF for a pending_manual_renewal comparison.
 * Extracts structured data via Claude and updates the comparison record.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { renewalComparisons } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { pdfToBase64, extractWithClaudePDF, computeConfidenceScores } from '@/lib/pdf/extraction';
import { convertPdfExtractionToRenewalSnapshot } from '@/lib/pdf/to-renewal-snapshot';
import { logRenewalEvent } from '@/lib/api/renewal-audit';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ success: false, error: 'Tenant not configured' }, { status: 500 });
    }

    // Load comparison record
    const [comparison] = await db
      .select()
      .from(renewalComparisons)
      .where(
        and(
          eq(renewalComparisons.id, id),
          eq(renewalComparisons.tenantId, tenantId)
        )
      )
      .limit(1);

    if (!comparison) {
      return NextResponse.json({ success: false, error: 'Comparison not found' }, { status: 404 });
    }

    // Validate status
    if (comparison.status !== 'pending_manual_renewal' && comparison.status !== 'waiting_agent_review') {
      return NextResponse.json(
        { success: false, error: `Cannot upload PDF in status: ${comparison.status}` },
        { status: 400 }
      );
    }

    // Parse form data
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ success: false, error: 'No file provided' }, { status: 400 });
    }

    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      return NextResponse.json({ success: false, error: 'Only PDF files are supported' }, { status: 400 });
    }

    if (file.size > 25 * 1024 * 1024) {
      return NextResponse.json({ success: false, error: 'File size exceeds 25MB limit' }, { status: 400 });
    }

    // Extract data from PDF
    const arrayBuffer = await file.arrayBuffer();
    const pdfBase64 = pdfToBase64(arrayBuffer);
    const extracted = await extractWithClaudePDF(pdfBase64);
    const confidenceScores = computeConfidenceScores(extracted);

    // Convert to RenewalSnapshot
    const renewalSnapshot = convertPdfExtractionToRenewalSnapshot(extracted);

    // Update comparison record
    await db
      .update(renewalComparisons)
      .set({
        renewalSnapshot,
        renewalPremium: extracted.totalPremium?.toString() || null,
        renewalSource: 'pdf_upload',
        // Stay in pending_manual_renewal — agent needs to review + trigger compare
        updatedAt: new Date(),
      })
      .where(eq(renewalComparisons.id, id));

    // Log audit event
    await logRenewalEvent({
      tenantId,
      renewalComparisonId: id,
      eventType: 'ingested',
      eventData: {
        source: 'pdf_upload',
        fileName: file.name,
        fileSize: file.size,
        confidence: confidenceScores.overall,
        extractedPremium: extracted.totalPremium,
        coverageCount: extracted.coverages?.length || 0,
      },
      performedBy: 'agent',
    });

    return NextResponse.json({
      success: true,
      extracted: {
        policyNumber: extracted.policyNumber,
        carrier: extracted.carrier,
        lineOfBusiness: extracted.lineOfBusiness,
        effectiveDate: extracted.effectiveDate,
        expirationDate: extracted.expirationDate,
        totalPremium: extracted.totalPremium,
        insuredName: extracted.insuredName || [extracted.insuredFirstName, extracted.insuredLastName].filter(Boolean).join(' '),
        coverageCount: extracted.coverages?.length || 0,
        vehicleCount: extracted.vehicles?.length || 0,
        driverCount: extracted.drivers?.length || 0,
        mortgageeCount: extracted.mortgagees?.length || 0,
        discountCount: extracted.discounts?.length || 0,
      },
      confidence: confidenceScores,
      renewalSnapshot,
    });
  } catch (error) {
    console.error('[API] upload-renewal-pdf error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 500 }
    );
  }
}
