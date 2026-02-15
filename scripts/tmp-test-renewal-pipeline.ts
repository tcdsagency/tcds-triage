import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env.production.local') });

import * as fs from 'fs';
import { parseAL3File } from '../src/lib/al3/parser';
import { buildRenewalSnapshot } from '../src/lib/al3/snapshot-builder';
import { filterRenewalTransactions } from '../src/lib/al3/filter';
import { extractAL3FilesFromZip } from '../src/lib/al3/zip-extractor';

async function run() {
  // Dynamic imports for DB-dependent modules (dotenv must load first)
  const { buildBaselineSnapshot } = await import('../src/lib/al3/baseline-builder');
  const { compareSnapshots } = await import('../src/lib/al3/comparison-engine');

  const TENANT_ID = process.env.DEFAULT_TENANT_ID || 'demo-tenant';
  const zipPath = process.argv[2] || 'C:\\Users\\ToddConn\\Downloads\\Files_YX67JQA_20260210213318.zip';

  console.log('=== IVANS Renewal Pipeline Test ===\n');
  console.log('ZIP:', zipPath);
  console.log('Tenant:', TENANT_ID);

  const zipBuffer = fs.readFileSync(zipPath);
  const al3Files = await extractAL3FilesFromZip(zipBuffer);
  console.log(`AL3 files extracted: ${al3Files.length}\n`);

  let totalTransactions = 0;
  let renewalCount = 0;
  let baselineFound = 0;
  let baselineNull = 0;
  let comparisonsMade = 0;

  for (const file of al3Files) {
    const transactions = parseAL3File(file.content);
    totalTransactions += transactions.length;

    console.log(`\n--- File: ${file.fileName} ---`);
    console.log(`  Transactions parsed: ${transactions.length}`);

    // Filter to renewals
    const renewals = filterRenewalTransactions(transactions);
    console.log(`  Renewals: ${renewals.length}`);

    for (const tx of renewals) {
      renewalCount++;
      const h = tx.header;
      console.log(`\n  [${renewalCount}] ${h.carrierName || h.carrierCode} - ${h.policyNumber}`);
      console.log(`      LOB: ${h.lineOfBusiness}  Type: ${h.transactionType}`);
      console.log(`      Effective: ${h.effectiveDate}  Expires: ${h.expirationDate}`);
      console.log(`      Coverages: ${tx.coverages.length}  Vehicles: ${tx.vehicles.length}  Drivers: ${tx.drivers.length}`);

      // Build renewal snapshot from AL3
      const renewalSnapshot = buildRenewalSnapshot(tx);
      console.log(`      Renewal Snapshot: $${renewalSnapshot.totalPremium || 'N/A'} premium, ${renewalSnapshot.coverages.length} coverages`);

      if (renewalSnapshot.discounts.length > 0) {
        console.log(`      Discounts: ${renewalSnapshot.discounts.map(d => d.code).join(', ')}`);
      }

      // Try to build baseline from local DB
      try {
        const baselineResult = await buildBaselineSnapshot(
          TENANT_ID,
          h.policyNumber,
          h.carrierName || h.carrierCode,
          h.effectiveDate
        );

        if (baselineResult) {
          baselineFound++;
          const bs = baselineResult.snapshot;
          console.log(`      Baseline: FOUND (source: ${bs.fetchSource})`);
          console.log(`        Premium: $${bs.premium || 'N/A'}, Coverages: ${bs.coverages.length}, Vehicles: ${bs.vehicles.length}`);

          // Run comparison
          const comparison = compareSnapshots(renewalSnapshot, bs, undefined, h.effectiveDate);
          comparisonsMade++;
          console.log(`      Comparison: ${comparison.recommendation}`);
          console.log(`        Material Changes: ${comparison.materialChanges.length}`);
          if (comparison.materialChanges.length > 0) {
            for (const mc of comparison.materialChanges.slice(0, 5)) {
              console.log(`          - [${mc.severity}] ${mc.field}: ${mc.description}`);
            }
            if (comparison.materialChanges.length > 5) {
              console.log(`          ... and ${comparison.materialChanges.length - 5} more`);
            }
          }
          if (comparison.premiumChange) {
            const pc = comparison.premiumChange;
            console.log(`        Premium: $${pc.oldValue} → $${pc.newValue} (${pc.percentChange > 0 ? '+' : ''}${pc.percentChange.toFixed(1)}%)`);
          }
        } else {
          baselineNull++;
          console.log(`      Baseline: NOT FOUND (policy not in local DB)`);
        }
      } catch (err) {
        baselineNull++;
        console.log(`      Baseline: ERROR - ${err instanceof Error ? err.message : err}`);
      }
    }
  }

  console.log('\n\n=== SUMMARY ===');
  console.log(`Total transactions parsed: ${totalTransactions}`);
  console.log(`Renewal transactions:      ${renewalCount}`);
  console.log(`Baselines found:           ${baselineFound}`);
  console.log(`Baselines missing:         ${baselineNull}`);
  console.log(`Comparisons generated:     ${comparisonsMade}`);

  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
