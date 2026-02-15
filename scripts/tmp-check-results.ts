import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env.production.local') });

async function run() {
  const { db } = await import('../src/db');
  const { renewalCandidates, renewalBatches } = await import('../src/db/schema');
  const { desc, sql } = await import('drizzle-orm');

  // Check batches
  const batches = await db.select().from(renewalBatches).orderBy(desc(renewalBatches.createdAt)).limit(5);
  console.log(`Batches: ${batches.length}`);
  for (const b of batches) {
    console.log(`  ${b.id.substring(0, 8)} | ${b.status} | files: ${b.totalFiles} | created: ${b.createdAt}`);
  }

  // Check all candidates
  const candidates = await db.select({
    id: renewalCandidates.id,
    policyNumber: renewalCandidates.policyNumber,
    carrierName: renewalCandidates.carrierName,
    lineOfBusiness: renewalCandidates.lineOfBusiness,
    status: renewalCandidates.status,
    customerId: renewalCandidates.customerId,
    policyId: renewalCandidates.policyId,
    effectiveDate: renewalCandidates.effectiveDate,
    transactionType: renewalCandidates.transactionType,
    errorMessage: renewalCandidates.errorMessage,
    rawAl3Content: renewalCandidates.rawAl3Content,
  }).from(renewalCandidates)
    .orderBy(desc(renewalCandidates.createdAt))
    .limit(30);

  console.log(`\nCandidates: ${candidates.length}\n`);
  for (const c of candidates) {
    const hasBaseline = c.policyId ? 'matched' : 'NO MATCH';
    const customer = c.customerId ? 'linked' : 'UNKNOWN';
    console.log(`  ${(c.policyNumber || '[blank]').padEnd(20)} | ${(c.carrierName || '[null]').padEnd(25)} | ${(c.lineOfBusiness || '-').padEnd(15)} | ${c.status.padEnd(12)} | customer: ${customer} | policy: ${hasBaseline} | eff: ${c.effectiveDate?.toISOString().split('T')[0] || '-'} | txType: ${c.transactionType || '-'}`);
    if (c.errorMessage) {
      console.log(`    ERROR: ${c.errorMessage}`);
    }
  }

  // Show the RSAL candidates specifically - check their raw content
  const rsals = candidates.filter(c => c.carrierName?.includes('RSAL'));
  console.log(`\n\n=== RSAL Candidates Detail ===`);
  for (const c of rsals) {
    console.log(`\nPolicy: ${c.policyNumber || '[blank]'} | Status: ${c.status}`);
    if (c.rawAl3Content) {
      const lines = c.rawAl3Content.split('\n');
      console.log(`  Raw lines: ${lines.length}`);
      // Show first few lines
      for (let i = 0; i < Math.min(5, lines.length); i++) {
        const display = lines[i].substring(0, 150).replace(/[\x00-\x1f\x80-\xff]/g, '?');
        console.log(`  [${i}] ${display}`);
      }
      // Show record types
      const recordTypes = new Set(lines.map(l => l.substring(0, 4).trim()).filter(Boolean));
      console.log(`  Record types: ${[...recordTypes].join(', ')}`);
    }
  }

  process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
