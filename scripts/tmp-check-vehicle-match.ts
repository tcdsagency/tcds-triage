import { db } from '../src/db';
import { renewalComparisons } from '../src/db/schema';
import { eq, like } from 'drizzle-orm';
import { compareSnapshots } from '../src/lib/al3/comparison-engine';
import type { RenewalSnapshot, BaselineSnapshot } from '../src/types/renewal.types';

async function main() {
  const [comp] = await db.select({
    id: renewalComparisons.id,
    renewalSnapshot: renewalComparisons.renewalSnapshot,
    baselineSnapshot: renewalComparisons.baselineSnapshot,
    renewalEffectiveDate: renewalComparisons.renewalEffectiveDate,
  }).from(renewalComparisons).where(
    like(renewalComparisons.policyNumber, '%978592726%')
  );

  const renewal = comp.renewalSnapshot as unknown as RenewalSnapshot;
  const baseline = comp.baselineSnapshot as unknown as BaselineSnapshot;

  const result = compareSnapshots(renewal, baseline, undefined, comp.renewalEffectiveDate?.toISOString());

  console.log('=== MATERIAL CHANGES ===');
  for (const c of result.materialChanges) {
    console.log(`  [${c.severity}] ${c.category}: ${c.description}`);
  }

  await db.update(renewalComparisons).set({
    materialChanges: result.materialChanges as any,
    comparisonSummary: result.summary as any,
    updatedAt: new Date(),
  }).where(eq(renewalComparisons.id, comp.id));

  console.log('\nRestored correct comparison data');
  process.exit(0);
}

main().catch(console.error);
