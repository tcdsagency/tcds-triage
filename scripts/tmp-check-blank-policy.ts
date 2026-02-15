import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env.production.local') });

async function run() {
  const { db } = await import('../src/db');
  const { renewalCandidates } = await import('../src/db/schema');
  const { desc } = await import('drizzle-orm');
  const { parseAL3File } = await import('../src/lib/al3/parser');

  const candidates = await db.select({
    policyNumber: renewalCandidates.policyNumber,
    carrierName: renewalCandidates.carrierName,
    rawAl3Content: renewalCandidates.rawAl3Content,
  }).from(renewalCandidates)
    .orderBy(desc(renewalCandidates.createdAt))
    .limit(15);

  // Focus on blank-policy ones
  const blanks = candidates.filter(c => !c.policyNumber);
  console.log(`Found ${blanks.length} blank-policy candidates\n`);

  for (const c of blanks) {
    console.log(`${'='.repeat(70)}`);
    console.log(`Carrier: ${c.carrierName}`);

    if (!c.rawAl3Content) { console.log('  No raw content'); continue; }

    // Show lines containing policy-like patterns
    const lines = c.rawAl3Content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const clean = lines[i].replace(/[\x00-\x1f\x80-\xff]/g, '?');
      // Look for patterns like "0301-XXXX-XXXX"
      const policyMatch = clean.match(/(\d{4}-\d{4}-\d{4})/);
      if (policyMatch) {
        console.log(`  Line ${i}: found "${policyMatch[1]}" in: ${clean.substring(0, 150)}`);
      }
    }

    // Parse and check
    const txs = parseAL3File(c.rawAl3Content);
    console.log(`\n  Parsed ${txs.length} transaction(s):`);
    for (const tx of txs) {
      console.log(`    Policy: "${tx.header.policyNumber}" | Carrier: ${tx.header.carrierName} | LOB: ${tx.header.lineOfBusiness}`);
      console.log(`    Coverages: ${tx.coverages.length} | Premium: ${tx.totalPremium}`);
    }
    console.log('');
  }

  process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
