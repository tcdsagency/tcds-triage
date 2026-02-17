/**
 * One-time reprocess script: Re-run comparisons using AL3 baselines
 * instead of HawkSoft baselines to eliminate false positives.
 *
 * Usage: npx tsx scripts/tmp-reprocess-with-al3-baselines.ts
 */

import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env.production.local') });

import { db } from '../src/db';
import { renewalComparisons, renewalBaselines } from '../src/db/schema';
import { eq, and, lt, desc, inArray } from 'drizzle-orm';
import { compareSnapshots } from '../src/lib/al3/comparison-engine';
import { runCheckEngine, buildCheckSummary } from '../src/lib/al3/check-rules/check-engine';

async function main() {
  console.log('=== Reprocess Comparisons with AL3 Baselines ===\n');

  // Find all comparisons that are waiting for agent review
  const comparisons = await db
    .select()
    .from(renewalComparisons)
    .where(
      inArray(renewalComparisons.status, ['waiting_agent_review', 'comparison_ready'])
    );

  console.log(`Found ${comparisons.length} comparisons to reprocess\n`);

  let updated = 0;
  let skipped = 0;
  let falsePositivesEliminated = 0;

  for (const comp of comparisons) {
    const policyNumber = comp.policyNumber;
    const carrierName = comp.carrierName;
    const effectiveDate = comp.renewalEffectiveDate;

    if (!policyNumber || !effectiveDate) {
      console.log(`  SKIP: ${policyNumber} — missing policy number or effective date`);
      skipped++;
      continue;
    }

    // Look up AL3 baseline: most recent baseline where effectiveDate < renewal's effectiveDate
    // We need to find by carrierCode, but comparisons store carrierName. Try to find baseline by policyNumber.
    const baseline = await db
      .select()
      .from(renewalBaselines)
      .where(
        and(
          eq(renewalBaselines.tenantId, comp.tenantId),
          eq(renewalBaselines.policyNumber, policyNumber),
          lt(renewalBaselines.effectiveDate, effectiveDate)
        )
      )
      .orderBy(desc(renewalBaselines.effectiveDate))
      .limit(1);

    if (baseline.length === 0) {
      console.log(`  SKIP: ${policyNumber} — no AL3 baseline found`);
      skipped++;
      continue;
    }

    const al3Baseline = baseline[0];
    const renewalSnapshot = comp.renewalSnapshot as Record<string, any>;
    const baselineSnapshot = al3Baseline.snapshot as Record<string, any>;

    if (!renewalSnapshot || !baselineSnapshot) {
      console.log(`  SKIP: ${policyNumber} — missing snapshot data`);
      skipped++;
      continue;
    }

    // Re-run comparison engine
    const result = compareSnapshots(
      renewalSnapshot,
      baselineSnapshot,
      undefined,
      effectiveDate.toISOString()
    );

    // Re-run check engine
    let checkEngineResult = null;
    let checkSummary = null;
    try {
      checkEngineResult = runCheckEngine(
        renewalSnapshot,
        baselineSnapshot,
        result,
        comp.lineOfBusiness || '',
        carrierName || ''
      );
      checkSummary = buildCheckSummary(checkEngineResult);
    } catch (err) {
      console.warn(`  WARN: Check engine failed for ${policyNumber}:`, err);
    }

    const oldChangesCount = (comp.materialChanges as any[])?.length || 0;
    const newChangesCount = result.materialChanges.length;

    // Update the comparison record
    await db
      .update(renewalComparisons)
      .set({
        baselineSnapshot,
        currentPremium: baselineSnapshot.premium?.toString() || null,
        materialChanges: result.materialChanges,
        recommendation: result.recommendation as any,
        comparisonSummary: {
          ...result.summary,
          baselineSource: 'al3_baseline',
          baselineStatus: 'prior_term',
          baselineStatusReason: 'Baseline from prior-term AL3 file (apples-to-apples)',
        },
        premiumChangeAmount: result.summary?.premiumChange?.amount?.toString() || null,
        premiumChangePercent: result.summary?.premiumChange?.percent?.toString() || null,
        checkResults: checkEngineResult?.checkResults || null,
        checkSummary: checkSummary || null,
        updatedAt: new Date(),
      })
      .where(eq(renewalComparisons.id, comp.id));

    const eliminated = Math.max(0, oldChangesCount - newChangesCount);
    falsePositivesEliminated += eliminated;

    console.log(`  UPDATED: ${policyNumber} (${carrierName}) — changes: ${oldChangesCount} → ${newChangesCount} (${eliminated > 0 ? `-${eliminated} false positives` : 'no change'})`);
    updated++;
  }

  console.log('\n=== Summary ===');
  console.log(`Total comparisons: ${comparisons.length}`);
  console.log(`Updated with AL3 baseline: ${updated}`);
  console.log(`Skipped (no baseline): ${skipped}`);
  console.log(`False positives eliminated: ${falsePositivesEliminated}`);

  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
