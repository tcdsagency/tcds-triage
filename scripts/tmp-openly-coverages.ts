import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env.production.local') });

import { parseAL3File } from '../src/lib/al3/parser';

async function run() {
  const { db } = await import('../src/db');
  const { renewalCandidates } = await import('../src/db/schema');
  const { eq } = await import('drizzle-orm');

  const [c] = await db.select().from(renewalCandidates).where(eq(renewalCandidates.policyNumber, 'BQ01-AVMZJK'));
  if (!c || !c.rawAl3Content) { console.log('Not found'); process.exit(0); }

  const txs = parseAL3File(c.rawAl3Content);
  for (const tx of txs) {
    console.log('=== ALL COVERAGES ===\n');
    for (const cov of tx.coverages) {
      console.log(
        cov.code.padEnd(10), '|',
        (cov.description || '').substring(0, 25).padEnd(25), '|',
        'Limit:', String(cov.limitAmount || '').padEnd(10), '|',
        'Ded:', cov.deductibleAmount
      );
    }
  }
  process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
