/**
 * POST /api/renewals/internal/parse
 * Parse AL3 content and return transactions/snapshots (called by worker).
 *
 * Accepts:
 *   { action: 'extract-zip', fileBuffer: string (base64) }
 *   { action: 'parse-file', content: string }
 *   { action: 'filter-renewals', transactions: any[] }
 *   { action: 'build-snapshot', transaction: any }
 */

import { NextRequest, NextResponse } from 'next/server';
import { extractAL3FilesFromZip } from '@/lib/al3/zip-extractor';
import { parseAL3File } from '@/lib/al3/parser';
import { filterRenewalTransactions, deduplicateRenewals, partitionTransactions } from '@/lib/al3/filter';
import { buildRenewalSnapshot } from '@/lib/al3/snapshot-builder';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    switch (body.action) {
      case 'extract-zip': {
        const buffer = Buffer.from(body.fileBuffer, 'base64');
        const files = await extractAL3FilesFromZip(buffer);
        return NextResponse.json({
          success: true,
          files: files.map((f) => ({ fileName: f.fileName, content: f.content })),
        });
      }

      case 'parse-file': {
        const transactions = parseAL3File(body.content);
        return NextResponse.json({ success: true, transactions });
      }

      case 'filter-renewals': {
        const renewals = filterRenewalTransactions(body.transactions);
        const { unique, duplicatesRemoved } = deduplicateRenewals(renewals);
        return NextResponse.json({ success: true, unique, duplicatesRemoved });
      }

      case 'partition-transactions': {
        const { renewals, nonRenewals } = partitionTransactions(body.transactions);
        const { unique, duplicatesRemoved } = deduplicateRenewals(renewals);
        return NextResponse.json({ success: true, unique, duplicatesRemoved, nonRenewals });
      }

      case 'build-snapshot': {
        const snapshot = buildRenewalSnapshot(body.transaction);
        return NextResponse.json({ success: true, snapshot });
      }

      default:
        return NextResponse.json({ success: false, error: `Unknown action: ${body.action}` }, { status: 400 });
    }
  } catch (error) {
    console.error('[Internal API] Parse error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Parse failed' },
      { status: 500 }
    );
  }
}
