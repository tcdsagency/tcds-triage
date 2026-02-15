import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env.production.local') });

async function run() {
  const { db } = await import('../src/db');
  const { renewalComparisons, renewalBatches } = await import('../src/db/schema');
  const { desc, eq, gte, and } = await import('drizzle-orm');

  // Get the most recent batch
  const [latestBatch] = await db.select().from(renewalBatches)
    .orderBy(desc(renewalBatches.createdAt))
    .limit(1);

  if (latestBatch) {
    console.log('=== LATEST BATCH ===');
    console.log('ID:', latestBatch.id);
    console.log('File:', latestBatch.fileName);
    console.log('Status:', latestBatch.status);
    console.log('Created:', latestBatch.createdAt);
    console.log('Candidates:', latestBatch.candidatesCreated);
    console.log('Duplicates:', latestBatch.duplicatesRemoved);
    console.log('Completed:', latestBatch.candidatesCompleted);
    console.log('Errors:', latestBatch.candidatesFailed);
    if (latestBatch.errorLog) {
      console.log('Error log:', JSON.stringify(latestBatch.errorLog, null, 2));
    }
  }

  // Get the most recent 10 comparisons
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const comparisons = await db.select().from(renewalComparisons)
    .orderBy(desc(renewalComparisons.createdAt))
    .limit(10);

  console.log('\n\n=== RECENT COMPARISONS ===');
  console.log('Found:', comparisons.length);

  for (const c of comparisons) {
    const renewalSnap = c.renewalSnapshot as any;
    const baselineSnap = c.baselineSnapshot as any;
    const summary = c.comparisonSummary as any;
    const changes = (c.materialChanges || []) as any[];

    console.log('\n' + '='.repeat(70));
    console.log(`Policy: ${c.policyNumber} | Carrier: ${c.carrierName} | LOB: ${c.lineOfBusiness}`);
    console.log(`Status: ${c.status} | Recommendation: ${c.recommendation}`);
    console.log(`Created: ${c.createdAt}`);
    console.log(`Renewal Effective: ${c.renewalEffectiveDate}`);

    // Premium comparison
    console.log('\n--- PREMIUM ---');
    console.log(`  DB currentPremium:  ${c.currentPremium}`);
    console.log(`  DB renewalPremium:  ${c.renewalPremium}`);
    console.log(`  DB changeAmount:    ${c.premiumChangeAmount}`);
    console.log(`  DB changePercent:   ${c.premiumChangePercent}%`);

    // Snapshot premiums
    console.log(`  Baseline snap premium: ${baselineSnap?.premium}`);
    console.log(`  Renewal snap premium:  ${renewalSnap?.premium}`);

    // Baseline info
    console.log('\n--- BASELINE ---');
    console.log(`  fetchSource:     ${baselineSnap?.fetchSource}`);
    console.log(`  policyEffDate:   ${baselineSnap?.policyEffectiveDate}`);
    console.log(`  policyExpDate:   ${baselineSnap?.policyExpirationDate}`);
    console.log(`  fetchedAt:       ${baselineSnap?.fetchedAt}`);
    console.log(`  baselineStatus:  ${summary?.baselineStatus} (${summary?.baselineStatusReason || 'n/a'})`);

    // Baseline coverages
    const baselineCovs = baselineSnap?.coverages || [];
    console.log(`  coverages (${baselineCovs.length}):`);
    for (const cov of baselineCovs.slice(0, 10)) {
      console.log(`    ${cov.type}: limit=${cov.limitAmount || cov.limit || '-'}, ded=${cov.deductibleAmount || cov.deductible || '-'}, prem=${cov.premium ?? '-'}`);
    }
    if (baselineCovs.length > 10) console.log(`    ... +${baselineCovs.length - 10} more`);

    // Baseline vehicles
    const baselineVehs = baselineSnap?.vehicles || [];
    console.log(`  vehicles (${baselineVehs.length}):`);
    for (const v of baselineVehs) {
      console.log(`    ${v.year} ${v.make} ${v.model} VIN:${v.vin || 'n/a'} covs:${v.coverages?.length || 0}`);
    }

    // Baseline drivers
    const baselineDrivers = baselineSnap?.drivers || [];
    console.log(`  drivers (${baselineDrivers.length}):`);
    for (const d of baselineDrivers) {
      console.log(`    ${d.name}`);
    }

    // Baseline discounts
    const baselineDiscounts = baselineSnap?.discounts || [];
    console.log(`  discounts (${baselineDiscounts.length}):`);
    for (const d of baselineDiscounts) {
      console.log(`    ${d.code}: ${d.description || '-'}`);
    }

    // Renewal snapshot
    console.log('\n--- RENEWAL ---');
    console.log(`  insuredName: ${renewalSnap?.insuredName}`);
    console.log(`  parseConfidence: ${renewalSnap?.parseConfidence}`);

    const renewalCovs = renewalSnap?.coverages || [];
    console.log(`  coverages (${renewalCovs.length}):`);
    for (const cov of renewalCovs.slice(0, 10)) {
      console.log(`    ${cov.type}: limit=${cov.limitAmount || cov.limit || '-'}, ded=${cov.deductibleAmount || cov.deductible || '-'}, prem=${cov.premium ?? '-'}`);
    }
    if (renewalCovs.length > 10) console.log(`    ... +${renewalCovs.length - 10} more`);

    const renewalVehs = renewalSnap?.vehicles || [];
    console.log(`  vehicles (${renewalVehs.length}):`);
    for (const v of renewalVehs) {
      const vCovs = v.coverages || [];
      console.log(`    ${v.year} ${v.make} ${v.model} VIN:${v.vin || 'n/a'} covs:${vCovs.length}`);
      for (const vc of vCovs) {
        console.log(`      ${vc.type}: limit=${vc.limitAmount || vc.limit || '-'}, ded=${vc.deductibleAmount || vc.deductible || '-'}, prem=${vc.premium ?? '-'}`);
      }
    }

    const renewalDrivers = renewalSnap?.drivers || [];
    console.log(`  drivers (${renewalDrivers.length}):`);
    for (const d of renewalDrivers) {
      console.log(`    ${d.name}`);
    }

    const renewalDiscounts = renewalSnap?.discounts || [];
    console.log(`  discounts (${renewalDiscounts.length}):`);
    for (const d of renewalDiscounts) {
      console.log(`    ${d.code}: ${d.description || '-'}`);
    }

    // Material changes
    console.log(`\n--- MATERIAL CHANGES (${changes.length}) ---`);
    for (const ch of changes) {
      console.log(`  [${ch.severity}] ${ch.category}: ${ch.description || ch.field} | old=${ch.oldValue} new=${ch.newValue}`);
    }
  }

  process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
