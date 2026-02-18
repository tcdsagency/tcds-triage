/**
 * POST /api/covertree/extract-pdf
 * Stateless endpoint: accepts a PDF as base64 JSON,
 * extracts borrower/property data via Claude, and returns mapped
 * CoverTree form data + confidence score.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  extractCoverTreePdfData,
  computeOverallConfidence,
  mapExtractionToFormData,
} from '@/lib/pdf/covertree-extraction';

export const maxDuration = 120; // Allow up to 2 minutes for Claude PDF extraction

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { pdfBase64 } = body as { pdfBase64?: string };

    if (!pdfBase64) {
      return NextResponse.json(
        { success: false, error: 'No PDF data provided' },
        { status: 400 }
      );
    }

    // Rough size check (base64 is ~33% larger than raw)
    const estimatedBytes = (pdfBase64.length * 3) / 4;
    if (estimatedBytes > 25 * 1024 * 1024) {
      return NextResponse.json(
        { success: false, error: 'File size exceeds 25MB limit' },
        { status: 400 }
      );
    }

    const extracted = await extractCoverTreePdfData(pdfBase64);
    const confidence = computeOverallConfidence(extracted);
    const mappedFormData = mapExtractionToFormData(extracted);

    return NextResponse.json({
      success: true,
      formData: mappedFormData,
      confidence,
      raw: extracted,
    });
  } catch (error) {
    console.error('[API] covertree/extract-pdf error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Extraction failed',
      },
      { status: 500 }
    );
  }
}
