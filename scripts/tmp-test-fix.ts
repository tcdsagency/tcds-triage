import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env.production.local') });

async function run() {
  const { db } = await import('../src/db');
  const { renewalCandidates } = await import('../src/db/schema');
  const { desc } = await import('drizzle-orm');
  const { parseAL3File } = await import('../src/lib/al3/parser');
  const { buildRenewalSnapshot } = await import('../src/lib/al3/snapshot-builder');

  // Get the problem candidates
  const candidates = await db.select({
    id: renewalCandidates.id,
    policyNumber: renewalCandidates.policyNumber,
    carrierName: renewalCandidates.carrierName,
    rawAl3Content: renewalCandidates.rawAl3Content,
  }).from(renewalCandidates)
    .orderBy(desc(renewalCandidates.createdAt))
    .limit(10);

  const testPolicies = ['0301-2500-2023', 'ALA159099'];

  for (const policyNum of testPolicies) {
    const candidate = candidates.find(c => c.policyNumber === policyNum);
    if (!candidate?.rawAl3Content) {
      console.log(`\nSkipping ${policyNum} — no raw content`);
      continue;
    }

    console.log('\n' + '='.repeat(70));
    console.log(`Re-parsing: ${policyNum} (${candidate.carrierName})`);

    // Parse the raw AL3 content
    const lines = candidate.rawAl3Content.split('\n');
    const transactions = parseAL3File(candidate.rawAl3Content);
    const transaction = transactions[0];
    if (!transaction) { console.log('  No transactions parsed!'); continue; }

    console.log(`\nParsed coverages: ${transaction.coverages.length}`);
    for (const cov of transaction.coverages) {
      console.log(`  ${cov.code}: limit=${cov.limitAmount || cov.limit || '-'}, ded=${cov.deductibleAmount || cov.deductible || '-'}, prem=${cov.premium ?? '-'}, desc=${cov.description || '-'}`);
    }

    console.log(`\nVehicles: ${transaction.vehicles.length}`);
    console.log(`Drivers: ${transaction.drivers.length}`);
    console.log(`Total premium: ${transaction.totalPremium}`);

    // Build snapshot
    const snapshot = buildRenewalSnapshot(transaction);
    console.log(`\nSnapshot coverages: ${snapshot.coverages.length}`);
    for (const cov of snapshot.coverages) {
      console.log(`  ${cov.type}: limit=${cov.limitAmount || '-'}, ded=${cov.deductibleAmount || '-'}, prem=${cov.premium ?? '-'}`);
    }
    console.log(`Snapshot premium: ${snapshot.premium}`);
    console.log(`Snapshot discounts: ${snapshot.discounts.length}`);
  }

  // Also test the blank-policy RSAL candidates
  const blankPolicyCandidates = candidates.filter(c => !c.policyNumber && c.carrierName?.includes('RSAL'));
  for (const candidate of blankPolicyCandidates.slice(0, 2)) {
    if (!candidate.rawAl3Content) continue;
    console.log('\n' + '='.repeat(70));
    console.log(`Re-parsing: [blank policy] (${candidate.carrierName})`);

    const lines = candidate.rawAl3Content.split('\n');
    const transactions = parseAL3File(candidate.rawAl3Content);
    const transaction = transactions[0];
    if (!transaction) { console.log('  No transactions parsed!'); continue; }

    console.log(`Policy number: ${transaction.header.policyNumber}`);
    console.log(`Parsed coverages: ${transaction.coverages.length}`);
    for (const cov of transaction.coverages) {
      console.log(`  ${cov.code}: limit=${cov.limitAmount || cov.limit || '-'}, ded=${cov.deductibleAmount || cov.deductible || '-'}, prem=${cov.premium ?? '-'}`);
    }

    const snapshot = buildRenewalSnapshot(transaction);
    console.log(`\nSnapshot coverages: ${snapshot.coverages.length}`);
    for (const cov of snapshot.coverages) {
      console.log(`  ${cov.type}: limit=${cov.limitAmount || '-'}, ded=${cov.deductibleAmount || '-'}, prem=${cov.premium ?? '-'}`);
    }
    console.log(`Snapshot premium: ${snapshot.premium}`);
  }

  process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
