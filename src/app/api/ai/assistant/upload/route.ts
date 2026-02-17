/**
 * API Route: /api/ai/assistant/upload
 * Upload and process documents for AI Assistant document Q&A
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { assistantDocuments } from "@/db/schema";
import { eq } from "drizzle-orm";
import { extractDocumentText, chunkText } from "@/lib/ai/document-processor";
import { getVectorService } from "@/lib/ai/vector-service";

const ALLOWED_TYPES: Record<string, string> = {
  "application/pdf": "pdf",
  "text/plain": "txt",
};

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export async function POST(request: NextRequest) {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    const userId = request.headers.get("x-user-id") || "default";

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: "No file provided" },
        { status: 400 }
      );
    }

    if (!ALLOWED_TYPES[file.type]) {
      return NextResponse.json(
        { success: false, error: "Only PDF and TXT files are supported" },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { success: false, error: "File too large (max 10MB)" },
        { status: 400 }
      );
    }

    // Create document record
    const [doc] = await db
      .insert(assistantDocuments)
      .values({
        tenantId,
        userId,
        filename: file.name,
        fileType: ALLOWED_TYPES[file.type],
        fileSize: file.size,
        status: "processing",
      })
      .returning();

    try {
      // Extract text
      const buffer = Buffer.from(await file.arrayBuffer());
      const { text } = await extractDocumentText(buffer, file.type);

      // Chunk text (PII redaction applied inside chunkText)
      const chunks = chunkText(text);

      // Index each chunk
      const vectorService = getVectorService();
      for (const chunk of chunks) {
        await vectorService.index({
          tenantId,
          type: "document",
          sourceId: doc.id,
          sourceTable: "assistant_documents",
          content: chunk.content,
          metadata: {
            documentId: doc.id,
            documentName: file.name,
            chunkIndex: chunk.index,
            totalChunks: chunks.length,
          },
        });
      }

      // Update document status
      const [updated] = await db
        .update(assistantDocuments)
        .set({ status: "ready", chunkCount: chunks.length })
        .where(eq(assistantDocuments.id, doc.id))
        .returning();

      return NextResponse.json({
        success: true,
        document: {
          id: updated.id,
          filename: updated.filename,
          chunkCount: updated.chunkCount,
          status: updated.status,
        },
      });
    } catch (processingError: any) {
      // Update document status to error
      await db
        .update(assistantDocuments)
        .set({
          status: "error",
          errorMessage: processingError.message || "Processing failed",
        })
        .where(eq(assistantDocuments.id, doc.id));

      console.error("[Assistant Upload] Processing error:", processingError);
      return NextResponse.json(
        {
          success: false,
          error: `Failed to process document: ${processingError.message}`,
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("[Assistant Upload] Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to upload document" },
      { status: 500 }
    );
  }
}
