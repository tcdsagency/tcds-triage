import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env.production.local') });

async function run() {
  const { db } = await import('../src/db');
  const { renewalCandidates } = await import('../src/db/schema');
  const { eq } = await import('drizzle-orm');
  const { compareSnapshots } = await import('../src/lib/al3/comparison-engine');

  const [c] = await db.select().from(renewalCandidates).where(eq(renewalCandidates.policyNumber, 'BQ01-AVMZJK'));
  if (!c) {
    console.log('Not found');
    process.exit(0);
  }

  const baseline = c.baselineSnapshot as any;
  const renewal = c.renewalSnapshot as any;

  console.log('=== BASELINE (HawkSoft) ===');
  console.log('Coverages:', baseline?.coverages?.length || 0);
  for (const cov of (baseline?.coverages || [])) {
    console.log('  -', cov.type?.padEnd(25), '| Limit:', cov.limitAmount);
  }

  console.log('\n=== RENEWAL (AL3/Openly) ===');
  console.log('Coverages:', renewal?.coverages?.length || 0);
  for (const cov of (renewal?.coverages || [])) {
    console.log('  -', cov.type?.padEnd(25), '| Limit:', cov.limitAmount);
  }

  if (baseline && renewal) {
    console.log('\n=== COMPARISON ===');
    const result = compareSnapshots(renewal, baseline);
    console.log('Material changes:', result.materialChanges.length);
    for (const change of result.materialChanges) {
      console.log('  -', change.category, ':', change.changeType, '-', change.description);
    }
    console.log('\nSummary:');
    console.log('  Premium:', result.summary.premiumDirection, result.summary.premiumChangePercent ? `(${result.summary.premiumChangePercent}%)` : '');
    console.log('  Material Negative:', result.summary.materialNegativeCount);
    console.log('  Material Positive:', result.summary.materialPositiveCount);
    console.log('  Recommendation:', result.recommendation);
  }

  process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
