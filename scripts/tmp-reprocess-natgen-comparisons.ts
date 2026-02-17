/**
 * Reprocess NatGen/Integon comparisons using the updated AL3 baselines.
 *
 * Usage: npx tsx scripts/tmp-reprocess-natgen-comparisons.ts
 */

import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env.production.local') });

async function main() {
  const { db } = await import('../src/db');
  const { renewalComparisons, renewalBaselines } = await import('../src/db/schema');
  const { eq, and, lt, desc, inArray, ilike, or, sql } = await import('drizzle-orm');
  const { compareSnapshots } = await import('../src/lib/al3/comparison-engine');
  const { runCheckEngine, buildCheckSummary } = await import('../src/lib/al3/check-rules/check-engine');

  console.log('=== Reprocess NatGen Comparisons with Updated Baselines ===\n');

  // Find NatGen/Integon comparisons
  const comparisons = await db
    .select()
    .from(renewalComparisons)
    .where(
      and(
        inArray(renewalComparisons.status, ['waiting_agent_review', 'comparison_ready', 'pending_manual_renewal']),
        or(
          ilike(renewalComparisons.carrierName, '%National General%'),
          ilike(renewalComparisons.carrierName, '%Integon%'),
          ilike(renewalComparisons.carrierName, '%Imperial Fire%')
        )
      )
    );

  console.log(`Found ${comparisons.length} NatGen/Integon comparisons to reprocess\n`);

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
  console.log(`Total NatGen comparisons: ${comparisons.length}`);
  console.log(`Updated with AL3 baseline: ${updated}`);
  console.log(`Skipped (no baseline): ${skipped}`);
  console.log(`False positives eliminated: ${falsePositivesEliminated}`);

  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
