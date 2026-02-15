import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env.production.local') });

import { parseAL3File } from '../src/lib/al3/parser';

async function run() {
  const { db } = await import('../src/db');
  const { renewalCandidates } = await import('../src/db/schema');
  const { isNotNull, desc } = await import('drizzle-orm');

  // Get recent candidates with raw content
  const candidates = await db.select({
    policyNumber: renewalCandidates.policyNumber,
    carrierName: renewalCandidates.carrierName,
    rawAl3Content: renewalCandidates.rawAl3Content
  })
  .from(renewalCandidates)
  .where(isNotNull(renewalCandidates.rawAl3Content))
  .orderBy(desc(renewalCandidates.createdAt))
  .limit(10);

  console.log('Testing parsing on', candidates.length, 'recent candidates...\n');

  let passed = 0;
  let failed = 0;

  for (const c of candidates) {
    if (!c.rawAl3Content) continue;
    try {
      const txs = parseAL3File(c.rawAl3Content);
      const covCount = txs.reduce((acc, tx) => acc + tx.coverages.length, 0);
      console.log('✓', (c.policyNumber || '').padEnd(20), '|', (c.carrierName || '').substring(0, 20).padEnd(20), '|', covCount, 'coverages');
      passed++;
    } catch (e: any) {
      console.log('✗', (c.policyNumber || '').padEnd(20), '|', (c.carrierName || '').substring(0, 20).padEnd(20), '| ERROR:', e.message);
      failed++;
    }
  }

  console.log('\nResults:', passed, 'passed,', failed, 'failed');
  process.exit(failed > 0 ? 1 : 0);
}
run().catch(e => { console.error(e); process.exit(1); });
