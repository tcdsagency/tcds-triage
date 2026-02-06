import dotenv from 'dotenv';
import path from 'path';
// Load env BEFORE any imports that use DATABASE_URL
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

// Dynamic import to ensure env is loaded first
async function run() {
  const { db } = await import('../src/db');
  const { renewalAuditLog, renewalCandidates, renewalComparisons, renewalBatches } = await import('../src/db/schema');
  const { count } = await import('drizzle-orm');

  console.log('Clearing renewal data...');

  await db.delete(renewalAuditLog);
  console.log('  Deleted audit_log rows');

  await db.delete(renewalCandidates);
  console.log('  Deleted candidates rows');

  await db.delete(renewalComparisons);
  console.log('  Deleted comparisons rows');

  await db.delete(renewalBatches);
  console.log('  Deleted batches rows');

  // Verify
  const [a] = await db.select({ c: count() }).from(renewalAuditLog);
  const [b] = await db.select({ c: count() }).from(renewalCandidates);
  const [d] = await db.select({ c: count() }).from(renewalComparisons);
  const [e] = await db.select({ c: count() }).from(renewalBatches);
  console.log(`\nVerification — audit_log: ${a.c} | candidates: ${b.c} | comparisons: ${d.c} | batches: ${e.c}`);
  console.log('Done.');
  process.exit(0);
}

run().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
