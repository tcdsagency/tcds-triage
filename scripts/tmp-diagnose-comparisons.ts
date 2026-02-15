import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env.production.local') });

async function run() {
  const { db } = await import('../src/db/index.js');
  const { renewalComparisons } = await import('../src/db/schema.js');
  const { desc } = await import('drizzle-orm');

  const comparisons = await db.select()
    .from(renewalComparisons)
    .orderBy(desc(renewalComparisons.createdAt))
    .limit(10);

  console.log(`\n=== DIAGNOSING ${comparisons.length} RECENT COMPARISONS ===\n`);

  if (comparisons.length === 0) {
    console.log('NO COMPARISONS FOUND - this is the problem!');
    console.log('The worker is not creating comparison records.');
    process.exit(0);
  }

  for (const c of comparisons) {
    console.log('='.repeat(80));
    console.log(`POLICY: ${c.policyNumber} | ${c.carrierName} | ${c.lineOfBusiness}`);
    console.log('='.repeat(80));

    console.log('\n--- PREMIUM ---');
    console.log('  Current premium:', c.currentPremium ?? 'MISSING');
    console.log('  Renewal premium:', c.renewalPremium ?? 'MISSING');
    console.log('  Change amount:', c.premiumChangeAmount ?? 'N/A');
    console.log('  Change percent:', c.premiumChangePercent ?? 'N/A');

    console.log('\n--- RECOMMENDATION ---');
    console.log('  Recommendation:', c.recommendation ?? 'MISSING');
    console.log('  Status:', c.status ?? 'MISSING');

    console.log('\n--- MATERIAL CHANGES ---');
    const changes = c.materialChanges as any[];
    if (changes?.length > 0) {
      console.log(`  Count: ${changes.length}`);
      for (const mc of changes.slice(0, 8)) {
        console.log(`    - [${mc.category}] ${mc.field}: ${mc.message || ''}`);
      }
      if (changes.length > 8) console.log(`    ... and ${changes.length - 8} more`);
    } else {
      console.log('  No material changes');
    }

    console.log('\n--- SNAPSHOTS ---');
    const baseline = c.baselineSnapshot as any;
    const renewal = c.renewalSnapshot as any;

    console.log('  Baseline coverages:', baseline?.coverages?.length ?? 0);
    console.log('  Renewal coverages:', renewal?.coverages?.length ?? 0);
    console.log('  Baseline drivers:', baseline?.drivers?.length ?? 0);
    console.log('  Renewal drivers:', renewal?.drivers?.length ?? 0);
    console.log('  Baseline vehicles:', baseline?.vehicles?.length ?? 0);
    console.log('  Renewal vehicles:', renewal?.vehicles?.length ?? 0);

    console.log('\n');
  }

  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
