import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

async function run() {
  const { db } = await import('../src/db');
  const { renewalComparisons } = await import('../src/db/schema');
  const { eq } = await import('drizzle-orm');

  const rows = await db
    .select()
    .from(renewalComparisons)
    .where(eq(renewalComparisons.policyNumber, '885458488'));

  if (rows.length === 0) {
    console.log('No renewal comparison found for policy 885458488');
    process.exit(0);
  }

  for (const row of rows) {
    console.log('=== RENEWAL COMPARISON ===');
    console.log('ID:', row.id);
    console.log('Policy:', row.policyNumber);
    console.log('Carrier:', row.carrierName);
    console.log('LOB:', row.lineOfBusiness);
    console.log('Status:', row.status);
    console.log('Renewal Effective:', row.renewalEffectiveDate);
    console.log('Current Premium:', row.currentPremium);
    console.log('Renewal Premium:', row.renewalPremium);
    console.log('Premium Change Amount:', row.premiumChangeAmount);
    console.log('Premium Change %:', row.premiumChangePercent);

    console.log('\n=== MATERIAL CHANGES (full JSON) ===');
    console.log(JSON.stringify(row.materialChanges, null, 2));

    console.log('\n=== COMPARISON SUMMARY ===');
    console.log(JSON.stringify(row.comparisonSummary, null, 2));

    console.log('\n=== CHECK RESULTS ===');
    console.log(JSON.stringify(row.checkResults, null, 2));

    console.log('\n=== CHECK SUMMARY ===');
    console.log(JSON.stringify(row.checkSummary, null, 2));

    const renewal = row.renewalSnapshot as any;
    const baseline = row.baselineSnapshot as any;

    console.log('\n=== RENEWAL SNAPSHOT ===');
    if (renewal) {
      console.log('Premium:', renewal.premium);
      console.log('\n-- Renewal Vehicles (' + (renewal.vehicles?.length ?? 0) + ') --');
      console.log(JSON.stringify(renewal.vehicles, null, 2));
      console.log('\n-- Renewal Drivers (' + (renewal.drivers?.length ?? 0) + ') --');
      console.log(JSON.stringify(renewal.drivers, null, 2));
      console.log('\n-- Renewal Top-Level Coverages (' + (renewal.coverages?.length ?? 0) + ') --');
      console.log(JSON.stringify(renewal.coverages, null, 2));
      console.log('\n-- Renewal Discounts (' + (renewal.discounts?.length ?? 0) + ') --');
      console.log(JSON.stringify(renewal.discounts, null, 2));
      console.log('\n-- Renewal Snapshot Top-Level Keys --');
      console.log(Object.keys(renewal));
    } else {
      console.log('(null)');
    }

    console.log('\n=== BASELINE SNAPSHOT ===');
    if (baseline) {
      console.log('Premium:', baseline.premium);
      console.log('\n-- Baseline Vehicles (' + (baseline.vehicles?.length ?? 0) + ') --');
      console.log(JSON.stringify(baseline.vehicles, null, 2));
      console.log('\n-- Baseline Drivers (' + (baseline.drivers?.length ?? 0) + ') --');
      console.log(JSON.stringify(baseline.drivers, null, 2));
      console.log('\n-- Baseline Top-Level Coverages (' + (baseline.coverages?.length ?? 0) + ') --');
      console.log(JSON.stringify(baseline.coverages, null, 2));
      console.log('\n-- Baseline Discounts (' + (baseline.discounts?.length ?? 0) + ') --');
      console.log(JSON.stringify(baseline.discounts, null, 2));
      console.log('\n-- Baseline Snapshot Top-Level Keys --');
      console.log(Object.keys(baseline));
    } else {
      console.log('(null)');
    }
  }

  process.exit(0);
}

run();
