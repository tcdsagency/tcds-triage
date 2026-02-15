import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env.production.local') });

import { parseAL3File } from '../src/lib/al3/parser';
import { buildRenewalSnapshot } from '../src/lib/al3/snapshot-builder';

async function run() {
  const { db } = await import('../src/db');
  const { renewalCandidates } = await import('../src/db/schema');
  const { eq } = await import('drizzle-orm');

  const [c] = await db.select().from(renewalCandidates).where(eq(renewalCandidates.policyNumber, 'BQ01-AVMZJK'));
  if (!c || !c.rawAl3Content) {
    console.log('Not found');
    process.exit(0);
  }

  console.log('Parsing AL3 content...');
  const transactions = parseAL3File(c.rawAl3Content);

  if (transactions.length === 0) {
    console.log('No transactions found');
    process.exit(1);
  }

  const tx = transactions[0];
  console.log('Transaction parsed:');
  console.log('  Policy:', tx.header.policyNumber);
  console.log('  Insured:', tx.header.insuredName);
  console.log('  Coverages:', tx.coverages.length);

  console.log('\nBuilding renewal snapshot...');
  const snapshot = buildRenewalSnapshot(tx);

  console.log('Snapshot built:');
  console.log('  carrierName:', snapshot.carrierName);
  console.log('  insuredName:', snapshot.insuredName);
  console.log('  coverages:', snapshot.coverages.length);
  console.log('  discounts:', snapshot.discounts?.length || 0);

  console.log('\nCoverages in snapshot:');
  for (const cov of snapshot.coverages) {
    console.log('  -', cov.type.padEnd(25), '| Limit:', cov.limitAmount, '| Ded:', cov.deductibleAmount);
  }

  // Update the database
  console.log('\nUpdating database...');
  await db.update(renewalCandidates)
    .set({ renewalSnapshot: snapshot })
    .where(eq(renewalCandidates.id, c.id));

  console.log('Done!');
  process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
