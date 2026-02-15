import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env.production.local') });

async function run() {
  const { db } = await import('../src/db');
  const { renewalCandidates, renewalBatches } = await import('../src/db/schema');
  const { desc } = await import('drizzle-orm');

  const batches = await db.select().from(renewalBatches).orderBy(desc(renewalBatches.createdAt));
  console.log('Batches:');
  for (const b of batches) {
    console.log(`  ${b.id.substring(0,8)} | created: ${b.createdAt} | status: ${b.status}`);
  }

  const candidates = await db.select({
    policyNumber: renewalCandidates.policyNumber,
    batchId: renewalCandidates.batchId,
    effectiveDate: renewalCandidates.effectiveDate,
  }).from(renewalCandidates).orderBy(desc(renewalCandidates.createdAt));

  console.log('\nCandidates by batch:');
  for (const c of candidates) {
    const batch = c.batchId?.substring(0,8) || 'none';
    const eff = c.effectiveDate?.toISOString().split('T')[0] || 'none';
    const isPast = eff <= '2026-02-12';
    console.log(`  ${batch} | ${(c.policyNumber||'').padEnd(20)} | eff: ${eff} ${isPast ? '<-- SHOULD BE FILTERED' : ''}`);
  }

  process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
