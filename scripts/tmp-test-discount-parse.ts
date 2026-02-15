import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env.production.local') });

async function run() {
  const { db } = await import('../src/db');
  const { renewalCandidates } = await import('../src/db/schema');
  const { eq } = await import('drizzle-orm');
  const { parseAL3File } = await import('../src/lib/al3/parser');

  // Get the auto policy candidate with raw AL3
  const candidates = await db.select().from(renewalCandidates)
    .where(eq(renewalCandidates.policyNumber, '955847785'));

  if (candidates.length === 0) {
    console.log('Candidate not found - trying to use the latest one');
    const allCandidates = await db.select().from(renewalCandidates).limit(1);
    if (allCandidates.length === 0) {
      console.log('No candidates found');
      process.exit(0);
    }
    console.log('Using candidate:', allCandidates[0].policyNumber);
  }

  const cand = candidates[0] || (await db.select().from(renewalCandidates).limit(1))[0];
  const raw = cand.rawAl3Content || '';

  console.log('Policy:', cand.policyNumber);
  console.log('Raw AL3 length:', raw.length);
  console.log('');

  // Parse the file
  const transactions = parseAL3File(raw);

  if (transactions.length === 0) {
    console.log('No transactions parsed');
    process.exit(0);
  }

  const tx = transactions[0];
  console.log('Parsed transaction:');
  console.log('  Policy:', tx.header.policyNumber);
  console.log('  LOB:', tx.header.lineOfBusiness);
  console.log('  Coverages:', tx.coverages.length);

  console.log('\n--- Coverages ---');
  for (const cov of tx.coverages) {
    console.log(' ', cov.code, '-', cov.description);
    if (cov.premium) console.log('    Premium:', cov.premium);
    if (cov.limitAmount) console.log('    Limit:', cov.limitAmount);
    if (cov.deductibleAmount) console.log('    Deductible:', cov.deductibleAmount);
  }

  console.log('\n--- Discount Records ---');
  const discounts = tx.coverages.filter(c =>
    c.code && /^(AFR|HON|MC1|SMP|IPP|SD3|NP3|NP5|CFR|PPAYD|DAS|ASC|PIF|DPP)$/i.test(c.code)
  );
  if (discounts.length === 0) {
    console.log('  (no discount codes found in coverages)');
  } else {
    for (const d of discounts) {
      console.log('  ', d.code, '-', d.description);
    }
  }

  process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
