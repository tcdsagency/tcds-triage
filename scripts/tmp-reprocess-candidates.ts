import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env.production.local') });

async function run() {
  const { db } = await import('../src/db');
  const { renewalCandidates, renewalComparisons } = await import('../src/db/schema');
  const { desc, eq } = await import('drizzle-orm');
  const { parseAL3File } = await import('../src/lib/al3/parser');
  const { buildRenewalSnapshot } = await import('../src/lib/al3/snapshot-builder');
  const { compareSnapshots } = await import('../src/lib/al3/comparison-engine');

  // Get recent candidates with raw AL3 content
  const candidates = await db.select().from(renewalCandidates)
    .orderBy(desc(renewalCandidates.createdAt))
    .limit(20);

  const toReprocess = candidates.filter(c => c.rawAl3Content && c.baselineSnapshot);
  console.log(`Found ${toReprocess.length} candidates to re-process\n`);

  for (const c of toReprocess) {
    console.log(`${'='.repeat(70)}`);
    console.log(`Re-processing: ${c.policyNumber || '[blank]'} (${c.carrierName})`);

    try {
      // Re-parse with fixed parser
      const transactions = parseAL3File(c.rawAl3Content!);
      const tx = transactions[0];
      if (!tx) { console.log('  No transactions!'); continue; }

      // Update carrier name from parsed data
      const newCarrierName = tx.header.carrierName || c.carrierName;

      // Rebuild renewal snapshot
      const snapshot = buildRenewalSnapshot(tx);
      const renewalSnapshot = { ...snapshot, sourceFileName: c.al3FileName };

      console.log(`  Carrier: ${c.carrierName} → ${newCarrierName}`);
      console.log(`  Coverages: ${snapshot.coverages.length}`);
      console.log(`  Premium: ${snapshot.premium}`);

      // Re-run comparison
      const baseline = c.baselineSnapshot as any;
      // Ensure baseline has all expected arrays
      baseline.coverages = baseline.coverages || [];
      baseline.vehicles = baseline.vehicles || [];
      baseline.drivers = baseline.drivers || [];
      baseline.discounts = baseline.discounts || [];

      const comparison = compareSnapshots(
        renewalSnapshot,
        baseline,
        undefined,
        c.effectiveDate?.toISOString()
      );

      console.log(`  Comparison: ${comparison.materialChanges.length} material, ${comparison.nonMaterialChanges.length} non-material, rec=${comparison.recommendation}`);

      // Update the candidate record (carrier name + renewed snapshot)
      await db.update(renewalCandidates)
        .set({
          carrierName: newCarrierName,
          renewalSnapshot: renewalSnapshot,
        })
        .where(eq(renewalCandidates.id, c.id));

      // Update the comparison record if it exists
      if (c.comparisonId) {
        await db.update(renewalComparisons)
          .set({
            carrierName: newCarrierName,
            renewalSnapshot: renewalSnapshot,
            renewalPremium: snapshot.premium?.toString() || null,
            materialChanges: comparison.materialChanges as any,
            comparisonSummary: comparison.summary as any,
            recommendation: comparison.recommendation,
            premiumChangeAmount: comparison.summary?.premiumChangeAmount?.toString() || null,
            premiumChangePercent: comparison.summary?.premiumChangePercent?.toString() || null,
          })
          .where(eq(renewalComparisons.id, c.comparisonId));
        console.log('  ✓ Updated candidate + comparison');
      } else {
        console.log('  ✓ Updated candidate (no comparison record)');
      }
    } catch (e: any) {
      console.log(`  ERROR: ${e.message}`);
    }
    console.log('');
  }

  process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
