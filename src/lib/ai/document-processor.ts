/**
 * Document Processor for AI Assistant
 * =====================================
 * Handles text extraction from uploaded files and chunking for vector search.
 */

import { extractText } from "unpdf";
import { redactPII } from "@/lib/format-ticket-description";

// =============================================================================
// TYPES
// =============================================================================

export interface TextChunk {
  index: number;
  content: string;
}

// =============================================================================
// TEXT EXTRACTION
// =============================================================================

/**
 * Extract text content from a file buffer based on MIME type.
 */
export async function extractDocumentText(
  buffer: Buffer,
  mimeType: string
): Promise<{ text: string; pageCount?: number }> {
  if (mimeType === "application/pdf") {
    return extractPdfText(buffer);
  }

  if (mimeType === "text/plain") {
    return { text: buffer.toString("utf-8") };
  }

  throw new Error(`Unsupported file type: ${mimeType}`);
}

async function extractPdfText(
  buffer: Buffer
): Promise<{ text: string; pageCount?: number }> {
  const { text: textPages, totalPages } = await extractText(
    new Uint8Array(buffer)
  );
  const text = Array.isArray(textPages)
    ? textPages.join("\n")
    : String(textPages);

  if (!text || text.length < 20) {
    throw new Error("Could not extract meaningful text from PDF");
  }

  return { text, pageCount: totalPages };
}

// =============================================================================
// CHUNKING
// =============================================================================

/**
 * Split text into overlapping chunks, breaking at paragraph/sentence boundaries.
 * Applies PII redaction to each chunk.
 */
export function chunkText(
  text: string,
  options?: { chunkSize?: number; overlap?: number }
): TextChunk[] {
  const chunkSize = options?.chunkSize ?? 2000;
  const overlap = options?.overlap ?? 200;
  const chunks: TextChunk[] = [];

  if (text.length <= chunkSize) {
    return [{ index: 0, content: redactPII(text) }];
  }

  let start = 0;
  let index = 0;

  while (start < text.length) {
    let end = Math.min(start + chunkSize, text.length);

    // Try to break at a paragraph boundary
    if (end < text.length) {
      const paragraphBreak = text.lastIndexOf("\n\n", end);
      if (paragraphBreak > start + chunkSize * 0.5) {
        end = paragraphBreak + 2;
      } else {
        // Try sentence boundary
        const sentenceBreak = text.lastIndexOf(". ", end);
        if (sentenceBreak > start + chunkSize * 0.5) {
          end = sentenceBreak + 2;
        }
      }
    }

    const chunkContent = text.slice(start, end).trim();
    if (chunkContent.length > 0) {
      chunks.push({ index, content: redactPII(chunkContent) });
      index++;
    }

    // Move start forward, accounting for overlap
    const nextStart = end - overlap;
    // Ensure forward progress to avoid infinite loops
    start = nextStart > start ? nextStart : end;
  }

  return chunks;
}
