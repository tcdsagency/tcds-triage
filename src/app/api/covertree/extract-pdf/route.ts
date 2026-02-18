/**
 * POST /api/covertree/extract-pdf
 * Stateless endpoint: accepts a PDF (1003 loan app or appraisal),
 * extracts borrower/property data via Claude, and returns mapped
 * CoverTree form data + confidence score.
 */

import { NextRequest, NextResponse } from 'next/server';
import { pdfToBase64 } from '@/lib/pdf/extraction';
import {
  extractCoverTreePdfData,
  computeOverallConfidence,
  mapExtractionToFormData,
} from '@/lib/pdf/covertree-extraction';

export const maxDuration = 120; // Allow up to 2 minutes for Claude PDF extraction

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      );
    }

    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      return NextResponse.json(
        { success: false, error: 'Only PDF files are supported' },
        { status: 400 }
      );
    }

    if (file.size > 25 * 1024 * 1024) {
      return NextResponse.json(
        { success: false, error: 'File size exceeds 25MB limit' },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const pdfBase64 = pdfToBase64(arrayBuffer);
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
