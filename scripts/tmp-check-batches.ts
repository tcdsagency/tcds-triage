import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env.production.local') });

async function run() {
  const { db } = await import('../src/db');
  const { renewalBatches, renewalCandidates, renewalComparisons } = await import('../src/db/schema');
  const { desc, sql } = await import('drizzle-orm');

  const batches = await db.select().from(renewalBatches).orderBy(desc(renewalBatches.createdAt)).limit(3);
  console.log('Recent batches:');
  for (const b of batches) {
    console.log(' ', b.id.slice(0,8), '-', b.status, '- created:', b.createdAt?.toISOString());
  }
  
  const candidates = await db.select({ count: sql`count(*)::int` }).from(renewalCandidates);
  const comparisons = await db.select({ count: sql`count(*)::int` }).from(renewalComparisons);
  
  console.log('\nCandidates:', candidates[0].count);
  console.log('Comparisons:', comparisons[0].count);
  
  process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
