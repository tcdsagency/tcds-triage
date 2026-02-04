/**
 * POST /api/renewals/internal/archive
 * Bulk-insert non-renewal AL3 transactions into the archive table (called by worker).
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { al3TransactionArchive } from '@/db/schema';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tenantId, batchId, transactions } = body as {
      tenantId: string;
      batchId: string;
      transactions: Array<{
        transactionType?: string;
        policyNumber?: string;
        carrierCode?: string;
        carrierName?: string;
        lineOfBusiness?: string;
        effectiveDate?: string;
        insuredName?: string;
        al3FileName?: string;
        rawAl3Content?: string;
      }>;
    };

    if (!transactions || transactions.length === 0) {
      console.log(`[Archive] batchId=${batchId} — no transactions to archive`);
      return NextResponse.json({ success: true, archived: 0 });
    }

    const values = transactions.map((t) => ({
      tenantId,
      batchId,
      transactionType: t.transactionType || null,
      policyNumber: t.policyNumber || null,
      carrierCode: t.carrierCode || null,
      carrierName: t.carrierName || null,
      lineOfBusiness: t.lineOfBusiness || null,
      effectiveDate: t.effectiveDate ? new Date(t.effectiveDate) : null,
      insuredName: t.insuredName || null,
      al3FileName: t.al3FileName || null,
      rawAl3Content: t.rawAl3Content || null,
    }));

    await db.insert(al3TransactionArchive).values(values);

    const typeCounts: Record<string, number> = {};
    for (const v of values) {
      const t = v.transactionType || 'UNKNOWN';
      typeCounts[t] = (typeCounts[t] || 0) + 1;
    }
    console.log(`[Archive] batchId=${batchId} — archived ${values.length} non-renewal transactions`, typeCounts);

    return NextResponse.json({ success: true, archived: values.length });
  } catch (error) {
    console.error('[Internal API] Archive error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Archive failed' },
      { status: 500 }
    );
  }
}
