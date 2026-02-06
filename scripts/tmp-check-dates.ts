import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env.production.local') });

async function run() {
  const { db } = await import('../src/db');
  const { renewalComparisons } = await import('../src/db/schema');
  const { eq } = await import('drizzle-orm');

  const comps = await db.select().from(renewalComparisons)
    .where(eq(renewalComparisons.policyNumber, '994572297'));

  if (comps.length === 0) {
    console.log('Comparison not found');
    process.exit(0);
  }

  const c = comps[0];
  console.log('Comparison created:', c.createdAt);
  console.log('Renewal effective date:', c.renewalEffectiveDate);

  const baseline = c.baselineSnapshot as any;
  console.log('\nBaseline policy dates:');
  console.log('  effectiveDate:', baseline?.policyEffectiveDate);
  console.log('  expirationDate:', baseline?.policyExpirationDate);

  // Check if dates would trigger stale detection
  if (baseline?.policyEffectiveDate && c.renewalEffectiveDate) {
    const baselineEff = baseline.policyEffectiveDate;
    const renewalEffRaw = c.renewalEffectiveDate;
    const renewalEffNorm = renewalEffRaw instanceof Date 
      ? renewalEffRaw.toISOString().split('T')[0]
      : String(renewalEffRaw).split('T')[0];
    console.log('\nStale detection logic:');
    console.log('  baselineEffDate:', baselineEff);
    console.log('  renewalEffDate (normalized):', renewalEffNorm);
    console.log('  Dates equal?', baselineEff === renewalEffNorm);
    if (baselineEff === renewalEffNorm) {
      console.log('  -> Would flag as STALE (current_term)');
    } else {
      console.log('  -> Would flag as PRIOR TERM (good baseline)');
    }
  }

  // Also check the raw comparisonSummary
  console.log('\nRaw comparisonSummary:');
  console.log(JSON.stringify(c.comparisonSummary, null, 2));

  process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
