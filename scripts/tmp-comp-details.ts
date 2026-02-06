import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env.production.local') });

async function run() {
  const { db } = await import('../src/db');
  const { renewalComparisons } = await import('../src/db/schema');
  const { desc } = await import('drizzle-orm');

  const comps = await db.select().from(renewalComparisons).orderBy(desc(renewalComparisons.createdAt));

  for (const c of comps) {
    const pctChange = c.currentPremium && c.renewalPremium 
      ? (((c.renewalPremium - c.currentPremium) / c.currentPremium) * 100).toFixed(1) 
      : 'N/A';
    const matNeg = Array.isArray(c.materialChanges) 
      ? (c.materialChanges as any[]).filter((m: any) => m.severity === 'material_negative').length 
      : 0;
    const summary = c.comparisonSummary as any;
    const baselineStatus = summary?.baselineStatus || 'unknown';
    console.log('---');
    console.log(c.customerName, '-', c.policyNumber);
    console.log('  ', c.carrierName, '-', c.lineOfBusiness);
    console.log('  Premium:', c.currentPremium, '->', c.renewalPremium, '(' + pctChange + '%)');
    console.log('  Recommendation:', c.recommendation);
    console.log('  Material negatives:', matNeg);
    console.log('  Baseline status:', baselineStatus);
    if (baselineStatus === 'current_term') {
      console.log('  ⚠️  STALE BASELINE - prior term data unavailable');
    }
  }
  process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
