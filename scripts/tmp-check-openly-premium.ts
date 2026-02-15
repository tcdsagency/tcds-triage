import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env.production.local') });

import { parseAL3File } from '../src/lib/al3/parser';

async function run() {
  const { db } = await import('../src/db');
  const { renewalCandidates } = await import('../src/db/schema');
  const { eq } = await import('drizzle-orm');

  const [c] = await db.select().from(renewalCandidates).where(eq(renewalCandidates.policyNumber, 'BQ01-AVMZJK'));
  if (!c?.rawAl3Content) { console.log('Not found'); process.exit(0); }

  const txs = parseAL3File(c.rawAl3Content);
  console.log('Openly totalPremium from parser:', txs[0]?.totalPremium);

  // Check 5BPI line
  const lines = c.rawAl3Content.split(/\r?\n/);
  const bpi = lines.find(l => l.startsWith('5BPI'));
  if (bpi) {
    console.log('\n5BPI line length:', bpi.length);
    console.log('5BPI substring 100-150:', JSON.stringify(bpi.substring(100, 150)));

    // Look for premium patterns
    const patterns11 = bpi.substring(100).match(/(\d{11})[+-]/g);
    console.log('11-digit patterns in 5BPI:', patterns11);

    // Also check 10-digit patterns
    const patterns10 = bpi.substring(100).match(/(\d{10})[+-]/g);
    console.log('10-digit patterns:', patterns10);
  }

  process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
