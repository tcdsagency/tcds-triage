import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env.production.local') });

async function run() {
  const { db } = await import('../src/db');
  const { renewalComparisons } = await import('../src/db/schema');
  const { eq } = await import('drizzle-orm');

  const comps = await db.select().from(renewalComparisons).where(eq(renewalComparisons.policyNumber, '861204713'));
  if (comps.length === 0) { console.log('Not found'); process.exit(0); }
  
  const c = comps[0];
  const baseline = c.baselineSnapshot as any;
  const summary = c.comparisonSummary as any;
  
  console.log('Policy:', c.policyNumber);
  console.log('Premium:', c.currentPremium, '->', c.renewalPremium);
  console.log('');
  console.log('Baseline snapshot dates:');
  console.log('  policyEffectiveDate:', baseline?.policyEffectiveDate);
  console.log('  policyExpirationDate:', baseline?.policyExpirationDate);
  console.log('');
  console.log('Comparison summary (full):');
  console.log(JSON.stringify(summary, null, 2));
  
  process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
