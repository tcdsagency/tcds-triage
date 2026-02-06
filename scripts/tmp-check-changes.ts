import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env.production.local') });

async function run() {
  const { db } = await import('../src/db');
  const { renewalComparisons } = await import('../src/db/schema');
  const { eq } = await import('drizzle-orm');

  // Check the watercraft policy with 12 material negatives
  const comps = await db.select().from(renewalComparisons)
    .where(eq(renewalComparisons.policyNumber, '994572297'));

  if (comps.length === 0) {
    console.log('Comparison not found');
    process.exit(0);
  }

  const c = comps[0];
  console.log('Policy:', c.policyNumber);
  console.log('LOB:', c.lineOfBusiness);
  console.log('Premium:', c.currentPremium, '->', c.renewalPremium);
  
  const summary = c.comparisonSummary as any;
  console.log('\nComparison Summary:');
  console.log('  baselineStatus:', summary?.baselineStatus);
  console.log('  baselineStatusReason:', summary?.baselineStatusReason);

  console.log('\nMaterial Changes:');
  const changes = c.materialChanges as any[];
  if (changes) {
    const negatives = changes.filter(m => m.severity === 'material_negative');
    for (const ch of negatives) {
      console.log('  -', ch.category, ':', ch.field);
      console.log('    ', ch.oldValue, '->', ch.newValue);
      console.log('    ', ch.description);
    }
  }

  // Also check baseline snapshot for dates
  const baseline = c.baselineSnapshot as any;
  console.log('\nBaseline dates:');
  console.log('  policyEffectiveDate:', baseline?.policyEffectiveDate);
  console.log('  policyExpirationDate:', baseline?.policyExpirationDate);
  console.log('  fetchedAt:', baseline?.fetchedAt);

  process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
