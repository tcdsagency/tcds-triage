import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env.production.local') });

async function run() {
  const { db } = await import('../src/db');
  const { renewalCandidates } = await import('../src/db/schema');
  const { desc } = await import('drizzle-orm');
  const { parseAL3File } = await import('../src/lib/al3/parser');

  // Get a candidate with raw AL3
  const candidates = await db.select().from(renewalCandidates)
    .orderBy(desc(renewalCandidates.createdAt))
    .limit(5);

  console.log('=== RE-PARSING RAW AL3 ===\n');

  for (const c of candidates) {
    const raw = c.rawAl3Content;
    if (!raw) {
      console.log('Policy', c.policyNumber, '- no raw AL3 content');
      continue;
    }

    console.log('\n' + '='.repeat(60));
    console.log('DB Policy:', c.policyNumber);
    console.log('DB Insured:', c.insuredName);
    console.log('DB Carrier:', c.carrierName);
    console.log('Raw length:', raw.length);

    // Re-parse the raw content
    const transactions = parseAL3File(raw);
    console.log('Transactions parsed:', transactions.length);

    for (const tx of transactions) {
      console.log('\nParsed:');
      console.log('  Policy:', tx.header.policyNumber);
      console.log('  Insured:', tx.header.insuredName);
      console.log('  Carrier:', tx.header.carrierName);
      console.log('  Coverages:', tx.coverages.length);
      console.log('  Vehicles:', tx.vehicles.length);
    }
  }

  process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
