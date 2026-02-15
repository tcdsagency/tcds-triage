/**
 * Reprocess a single renewal comparison: re-run comparison engine + check engine
 * using the stored snapshots, then update the DB row.
 *
 * Usage: npx tsx scripts/tmp-reprocess-single.ts <renewal-id>
 */

import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

async function main() {
  const renewalId = process.argv[2];
  if (!renewalId) {
    console.error('Usage: npx tsx scripts/tmp-reprocess-single.ts <renewal-id>');
    process.exit(1);
  }

  const { db } = await import('../src/db');
  const { renewalComparisons } = await import('../src/db/schema');
  const { eq } = await import('drizzle-orm');
  const { compareSnapshots } = await import('../src/lib/al3/comparison-engine');
  const { runCheckEngine, buildCheckSummary } = await import('../src/lib/al3/check-rules/check-engine');

  console.log(`Reprocessing renewal ${renewalId}...`);

  const [row] = await db
    .select()
    .from(renewalComparisons)
    .where(eq(renewalComparisons.id, renewalId))
    .limit(1);

  if (!row) {
    console.error('Renewal not found');
    process.exit(1);
  }

  const renewalSnapshot = row.renewalSnapshot as any;
  const baselineSnapshot = row.baselineSnapshot as any;

  if (!renewalSnapshot || !baselineSnapshot) {
    console.error('Missing snapshots — cannot reprocess');
    process.exit(1);
  }

  const effectiveDate = row.renewalEffectiveDate?.toISOString().split('T')[0];

  // Re-run comparison engine
  const result = compareSnapshots(renewalSnapshot, baselineSnapshot, undefined, effectiveDate);

  console.log(`Comparison: ${result.recommendation}`);
  console.log(`  Material changes: ${result.materialChanges.length}`);
  console.log(`  Non-material: ${result.nonMaterialChanges.length}`);
  console.log(`  Headline: ${result.summary.headline}`);

  // Re-run check engine
  let checkResults = null;
  let checkSummary = null;
  try {
    const checkEngineResult = runCheckEngine(
      renewalSnapshot,
      baselineSnapshot,
      result,
      row.lineOfBusiness || '',
      row.carrierName || ''
    );
    checkSummary = buildCheckSummary(checkEngineResult);
    checkResults = checkEngineResult;
  } catch (err) {
    console.error('Check engine error:', err);
  }

  // Update DB
  await db
    .update(renewalComparisons)
    .set({
      materialChanges: result.materialChanges as any,
      comparisonSummary: { ...result.summary, baselineStatus: result.baselineStatus, baselineStatusReason: result.baselineStatusReason } as any,
      recommendation: result.recommendation,
      checkResults: checkResults as any,
      checkSummary: checkSummary as any,
      updatedAt: new Date(),
    })
    .where(eq(renewalComparisons.id, renewalId));

  console.log('\nUpdated DB row successfully.');

  // Show material changes
  for (const mc of result.materialChanges) {
    console.log(`  [${mc.severity}] ${mc.category}: ${mc.description}`);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
