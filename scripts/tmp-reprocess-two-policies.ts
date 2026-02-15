import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
dotenv.config({ path: path.resolve(__dirname, '../.env.production.local') });

const FILE_MAP: Record<string, string> = {
  '885225705': path.resolve(__dirname, '../tmp-al3-extract/progdat/0C5481.DAT'),
  '0301-2000-1138': path.resolve(__dirname, '../tmp-al3-extract/al3dat/AL33636.DAT'),
};

async function run() {
  const { db } = await import('../src/db');
  const { renewalComparisons } = await import('../src/db/schema');
  const { eq, or, ilike } = await import('drizzle-orm');
  const { parseAL3File } = await import('../src/lib/al3/parser');
  const { buildRenewalSnapshot } = await import('../src/lib/al3/snapshot-builder');
  const { compareSnapshots } = await import('../src/lib/al3/comparison-engine');

  const comps = await db.select().from(renewalComparisons)
    .where(or(
      ilike(renewalComparisons.policyNumber, '%0301-2000-1138%'),
      ilike(renewalComparisons.policyNumber, '%885225705%')
    ));

  console.log(`Found ${comps.length} comparisons to reprocess\n`);

  for (const comp of comps) {
    console.log(`${'='.repeat(70)}`);
    console.log(`Policy: ${comp.policyNumber} (${comp.carrierName}) — LOB: ${comp.lineOfBusiness}`);

    const filePath = FILE_MAP[comp.policyNumber!];
    if (!filePath || !fs.existsSync(filePath)) {
      console.log(`  ✗ AL3 file not found: ${filePath}`);
      continue;
    }

    try {
      // Read with latin1 for EDIFACT 0xFA bytes
      const content = fs.readFileSync(filePath, 'latin1');
      console.log(`  File: ${path.basename(filePath)} (${content.length} bytes)`);

      // Re-parse with fixed parser
      const transactions = parseAL3File(content);
      console.log(`  Parsed ${transactions.length} transaction(s)`);

      // Find the matching transaction by policy number
      let tx = transactions.find(t => t.header.policyNumber === comp.policyNumber);
      if (!tx) tx = transactions[0];
      if (!tx) { console.log('  ✗ No transactions parsed!'); continue; }

      const newCarrierName = tx.header.carrierName || comp.carrierName;
      const newLob = tx.header.lineOfBusiness || comp.lineOfBusiness;

      // Rebuild renewal snapshot
      const snapshot = buildRenewalSnapshot(tx);
      const renewalSnapshot = { ...snapshot, sourceFileName: path.basename(filePath) };

      console.log(`  Carrier: ${comp.carrierName} → ${newCarrierName}`);
      console.log(`  LOB: ${comp.lineOfBusiness} → ${newLob}`);
      console.log(`  Coverages: ${snapshot.coverages.length}`);
      console.log(`  Vehicles: ${snapshot.vehicles?.length || 0}`);
      console.log(`  Drivers: ${snapshot.drivers?.length || 0}`);
      console.log(`  Discounts: ${snapshot.discounts?.length || 0}`);
      console.log(`  Premium: ${snapshot.premium}`);

      // Re-run comparison against baseline
      const baseline = comp.baselineSnapshot as any;
      if (!baseline) {
        console.log('  ✗ No baseline — updating snapshot/LOB only');
        await db.update(renewalComparisons)
          .set({
            carrierName: newCarrierName,
            lineOfBusiness: newLob,
            renewalSnapshot: renewalSnapshot,
            renewalPremium: snapshot.premium?.toString() || null,
          })
          .where(eq(renewalComparisons.id, comp.id));
        console.log('  ✓ Updated');
        continue;
      }

      baseline.coverages = baseline.coverages || [];
      baseline.vehicles = baseline.vehicles || [];
      baseline.drivers = baseline.drivers || [];
      baseline.discounts = baseline.discounts || [];

      const comparison = compareSnapshots(
        renewalSnapshot,
        baseline,
        undefined,
        comp.renewalEffectiveDate?.toISOString()
      );

      console.log(`  Changes: ${comparison.materialChanges.length} material, ${comparison.nonMaterialChanges.length} non-material`);
      console.log(`  Recommendation: ${comparison.recommendation}`);
      if (comparison.materialChanges.length > 0) {
        for (const mc of comparison.materialChanges) {
          console.log(`    - ${mc.category}: ${mc.field} (${mc.severity})`);
        }
      }

      // Update comparison record
      await db.update(renewalComparisons)
        .set({
          carrierName: newCarrierName,
          lineOfBusiness: newLob,
          renewalSnapshot: renewalSnapshot,
          renewalPremium: snapshot.premium?.toString() || null,
          materialChanges: comparison.materialChanges as any,
          comparisonSummary: comparison.summary as any,
          recommendation: comparison.recommendation,
          premiumChangeAmount: comparison.summary?.premiumChangeAmount?.toString() || null,
          premiumChangePercent: comparison.summary?.premiumChangePercent?.toString() || null,
        })
        .where(eq(renewalComparisons.id, comp.id));

      console.log('  ✓ Updated comparison');
    } catch (e: any) {
      console.log(`  ERROR: ${e.message}`);
      console.log(`  ${e.stack?.split('\n').slice(1, 3).join('\n  ')}`);
    }
    console.log('');
  }

  process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
