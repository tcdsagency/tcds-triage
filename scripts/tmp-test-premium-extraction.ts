import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env.production.local') });

import { parseAL3File } from '../src/lib/al3/parser';
import { buildRenewalSnapshot } from '../src/lib/al3/snapshot-builder';

async function run() {
  const { db } = await import('../src/db');
  const { renewalCandidates } = await import('../src/db/schema');
  const { isNotNull, desc } = await import('drizzle-orm');

  const candidates = await db.select({
    policyNumber: renewalCandidates.policyNumber,
    carrierName: renewalCandidates.carrierName,
    rawAl3Content: renewalCandidates.rawAl3Content,
  })
  .from(renewalCandidates)
  .where(isNotNull(renewalCandidates.rawAl3Content))
  .orderBy(desc(renewalCandidates.createdAt))
  .limit(10);

  console.log('=== PREMIUM EXTRACTION TEST ===\n');
  console.log('Policy'.padEnd(22), '| Carrier'.padEnd(22), '| 5BPI Premium'.padEnd(16), '| Coverage Sum'.padEnd(16), '| Final');
  console.log('-'.repeat(100));

  for (const c of candidates) {
    if (!c.rawAl3Content) continue;

    const txs = parseAL3File(c.rawAl3Content);
    if (txs.length === 0) continue;

    const tx = txs[0];
    const snapshot = buildRenewalSnapshot(tx);

    // Calculate coverage sum for comparison
    const covSum = tx.coverages
      .filter(cov => cov.premium)
      .reduce((sum, cov) => sum + (cov.premium || 0), 0);

    console.log(
      (c.policyNumber || '').padEnd(22), '|',
      (c.carrierName || '').substring(0, 20).padEnd(20), '|',
      (tx.totalPremium ? `$${tx.totalPremium.toFixed(2)}` : 'N/A').padEnd(14), '|',
      (covSum > 0 ? `$${covSum.toFixed(2)}` : 'N/A').padEnd(14), '|',
      snapshot.premium ? `$${snapshot.premium.toFixed(2)}` : 'N/A'
    );
  }

  process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
