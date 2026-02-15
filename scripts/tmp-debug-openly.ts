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

  console.log('=== PARSING OPENLY FILE ===\n');
  console.log('Raw length:', c.rawAl3Content.length);

  // Check for 6CVH records in raw
  const lines = c.rawAl3Content.split(/\r?\n/);
  const cvhLines = lines.filter(l => l.startsWith('6CVH'));
  console.log('6CVH lines found:', cvhLines.length);

  if (cvhLines.length > 0) {
    console.log('\nFirst 3 6CVH lines:');
    for (const l of cvhLines.slice(0, 3)) {
      console.log('  Length:', l.length);
      console.log('  Code (30-45):', JSON.stringify(l.substring(30, 45)));
      console.log('  Limit (60-72):', JSON.stringify(l.substring(60, 72)));
      console.log('  Limit (86-94):', JSON.stringify(l.substring(86, 94)));
      console.log('  Desc (120-180):', JSON.stringify(l.substring(120, 180)));
      console.log('');
    }
  }

  // Parse the file
  const transactions = parseAL3File(c.rawAl3Content);
  console.log('\nTransactions parsed:', transactions.length);

  for (const tx of transactions) {
    console.log('\nTransaction:');
    console.log('  Policy:', tx.header.policyNumber);
    console.log('  Insured:', tx.header.insuredName);
    console.log('  Coverages:', tx.coverages.length);
    for (const cov of tx.coverages.slice(0, 5)) {
      console.log('    -', cov.code, ':', cov.description, '| Limit:', cov.limitAmount);
    }
  }

  process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
