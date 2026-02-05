// API Route: /api/gaya/extract
// Upload PDFs for Gaya AI extraction

import { NextRequest, NextResponse } from 'next/server';
import { getGayaClient } from '@/lib/api/gaya';

export const maxDuration = 120; // Allow up to 2 minutes for PDF extraction

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const MAX_FILES = 5;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const files = formData.getAll('file');

    if (!files.length) {
      return NextResponse.json(
        { success: false, error: 'At least one PDF file is required' },
        { status: 400 }
      );
    }

    if (files.length > MAX_FILES) {
      return NextResponse.json(
        { success: false, error: `Maximum ${MAX_FILES} files allowed` },
        { status: 400 }
      );
    }

    // Validate and convert files
    const fileBuffers: { buffer: ArrayBuffer; filename: string }[] = [];

    for (const file of files) {
      if (!(file instanceof File)) {
        return NextResponse.json(
          { success: false, error: 'Invalid file upload' },
          { status: 400 }
        );
      }

      if (!file.type.includes('pdf') && !file.name.toLowerCase().endsWith('.pdf')) {
        return NextResponse.json(
          { success: false, error: `File "${file.name}" is not a PDF` },
          { status: 400 }
        );
      }

      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          { success: false, error: `File "${file.name}" exceeds 50MB limit` },
          { status: 400 }
        );
      }

      const arrayBuffer = await file.arrayBuffer();
      fileBuffers.push({
        buffer: arrayBuffer,
        filename: file.name,
      });
    }

    // Send to Gaya for extraction
    const client = getGayaClient();
    const result = await client.extractPDF(fileBuffers);

    console.log(`[Gaya] Extracted ${result.entities?.length || 0} entities from ${files.length} file(s)`);

    return NextResponse.json({
      success: true,
      entities: result.entities || [],
    });
  } catch (error) {
    console.error('[Gaya] Extract error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to extract from PDF',
      },
      { status: 500 }
    );
  }
}
