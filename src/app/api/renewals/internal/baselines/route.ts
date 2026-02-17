/**
 * POST /api/renewals/internal/baselines — Bulk upsert baseline snapshots
 * GET  /api/renewals/internal/baselines — Look up best baseline for a policy
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { renewalBaselines, policies } from '@/db/schema';
import { eq, and, lt, desc } from 'drizzle-orm';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tenantId, batchId, baselines } = body as {
      tenantId: string;
      batchId?: string;
      baselines: Array<{
        policyNumber: string;
        carrierCode: string;
        carrierName?: string;
        lineOfBusiness?: string;
        effectiveDate: string;
        expirationDate?: string;
        insuredName?: string;
        snapshot: Record<string, unknown>;
        rawAl3Content?: string;
        sourceFileName?: string;
      }>;
    };

    if (!baselines || baselines.length === 0) {
      return NextResponse.json({ success: true, stored: 0 });
    }

    // Build a cache of policy lookups to avoid N+1 queries
    const policyCache = new Map<string, { policyId: string; customerId: string } | null>();

    let stored = 0;
    let errors = 0;
    for (const b of baselines) {
      try {
        // Look up policyId/customerId by policy number
        let policyLink = policyCache.get(b.policyNumber);
        if (policyLink === undefined) {
          const [match] = await db
            .select({ id: policies.id, customerId: policies.customerId })
            .from(policies)
            .where(
              and(
                eq(policies.tenantId, tenantId),
                eq(policies.policyNumber, b.policyNumber)
              )
            )
            .limit(1);
          policyLink = match ? { policyId: match.id, customerId: match.customerId } : null;
          policyCache.set(b.policyNumber, policyLink);
        }

        await db
          .insert(renewalBaselines)
          .values({
            tenantId,
            policyNumber: b.policyNumber,
            carrierCode: b.carrierCode,
            carrierName: b.carrierName || null,
            lineOfBusiness: b.lineOfBusiness || null,
            insuredName: b.insuredName || null,
            effectiveDate: new Date(b.effectiveDate),
            expirationDate: b.expirationDate ? new Date(b.expirationDate) : null,
            snapshot: b.snapshot,
            rawAl3Content: b.rawAl3Content || null,
            sourceFileName: b.sourceFileName || null,
            batchId: batchId || null,
            policyId: policyLink?.policyId || null,
            customerId: policyLink?.customerId || null,
          })
          .onConflictDoUpdate({
            target: [
              renewalBaselines.tenantId,
              renewalBaselines.carrierCode,
              renewalBaselines.policyNumber,
              renewalBaselines.effectiveDate,
            ],
            set: {
              carrierName: b.carrierName || null,
              lineOfBusiness: b.lineOfBusiness || null,
              insuredName: b.insuredName || null,
              expirationDate: b.expirationDate ? new Date(b.expirationDate) : null,
              snapshot: b.snapshot,
              rawAl3Content: b.rawAl3Content || null,
              sourceFileName: b.sourceFileName || null,
              batchId: batchId || null,
              policyId: policyLink?.policyId || null,
              customerId: policyLink?.customerId || null,
              updatedAt: new Date(),
            },
          });
        stored++;
      } catch (err) {
        errors++;
        console.error(`[Baselines] Error storing baseline for ${b.policyNumber}:`, err);
      }
    }

    console.log(`[Baselines] Stored ${stored} baselines for tenant ${tenantId}${errors > 0 ? ` (${errors} errors)` : ''}`);
    return NextResponse.json({ success: true, stored });
  } catch (error) {
    console.error('[Internal API] Baselines POST error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Baseline store failed' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');
    const carrierCode = searchParams.get('carrierCode');
    const policyNumber = searchParams.get('policyNumber');
    const beforeDate = searchParams.get('beforeDate');

    if (!tenantId || !carrierCode || !policyNumber || !beforeDate) {
      return NextResponse.json(
        { success: false, error: 'tenantId, carrierCode, policyNumber, and beforeDate are required' },
        { status: 400 }
      );
    }

    const result = await db
      .select()
      .from(renewalBaselines)
      .where(
        and(
          eq(renewalBaselines.tenantId, tenantId),
          eq(renewalBaselines.carrierCode, carrierCode),
          eq(renewalBaselines.policyNumber, policyNumber),
          lt(renewalBaselines.effectiveDate, new Date(beforeDate))
        )
      )
      .orderBy(desc(renewalBaselines.effectiveDate))
      .limit(1);

    if (result.length === 0) {
      return NextResponse.json({ success: false, baseline: null });
    }

    const baseline = result[0];
    return NextResponse.json({
      success: true,
      baseline: {
        snapshot: baseline.snapshot,
        policyId: baseline.policyId,
        customerId: baseline.customerId,
      },
    });
  } catch (error) {
    console.error('[Internal API] Baselines GET error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Baseline lookup failed' },
      { status: 500 }
    );
  }
}
