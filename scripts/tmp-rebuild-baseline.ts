import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env.production.local') });

async function run() {
  const { db } = await import('../src/db');
  const { renewalCandidates } = await import('../src/db/schema');
  const { eq } = await import('drizzle-orm');
  const { buildBaselineSnapshot } = await import('../src/lib/al3/baseline-builder');

  const [c] = await db.select().from(renewalCandidates).where(eq(renewalCandidates.policyNumber, 'BQ01-AVMZJK'));
  if (!c) {
    console.log('Not found');
    process.exit(0);
  }

  console.log('Rebuilding baseline for policy:', c.policyNumber);
  console.log('Carrier:', c.carrierName);
  console.log('Tenant:', c.tenantId);

  const result = await buildBaselineSnapshot(c.tenantId, c.policyNumber, c.carrierName || '');

  if (!result) {
    console.log('Failed to build baseline snapshot');
    process.exit(1);
  }

  console.log('\nBaseline snapshot built:');
  console.log('  policyId:', result.policyId);
  console.log('  customerId:', result.customerId);
  console.log('  coverages:', result.snapshot.coverages.length);

  console.log('\nCoverages:');
  for (const cov of result.snapshot.coverages) {
    console.log('  -', cov.type.padEnd(25), '| Limit:', cov.limitAmount);
  }

  // Update the database
  console.log('\nUpdating database...');
  await db.update(renewalCandidates)
    .set({
      baselineSnapshot: result.snapshot,
      baselineCapturedAt: new Date(),
      policyId: result.policyId,
      customerId: result.customerId,
    })
    .where(eq(renewalCandidates.id, c.id));

  console.log('Done!');
  process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
