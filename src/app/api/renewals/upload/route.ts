/**
 * POST /api/renewals/upload
 * Accept a ZIP file containing IVANS AL3 downloads.
 * Creates a batch record and queues processing.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { renewalBatches } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { queueRenewalBatchProcessing } from '@/lib/queues/client';

const TENANT_ID = process.env.DEFAULT_TENANT_ID || '';
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const uploadedById = formData.get('uploadedById') as string | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { success: false, error: 'File exceeds 100MB limit' },
        { status: 400 }
      );
    }

    // Store file in Supabase Storage (or local for dev)
    const buffer = Buffer.from(await file.arrayBuffer());
    const storagePath = `renewals/${Date.now()}-${file.name}`;

    // For now, we'll process in-memory and store reference
    // In production, upload to Supabase Storage first

    // Create batch record
    const [batch] = await db
      .insert(renewalBatches)
      .values({
        tenantId: TENANT_ID,
        uploadedById: uploadedById || null,
        originalFileName: file.name,
        fileSize: file.size,
        storagePath,
        status: 'uploaded',
      })
      .returning();

    // Queue for processing
    try {
      await queueRenewalBatchProcessing({
        batchId: batch.id,
        tenantId: TENANT_ID,
        storagePath,
        fileBuffer: buffer.toString('base64'), // Pass buffer for in-memory processing
        originalFileName: file.name,
      });
    } catch (queueError) {
      console.error('[Upload] Failed to queue batch processing:', queueError);
      // Update batch status to indicate queue failure
      await db
        .update(renewalBatches)
        .set({
          status: 'failed',
          errorMessage: 'Failed to queue for processing',
          updatedAt: new Date(),
        })
        .where(eq(renewalBatches.id, batch.id));

      return NextResponse.json({
        success: false,
        error: 'File uploaded but processing failed to start. Please try again or contact support.',
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      batchId: batch.id,
      fileName: file.name,
      fileSize: file.size,
    });
  } catch (error) {
    console.error('[API] Error uploading renewal batch:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to upload file' },
      { status: 500 }
    );
  }
}
