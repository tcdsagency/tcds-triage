import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env.production.local') });

async function run() {
  const { db } = await import('../src/db');
  const { renewalCandidates } = await import('../src/db/schema');
  const { eq } = await import('drizzle-orm');
  const { parseAL3File } = await import('../src/lib/al3/parser');
  const { buildRenewalSnapshot } = await import('../src/lib/al3/snapshot-builder');

  const [candidate] = await db.select({
    policyNumber: renewalCandidates.policyNumber,
    rawAl3Content: renewalCandidates.rawAl3Content,
  })
    .from(renewalCandidates)
    .where(eq(renewalCandidates.policyNumber, '994572297'))
    .limit(1);

  if (!candidate || !candidate.rawAl3Content) {
    console.log('No raw AL3 content found for policy 994572297');
    process.exit(1);
  }

  console.log('Policy:', candidate.policyNumber);
  console.log('\n=== TESTING PARSER WITH FIX ===\n');

  const content = candidate.rawAl3Content as string;

  // Parse using our parser
  const transactions = parseAL3File(content);
  console.log('Parsed transactions:', transactions.length);

  if (transactions.length > 0) {
    const tx = transactions[0];
    console.log('\nTransaction header:', tx.header.policyNumber, tx.header.lineOfBusiness);
    console.log('Coverages found:', tx.coverages.length);

    // Build snapshot
    const snapshot = buildRenewalSnapshot(tx);
    console.log('\n=== SNAPSHOT RESULT ===');
    console.log('Total premium:', snapshot.premium);
    console.log('Coverages:', snapshot.coverages.length);
    console.log('Discounts:', snapshot.discounts.length);

    // Show coverages with premiums
    console.log('\nCoverages with premiums:');
    let totalCovPremium = 0;
    for (const cov of snapshot.coverages) {
      if (cov.premium) {
        console.log(`  ${cov.type.padEnd(25)} | prem: $${cov.premium.toFixed(2).padStart(8)} | limit: ${cov.limitAmount || '-'}`);
        totalCovPremium += cov.premium;
      }
    }
    console.log(`\nSum of coverage premiums: $${totalCovPremium.toFixed(2)}`);

    // Show discounts
    if (snapshot.discounts.length > 0) {
      console.log('\nDiscounts:');
      for (const disc of snapshot.discounts) {
        console.log(`  ${disc.code.padEnd(25)} | ${disc.description}`);
      }
    }
  }

  process.exit(0);
}

run().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
