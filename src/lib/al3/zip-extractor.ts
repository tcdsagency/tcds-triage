/**
 * ZIP Extractor
 * =============
 * Recursively extracts AL3 files from ZIP archives (including nested ZIPs).
 */

import type { ExtractedAL3File } from '@/types/renewal.types';

// =============================================================================
// CONTENT SNIFFING
// =============================================================================

/**
 * Check if content looks like an AL3 file (text-based, has AL3 group codes).
 */
export function isAL3Content(content: string): boolean {
  // AL3 files should have transaction headers (2TRG) or master headers (1MHG)
  return content.includes('1MHG') || content.includes('2TRG');
}

/**
 * Check if a filename looks like an AL3 file.
 */
export function isAL3FileName(fileName: string): boolean {
  const lower = fileName.toLowerCase();
  return (
    lower.endsWith('.al3') ||
    lower.endsWith('.dat') ||
    lower.endsWith('.txt') ||
    lower.endsWith('.asc')
  );
}

/**
 * Check if a buffer starts with a ZIP magic number.
 */
export function isZipBuffer(buffer: Buffer): boolean {
  return buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4b;
}

// =============================================================================
// ZIP EXTRACTION
// =============================================================================

/**
 * Extract AL3 files from a ZIP buffer.
 * Recursively processes nested ZIPs up to maxDepth.
 *
 * Uses the built-in yauzl library for streaming ZIP extraction.
 */
export async function extractAL3FilesFromZip(
  buffer: Buffer,
  maxDepth: number = 3,
  currentDepth: number = 0,
  parentZip?: string
): Promise<ExtractedAL3File[]> {
  if (currentDepth > maxDepth) {
    console.warn(`[ZipExtractor] Max nesting depth (${maxDepth}) reached`);
    return [];
  }

  const yauzl = await import('yauzl');
  const files: ExtractedAL3File[] = [];

  return new Promise((resolve, reject) => {
    yauzl.fromBuffer(buffer, { lazyEntries: true }, (err, zipfile) => {
      if (err || !zipfile) {
        // Not a valid ZIP - check if it's raw AL3 content
        const content = buffer.toString('utf-8');
        if (isAL3Content(content)) {
          resolve([{
            fileName: parentZip || 'raw-content.al3',
            content,
            sourceZip: parentZip,
            nestingDepth: currentDepth,
          }]);
        } else {
          resolve([]);
        }
        return;
      }

      const entries: Promise<ExtractedAL3File[]>[] = [];

      zipfile.readEntry();
      zipfile.on('entry', (entry) => {
        if (/\/$/.test(entry.fileName)) {
          // Directory entry, skip
          zipfile.readEntry();
          return;
        }

        const promise = new Promise<ExtractedAL3File[]>((resolveEntry) => {
          zipfile.openReadStream(entry, (err, readStream) => {
            if (err || !readStream) {
              resolveEntry([]);
              zipfile.readEntry();
              return;
            }

            const chunks: Buffer[] = [];
            readStream.on('data', (chunk: Buffer) => chunks.push(chunk));
            readStream.on('end', async () => {
              const entryBuffer = Buffer.concat(chunks);

              if (isZipBuffer(entryBuffer)) {
                // Nested ZIP - recurse
                const nested = await extractAL3FilesFromZip(
                  entryBuffer,
                  maxDepth,
                  currentDepth + 1,
                  entry.fileName
                );
                resolveEntry(nested);
              } else if (isAL3FileName(entry.fileName)) {
                // AL3 file
                const content = entryBuffer.toString('utf-8');
                if (isAL3Content(content)) {
                  resolveEntry([{
                    fileName: entry.fileName,
                    content,
                    sourceZip: parentZip,
                    nestingDepth: currentDepth,
                  }]);
                } else {
                  resolveEntry([]);
                }
              } else {
                // Try content sniffing for files without AL3 extension
                const content = entryBuffer.toString('utf-8');
                if (isAL3Content(content)) {
                  resolveEntry([{
                    fileName: entry.fileName,
                    content,
                    sourceZip: parentZip,
                    nestingDepth: currentDepth,
                  }]);
                } else {
                  resolveEntry([]);
                }
              }

              zipfile.readEntry();
            });
            readStream.on('error', () => {
              resolveEntry([]);
              zipfile.readEntry();
            });
          });
        });

        entries.push(promise);
      });

      zipfile.on('end', async () => {
        const allEntries = await Promise.all(entries);
        resolve(allEntries.flat());
      });

      zipfile.on('error', (err) => {
        console.error('[ZipExtractor] ZIP error:', err);
        resolve([]);
      });
    });
  });
}
