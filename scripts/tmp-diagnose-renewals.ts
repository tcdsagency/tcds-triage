import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env.production.local') });

async function run() {
  const { db } = await import('../src/db/index.js');
  const { renewalCandidates } = await import('../src/db/schema.js');
  const { desc } = await import('drizzle-orm');

  const candidates = await db.select()
    .from(renewalCandidates)
    .orderBy(desc(renewalCandidates.createdAt))
    .limit(5);

  console.log(`\n=== DIAGNOSING ${candidates.length} RECENT RENEWALS ===\n`);

  for (const c of candidates) {
    console.log('='.repeat(80));
    console.log(`POLICY: ${c.policyNumber} | ${c.carrierName} | ${c.lineOfBusiness}`);
    console.log('='.repeat(80));

    const baseline = c.baselineSnapshot as any;
    const renewal = c.renewalSnapshot as any;
    const comparison = c.comparisonResult as any;

    // 1. PREMIUM CHECK
    console.log('\n--- PREMIUM ---');
    console.log('  Baseline premium:', baseline?.premium ?? 'MISSING');
    console.log('  Renewal premium:', renewal?.premium ?? 'MISSING');
    if (baseline?.premium && renewal?.premium) {
      const diff = renewal.premium - baseline.premium;
      const pct = ((diff / baseline.premium) * 100).toFixed(1);
      console.log(`  Change: ${diff >= 0 ? '+' : ''}$${diff.toFixed(2)} (${pct}%)`);
    }

    // 2. COMPARISON RESULT
    console.log('\n--- COMPARISON RESULT ---');
    console.log('  Recommendation:', comparison?.recommendation ?? 'MISSING');
    console.log('  Material changes count:', comparison?.materialChanges?.length ?? 0);

    if (comparison?.materialChanges?.length > 0) {
      console.log('  Material changes:');
      for (const mc of comparison.materialChanges.slice(0, 10)) {
        console.log(`    - [${mc.category}] ${mc.field}: ${mc.message || ''}`);
        if (mc.baselineValue !== undefined) console.log(`      baseline: ${JSON.stringify(mc.baselineValue)}`);
        if (mc.renewalValue !== undefined) console.log(`      renewal: ${JSON.stringify(mc.renewalValue)}`);
      }
      if (comparison.materialChanges.length > 10) {
        console.log(`    ... and ${comparison.materialChanges.length - 10} more`);
      }
    }

    // 3. BASELINE COVERAGES
    console.log('\n--- BASELINE COVERAGES ---');
    if (baseline?.coverages?.length > 0) {
      for (const cov of baseline.coverages.slice(0, 8)) {
        console.log(`  ${(cov.type || cov.code || 'unknown').padEnd(25)} | limit: ${String(cov.limit ?? cov.limitAmount ?? 'N/A').padEnd(12)} | ded: ${String(cov.deductible ?? cov.deductibleAmount ?? 'N/A').padEnd(8)} | prem: ${cov.premium ?? 'N/A'}`);
      }
      if (baseline.coverages.length > 8) console.log(`  ... and ${baseline.coverages.length - 8} more`);
    } else {
      console.log('  NO COVERAGES');
    }

    // 4. RENEWAL COVERAGES
    console.log('\n--- RENEWAL COVERAGES ---');
    if (renewal?.coverages?.length > 0) {
      for (const cov of renewal.coverages.slice(0, 8)) {
        console.log(`  ${(cov.type || cov.code || 'unknown').padEnd(25)} | limit: ${String(cov.limit ?? cov.limitAmount ?? 'N/A').padEnd(12)} | ded: ${String(cov.deductible ?? cov.deductibleAmount ?? 'N/A').padEnd(8)} | prem: ${cov.premium ?? 'N/A'}`);
      }
      if (renewal.coverages.length > 8) console.log(`  ... and ${renewal.coverages.length - 8} more`);
    } else {
      console.log('  NO COVERAGES');
    }

    // 5. DRIVERS
    console.log('\n--- DRIVERS ---');
    console.log('  Baseline:', baseline?.drivers?.length ?? 0, 'drivers');
    if (baseline?.drivers?.length > 0) {
      for (const d of baseline.drivers) {
        console.log(`    ${d.firstName} ${d.lastName} | DOB: ${d.dateOfBirth ?? 'N/A'}`);
      }
    }
    console.log('  Renewal:', renewal?.drivers?.length ?? 0, 'drivers');
    if (renewal?.drivers?.length > 0) {
      for (const d of renewal.drivers) {
        console.log(`    ${d.firstName} ${d.lastName} | DOB: ${d.dateOfBirth ?? 'N/A'}`);
      }
    }

    // 6. VEHICLES
    console.log('\n--- VEHICLES ---');
    console.log('  Baseline:', baseline?.vehicles?.length ?? 0, 'vehicles');
    if (baseline?.vehicles?.length > 0) {
      for (const v of baseline.vehicles) {
        console.log(`    ${v.year} ${v.make} ${v.model} | VIN: ${v.vin ?? 'N/A'}`);
      }
    }
    console.log('  Renewal:', renewal?.vehicles?.length ?? 0, 'vehicles');
    if (renewal?.vehicles?.length > 0) {
      for (const v of renewal.vehicles) {
        console.log(`    ${v.year} ${v.make} ${v.model} | VIN: ${v.vin ?? 'N/A'}`);
      }
    }

    // 7. RAW AL3 CHECK
    console.log('\n--- RAW AL3 ---');
    if (c.rawAl3Content) {
      const lines = c.rawAl3Content.split(/\r?\n/);
      console.log(`  Total lines: ${lines.length}`);

      // Check for 5BPI (premium)
      const bpiLines = lines.filter(l => l.startsWith('5BPI'));
      console.log(`  5BPI records: ${bpiLines.length}`);

      // Check for coverage records
      const cvaLines = lines.filter(l => l.startsWith('6CVA'));
      const cvhLines = lines.filter(l => l.startsWith('6CVH'));
      console.log(`  6CVA records: ${cvaLines.length}, 6CVH records: ${cvhLines.length}`);
    } else {
      console.log('  NO RAW AL3 CONTENT');
    }

    console.log('\n');
  }

  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
