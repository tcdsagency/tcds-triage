import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env.production.local') });

async function run() {
  const { db } = await import('../src/db');
  const { renewalCandidates } = await import('../src/db/schema');
  const { desc } = await import('drizzle-orm');

  const candidates = await db.select({
    policyNumber: renewalCandidates.policyNumber,
    carrierName: renewalCandidates.carrierName,
    renewalSnapshot: renewalCandidates.renewalSnapshot,
    comparisonResult: renewalCandidates.comparisonResult,
  }).from(renewalCandidates)
    .orderBy(desc(renewalCandidates.createdAt))
    .limit(10);

  for (const c of candidates) {
    const snap = c.renewalSnapshot as any;
    const comp = c.comparisonResult as any;
    console.log(`\n${c.policyNumber || '[blank]'} (${c.carrierName})`);
    if (snap) {
      console.log(`  Coverages: ${snap.coverages?.length || 0}, Premium: ${snap.premium}`);
      // Show major coverage types
      const major = ['dwelling', 'other_structures', 'personal_property', 'loss_of_use', 'personal_liability'];
      for (const type of major) {
        const cov = snap.coverages?.find((c: any) => c.type === type);
        if (cov) {
          console.log(`  ${type}: limit=${cov.limitAmount || '-'}, prem=${cov.premium ?? '-'}`);
        }
      }
    }
    if (comp) {
      console.log(`  Comparison: ${comp.materialChanges?.length || 0} material, ${comp.nonMaterialChanges?.length || 0} non-material, rec=${comp.recommendation}`);
    }
  }

  process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
