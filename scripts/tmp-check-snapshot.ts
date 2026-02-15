import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env.production.local') });

async function run() {
  const { db } = await import('../src/db');
  const { renewalCandidates } = await import('../src/db/schema');
  const { desc, isNotNull } = await import('drizzle-orm');

  const candidates = await db.select().from(renewalCandidates)
    .where(isNotNull(renewalCandidates.renewalSnapshot))
    .orderBy(desc(renewalCandidates.createdAt))
    .limit(5);

  console.log('=== SNAPSHOT CHECK ===\n');
  console.log('Candidates with snapshots:', candidates.length);

  for (const c of candidates) {
    const snapshot = c.renewalSnapshot as any;
    console.log('\n' + '-'.repeat(50));
    console.log('Policy:', c.policyNumber);
    console.log('DB carrierName:', c.carrierName);
    console.log('Snapshot insuredName:', snapshot?.insuredName);
    console.log('Snapshot carrierName:', snapshot?.carrierName);
    console.log('Snapshot coverages:', snapshot?.coverages?.length);
    console.log('Snapshot discounts:', snapshot?.discounts?.length);
  }

  process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
