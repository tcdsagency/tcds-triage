import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env.production.local') });

async function run() {
  const { db } = await import('../src/db');
  const { renewalCandidates } = await import('../src/db/schema');
  const { desc, isNull, or, eq } = await import('drizzle-orm');

  // Find problematic candidates
  const candidates = await db.select().from(renewalCandidates)
    .orderBy(desc(renewalCandidates.createdAt))
    .limit(20);

  console.log('=== PARSING ISSUES ===\n');

  for (const c of candidates) {
    const snapshot = c.renewalSnapshot as any;
    const coverageCount = snapshot?.coverages?.length || 0;
    const discountCount = snapshot?.discounts?.length || 0;

    // Flag issues
    const issues: string[] = [];
    if (!c.policyNumber) issues.push('NO_POLICY_NUMBER');
    if (!c.carrierName || c.carrierName.length > 30) issues.push('BAD_CARRIER_NAME');
    if (coverageCount === 0) issues.push('NO_COVERAGES');
    if (!c.insuredName) issues.push('NO_INSURED');

    if (issues.length === 0) continue; // Skip good ones

    console.log('=' .repeat(60));
    console.log('Issues:', issues.join(', '));
    console.log('Policy:', c.policyNumber || '(empty)');
    console.log('Carrier:', c.carrierName);
    console.log('LOB:', c.lineOfBusiness);
    console.log('Coverages:', coverageCount, '| Discounts:', discountCount);

    // Show first 500 chars of raw AL3
    const raw = c.rawAl3Content || '';
    if (raw) {
      console.log('\n--- RAW AL3 (first 800 chars) ---');
      console.log(raw.substring(0, 800));
    }
    console.log('\n');
  }

  process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
