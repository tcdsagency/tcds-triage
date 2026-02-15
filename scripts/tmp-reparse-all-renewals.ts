import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env.production.local') });

/**
 * Re-parse ALL renewal candidates that have rawAl3Content.
 *
 * Fixes three issues at once:
 *   1. Date-suffix coverage types (e.g., bi_260330 → bodily_injury)
 *   2. Missing COVERAGE_CODE_MAP entries now applied (mulp, alar1, etc.)
 *   3. 9AOI/DWELL fixes propagated to American Strategic renewals
 *
 * Also re-runs comparison engine when a baseline exists.
 */

async function run() {
  const { db } = await import('../src/db');
  const { renewalCandidates, renewalComparisons } = await import('../src/db/schema');
  const { desc, eq, isNotNull } = await import('drizzle-orm');
  const { parseAL3File } = await import('../src/lib/al3/parser');
  const { buildRenewalSnapshot } = await import('../src/lib/al3/snapshot-builder');
  const { compareSnapshots } = await import('../src/lib/al3/comparison-engine');

  // Query ALL candidates that have raw AL3 content
  const candidates = await db.select().from(renewalCandidates)
    .where(isNotNull(renewalCandidates.rawAl3Content))
    .orderBy(desc(renewalCandidates.createdAt));

  console.log(`Found ${candidates.length} candidates with rawAl3Content\n`);

  let updated = 0;
  let skipped = 0;
  let errors = 0;
  const dateSuffixFixes: string[] = [];
  const typeCountChanges: string[] = [];

  for (const c of candidates) {
    const label = `${c.policyNumber || '[blank]'} (${c.carrierName || 'unknown'})`;

    try {
      // Re-parse with current parser
      const transactions = parseAL3File(c.rawAl3Content!);
      const tx = transactions[0];
      if (!tx) {
        console.log(`  SKIP ${label} — no transactions parsed`);
        skipped++;
        continue;
      }

      // Rebuild renewal snapshot
      const snapshot = buildRenewalSnapshot(tx);
      const renewalSnapshot = { ...snapshot, sourceFileName: c.al3FileName } as any;
      const newCarrierName = tx.header.carrierName || c.carrierName;

      // Compare old vs new coverage types
      const oldSnapshot = c.renewalSnapshot as any;
      const oldTypes = new Set<string>(
        (oldSnapshot?.coverages || []).map((cv: any) => cv.type).filter(Boolean)
      );
      const newTypes = new Set<string>(
        snapshot.coverages.map((cv: any) => cv.type).filter(Boolean)
      );

      // Detect date-suffix types that got fixed
      const dateSuffixed = [...oldTypes].filter(t => /_\d{6}$/.test(t));
      if (dateSuffixed.length > 0) {
        dateSuffixFixes.push(`${label}: ${dateSuffixed.join(', ')}`);
      }

      // Detect type count changes
      if (oldTypes.size !== newTypes.size) {
        typeCountChanges.push(`${label}: ${oldTypes.size} → ${newTypes.size} types`);
      }

      // Check for dwelling in new snapshot (American Strategic fix)
      const hasDwelling = snapshot.coverages.some((cv: any) => cv.type === 'dwelling');
      const hadDwelling = (oldSnapshot?.coverages || []).some((cv: any) => cv.type === 'dwelling');

      const changes: string[] = [];
      if (dateSuffixed.length > 0) changes.push(`fixed ${dateSuffixed.length} date-suffixed types`);
      if (oldTypes.size !== newTypes.size) changes.push(`types: ${oldTypes.size}→${newTypes.size}`);
      if (hasDwelling && !hadDwelling) changes.push('DWELLING NOW FOUND');
      if (c.carrierName !== newCarrierName) changes.push(`carrier: ${c.carrierName}→${newCarrierName}`);

      // Update the candidate record
      await db.update(renewalCandidates)
        .set({
          carrierName: newCarrierName,
          renewalSnapshot: renewalSnapshot,
        })
        .where(eq(renewalCandidates.id, c.id));

      // Re-run comparison if baseline exists
      if (c.comparisonId && c.baselineSnapshot) {
        const baseline = c.baselineSnapshot as any;
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

        changes.push(`comparison updated (${comparison.materialChanges.length} material)`);
      }

      const changeStr = changes.length > 0 ? ` [${changes.join('; ')}]` : '';
      console.log(`  OK ${label}${changeStr}`);
      updated++;
    } catch (e: any) {
      console.log(`  ERR ${label} — ${e.message}`);
      errors++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  console.log(`Updated: ${updated}`);
  console.log(`Skipped: ${skipped}`);
  console.log(`Errors:  ${errors}`);

  if (dateSuffixFixes.length > 0) {
    console.log(`\nDate-suffix fixes (${dateSuffixFixes.length}):`);
    for (const f of dateSuffixFixes) console.log(`  ${f}`);
  }

  if (typeCountChanges.length > 0) {
    console.log(`\nType count changes (${typeCountChanges.length}):`);
    for (const t of typeCountChanges) console.log(`  ${t}`);
  }

  process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
