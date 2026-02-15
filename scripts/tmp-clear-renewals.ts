import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env.production.local') });

async function run() {
  const { db } = await import('../src/db');
  const { renewalAuditLog, renewalCandidates, renewalComparisons, renewalBatches } = await import('../src/db/schema');
  const { sql } = await import('drizzle-orm');

  // Count before
  const [candidateCount] = await db.select({ count: sql<number>`count(*)` }).from(renewalCandidates);
  const [comparisonCount] = await db.select({ count: sql<number>`count(*)` }).from(renewalComparisons);
  const [batchCount] = await db.select({ count: sql<number>`count(*)` }).from(renewalBatches);

  console.log('Current counts:');
  console.log(`  Candidates: ${candidateCount.count}`);
  console.log(`  Comparisons: ${comparisonCount.count}`);
  console.log(`  Batches: ${batchCount.count}`);

  // Delete in order (respect foreign keys)
  console.log('\nClearing...');
  await db.delete(renewalAuditLog);
  console.log('  ✓ Audit log cleared');
  await db.delete(renewalCandidates);
  console.log('  ✓ Candidates cleared');
  await db.delete(renewalComparisons);
  console.log('  ✓ Comparisons cleared');
  await db.delete(renewalBatches);
  console.log('  ✓ Batches cleared');

  console.log('\nAll renewal data cleared. Ready for re-upload.');
  process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
