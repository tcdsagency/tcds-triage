import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env.production.local') });

async function run() {
  const { db } = await import('../src/db');
  const { renewalBatches, renewalCandidates, renewalComparisons } = await import('../src/db/schema');
  const { desc, eq, sql } = await import('drizzle-orm');

  const batches = await db.select().from(renewalBatches).orderBy(desc(renewalBatches.createdAt)).limit(1);
  if (batches.length === 0) {
    console.log('No batches found');
    process.exit(0);
  }
  const batch = batches[0];
  console.log('Latest batch:', batch.id.slice(0,8));
  console.log('  Status:', batch.status);
  console.log('  AL3 files:', batch.totalAl3FilesFound);
  console.log('  Transactions:', batch.totalTransactionsFound);
  console.log('  Candidates created:', batch.totalCandidatesCreated);

  const candidateStats = await db.select({
    status: renewalCandidates.status,
    count: sql`count(*)::int`
  }).from(renewalCandidates).where(eq(renewalCandidates.batchId, batch.id)).groupBy(renewalCandidates.status);
  console.log('\nCandidate status:');
  for (const s of candidateStats) {
    console.log(' ', s.status + ':', s.count);
  }

  const comps = await db.select({ count: sql`count(*)::int` }).from(renewalComparisons);
  console.log('\nComparisons created:', comps[0].count);
  process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
