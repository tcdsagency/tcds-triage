import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env.production.local') });

async function run() {
  const { db } = await import('../src/db');
  const { renewalCandidates, policies } = await import('../src/db/schema');
  const { desc, eq } = await import('drizzle-orm');

  // Get all candidates and check their stale status
  const candidates = await db.select({
    policyNumber: renewalCandidates.policyNumber,
    carrierName: renewalCandidates.carrierName,
    effectiveDate: renewalCandidates.effectiveDate,
    policyId: renewalCandidates.policyId,
    baselineSnapshot: renewalCandidates.baselineSnapshot,
    renewalSnapshot: renewalCandidates.renewalSnapshot,
  }).from(renewalCandidates)
    .orderBy(desc(renewalCandidates.createdAt))
    .limit(20);

  for (const c of candidates) {
    const baseline = c.baselineSnapshot as any;
    const renewal = c.renewalSnapshot as any;
    
    const baselineEffDate = baseline?.policyEffectiveDate || 'none';
    const baselineExpDate = baseline?.policyExpirationDate || 'none';
    const baselinePremium = baseline?.premium;
    const baselineFetchSource = baseline?.fetchSource || 'none';
    const baselineCovCount = baseline?.coverages?.length || 0;
    
    const renewalEffDate = c.effectiveDate?.toISOString().split('T')[0] || 'none';
    const renewalPremium = renewal?.premium;
    
    const isStale = baselineEffDate === renewalEffDate;
    const premiumMatch = baselinePremium != null && renewalPremium != null && baselinePremium === renewalPremium;
    
    console.log(`\n${c.policyNumber} | ${c.carrierName}`);
    console.log(`  Renewal eff date:  ${renewalEffDate}`);
    console.log(`  Baseline eff date: ${baselineEffDate}`);
    console.log(`  Baseline exp date: ${baselineExpDate}`);
    console.log(`  Baseline premium:  ${baselinePremium}`);
    console.log(`  Renewal premium:   ${renewalPremium}`);
    console.log(`  Baseline source:   ${baselineFetchSource}`);
    console.log(`  Baseline covs:     ${baselineCovCount}`);
    console.log(`  STALE (dates match): ${isStale}`);
    console.log(`  STALE (premium match): ${premiumMatch}`);
    
    // Also check the policy record itself
    if (c.policyId) {
      const [pol] = await db.select({
        effectiveDate: policies.effectiveDate,
        expirationDate: policies.expirationDate,
        premium: policies.premium,
      }).from(policies).where(eq(policies.id, c.policyId)).limit(1);
      if (pol) {
        console.log(`  Policy DB eff:     ${pol.effectiveDate?.toISOString().split('T')[0] || 'null'}`);
        console.log(`  Policy DB exp:     ${pol.expirationDate?.toISOString().split('T')[0] || 'null'}`);
        console.log(`  Policy DB premium: ${pol.premium}`);
      }
    }
  }

  process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
