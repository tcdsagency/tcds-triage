import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env.production.local') });

async function run() {
  const { db } = await import('../src/db');
  const { renewalComparisons } = await import('../src/db/schema');
  const { eq } = await import('drizzle-orm');
  const { compareSnapshots } = await import('../src/lib/al3/comparison-engine');

  const comps = await db.select().from(renewalComparisons);
  console.log('Found ' + comps.length + ' comparisons to backfill\n');

  for (const c of comps) {
    const renewalSnapshot = c.renewalSnapshot as any;
    const baselineSnapshot = c.baselineSnapshot as any;
    const renewalEffDate = c.renewalEffectiveDate instanceof Date
      ? c.renewalEffectiveDate.toISOString().split('T')[0]
      : String(c.renewalEffectiveDate || '').split('T')[0];

    // Re-run comparison to get baselineStatus
    const result = compareSnapshots(
      renewalSnapshot,
      baselineSnapshot,
      undefined,
      renewalEffDate
    );

    // Update comparisonSummary with baselineStatus
    const currentSummary = c.comparisonSummary as any || {};
    const updatedSummary = {
      ...currentSummary,
      baselineStatus: result.baselineStatus,
      baselineStatusReason: result.baselineStatusReason
    };

    await db.update(renewalComparisons)
      .set({ comparisonSummary: updatedSummary })
      .where(eq(renewalComparisons.id, c.id));

    console.log(c.policyNumber + ': ' + result.baselineStatus + (result.baselineStatusReason ? ' - ' + result.baselineStatusReason : ''));
  }

  console.log('\nBackfill complete!');
  process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
