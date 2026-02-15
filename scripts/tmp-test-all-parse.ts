import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env.production.local') });

async function run() {
  const { db } = await import('../src/db');
  const { renewalCandidates } = await import('../src/db/schema');
  const { desc } = await import('drizzle-orm');
  const { parseAL3File } = await import('../src/lib/al3/parser');
  const { buildRenewalSnapshot } = await import('../src/lib/al3/snapshot-builder');

  const candidates = await db.select({
    id: renewalCandidates.id,
    policyNumber: renewalCandidates.policyNumber,
    carrierName: renewalCandidates.carrierName,
    rawAl3Content: renewalCandidates.rawAl3Content,
  }).from(renewalCandidates)
    .orderBy(desc(renewalCandidates.createdAt))
    .limit(10);

  for (const c of candidates) {
    if (!c.rawAl3Content) continue;
    console.log(`\n${'='.repeat(70)}`);
    console.log(`Policy: ${c.policyNumber || '[blank]'} | Carrier: ${c.carrierName}`);

    try {
      const transactions = parseAL3File(c.rawAl3Content);
      const tx = transactions[0];
      if (!tx) { console.log('  No transactions!'); continue; }

      console.log(`  Carrier (parsed): ${tx.header.carrierName}`);
      console.log(`  LOB: ${tx.header.lineOfBusiness}`);
      console.log(`  Coverages: ${tx.coverages.length}`);
      console.log(`  Premium: ${tx.totalPremium}`);
      console.log(`  Vehicles: ${tx.vehicles.length}`);
      console.log(`  Drivers: ${tx.drivers.length}`);

      const snapshot = buildRenewalSnapshot(tx);
      console.log(`  Snapshot covs: ${snapshot.coverages.length}, premium: ${snapshot.premium}`);

      // Show key coverages
      for (const cov of snapshot.coverages.slice(0, 6)) {
        console.log(`    ${cov.type}: limit=${cov.limitAmount || '-'}, ded=${cov.deductibleAmount || '-'}, prem=${cov.premium ?? '-'}`);
      }
      if (snapshot.coverages.length > 6) {
        console.log(`    ... and ${snapshot.coverages.length - 6} more`);
      }
    } catch (e: any) {
      console.log(`  ERROR: ${e.message}`);
    }
  }

  process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
