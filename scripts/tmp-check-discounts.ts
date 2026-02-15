import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env.production.local') });

async function run() {
  const { db } = await import('../src/db');
  const { renewalCandidates } = await import('../src/db/schema');
  const { desc } = await import('drizzle-orm');

  const candidates = await db.select().from(renewalCandidates).orderBy(desc(renewalCandidates.createdAt)).limit(10);

  console.log('=== RECENT CANDIDATES ===');
  console.log('Total:', candidates.length);

  for (const c of candidates) {
    console.log('\n' + '-'.repeat(50));
    console.log('Policy:', c.policyNumber);
    console.log('Insured:', c.insuredName);
    console.log('LOB:', c.lineOfBusiness);
    console.log('Carrier:', c.carrierName);
    console.log('Recommendation:', c.recommendation);

    const snapshot = c.renewalSnapshot as any;
    if (snapshot) {
      console.log('Coverages:', snapshot.coverages?.length || 0);
      console.log('Discounts:', snapshot.discounts?.length || 0);
      if (snapshot.discounts?.length > 0) {
        for (const d of snapshot.discounts) {
          console.log('  -', d.code, ':', d.description);
        }
      }
    }
  }
  process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
