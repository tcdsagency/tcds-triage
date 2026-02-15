import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env.production.local') });

import * as fs from 'fs';
import { parseAL3File } from '../src/lib/al3/parser';
import { buildRenewalSnapshot } from '../src/lib/al3/snapshot-builder';
import { DISCOUNT_COVERAGE_TYPES } from '../src/lib/al3/constants';
import { resolveCoverageDisplayName, COVERAGE_DISPLAY_NAMES } from '../src/lib/coverage-display-names';

const BASE_DIR = path.resolve(__dirname, '../tmp-al3-extract');

// Recursively find all .dat/.DAT files, dedupe by content hash
function findDatFiles(dir: string): string[] {
  const results: string[] = [];
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        results.push(...findDatFiles(full));
      } else if (/\.(dat|DAT|J\d+)$/i.test(entry.name) && !entry.name.endsWith('.zip')) {
        results.push(full);
      }
    }
  } catch {}
  return results;
}

// Deduplicate by file size + first 200 bytes
function dedupeFiles(files: string[]): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const f of files) {
    try {
      const stat = fs.statSync(f);
      const buf = Buffer.alloc(200);
      const fd = fs.openSync(f, 'r');
      fs.readSync(fd, buf, 0, 200, 0);
      fs.closeSync(fd);
      const key = `${stat.size}:${buf.toString('hex')}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(f);
      }
    } catch {}
  }
  return unique;
}

const allFiles = findDatFiles(BASE_DIR);
const files = dedupeFiles(allFiles);

console.log(`Found ${allFiles.length} total .dat files, ${files.length} unique\n`);

let totalTransactions = 0;
let totalParsed = 0;
let totalErrors = 0;
let carrierCounts: Record<string, number> = {};
let lobCounts: Record<string, number> = {};
let unmappedCodes = new Set<string>();
let allCoverageTypes = new Set<string>();
let fileErrors: { file: string; error: string }[] = [];
let parsedPolicies: {
  file: string;
  policy: string;
  carrier: string;
  lob: string;
  insured: string;
  premium: number | null;
  coverageCount: number;
  deductibleCount: number;
  unmapped: string[];
}[] = [];

for (const file of files) {
  const relPath = path.relative(BASE_DIR, file);
  try {
    const content = fs.readFileSync(file, 'latin1');
    if (content.length < 50) continue; // skip tiny files

    const transactions = parseAL3File(content);
    if (transactions.length === 0) {
      // Not an error — might be a non-AL3 file
      continue;
    }

    totalTransactions += transactions.length;

    for (const tx of transactions) {
      try {
        const snapshot = buildRenewalSnapshot(tx);
        totalParsed++;

        const carrier = snapshot.carrierName || tx.header.carrierName || 'UNKNOWN';
        const lob = snapshot.lineOfBusiness || tx.header.lineOfBusiness || 'UNKNOWN';
        carrierCounts[carrier] = (carrierCounts[carrier] || 0) + 1;
        lobCounts[lob] = (lobCounts[lob] || 0) + 1;

        // Check for unmapped coverage types (ones that just title-case the raw code)
        const realCovs = snapshot.coverages.filter(c => !c.type || !DISCOUNT_COVERAGE_TYPES.has(c.type));
        const deductibleCovs = realCovs.filter(c => c.deductibleAmount != null);
        const fileUnmapped: string[] = [];

        for (const c of realCovs) {
          if (!c.type) continue;
          allCoverageTypes.add(c.type);
          // A type is "mapped" if it exists in the display names map
          if (COVERAGE_DISPLAY_NAMES[c.type]) continue;
          // Multi-word canonical types (contain underscore) are already human-readable
          if (c.type.includes('_')) continue;
          // Short all-lowercase codes that aren't in the map are truly unmapped
          unmappedCodes.add(`${c.type} (${c.code || '?'}) [${carrier}]`);
          fileUnmapped.push(c.type);
        }

        parsedPolicies.push({
          file: relPath,
          policy: snapshot.policyNumber || tx.header.policyNumber || '?',
          carrier,
          lob,
          insured: snapshot.insuredName || tx.header.insuredName || '?',
          premium: snapshot.totalPremium,
          coverageCount: realCovs.length,
          deductibleCount: deductibleCovs.length,
          unmapped: fileUnmapped,
        });
      } catch (err: any) {
        totalErrors++;
        fileErrors.push({ file: relPath, error: err.message });
      }
    }
  } catch (err: any) {
    totalErrors++;
    fileErrors.push({ file: relPath, error: err.message });
  }
}

// ===== REPORT =====
console.log('='.repeat(70));
console.log('ORION180 AL3 PARSING VERIFICATION REPORT');
console.log('='.repeat(70));
console.log(`\nFiles processed: ${files.length}`);
console.log(`Transactions found: ${totalTransactions}`);
console.log(`Successfully parsed: ${totalParsed}`);
console.log(`Errors: ${totalErrors}`);

console.log('\n--- CARRIERS ---');
for (const [carrier, count] of Object.entries(carrierCounts).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${carrier}: ${count} policies`);
}

console.log('\n--- LINES OF BUSINESS ---');
for (const [lob, count] of Object.entries(lobCounts).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${lob}: ${count} policies`);
}

console.log('\n--- ALL COVERAGE TYPES SEEN ---');
const sortedTypes = Array.from(allCoverageTypes).sort();
for (const t of sortedTypes) {
  const display = resolveCoverageDisplayName(t);
  const isInMap = !!COVERAGE_DISPLAY_NAMES[t] || t.includes('_');
  const marker = isInMap ? '' : ' ⚠️ UNMAPPED';
  console.log(`  ${t.padEnd(35)} → ${display}${marker}`);
}

if (unmappedCodes.size > 0) {
  console.log('\n--- UNMAPPED COVERAGE CODES (need display names) ---');
  for (const code of Array.from(unmappedCodes).sort()) {
    console.log(`  ${code}`);
  }
}

if (fileErrors.length > 0) {
  console.log('\n--- ERRORS ---');
  for (const { file, error } of fileErrors.slice(0, 20)) {
    console.log(`  ${file}: ${error}`);
  }
  if (fileErrors.length > 20) console.log(`  ... and ${fileErrors.length - 20} more`);
}

// Show sample policies
console.log('\n--- SAMPLE POLICIES (first 15) ---');
for (const p of parsedPolicies.slice(0, 15)) {
  console.log(`  ${p.policy.padEnd(18)} ${p.carrier.padEnd(20)} ${p.lob.padEnd(20)} ${p.insured}`);
  console.log(`    Premium: ${p.premium != null ? '$' + p.premium.toLocaleString() : '-'}  Covs: ${p.coverageCount}  Deds: ${p.deductibleCount}`);
  if (p.unmapped.length > 0) {
    console.log(`    ⚠️ Unmapped: ${p.unmapped.join(', ')}`);
  }
}

// Policies with unmapped codes
const withUnmapped = parsedPolicies.filter(p => p.unmapped.length > 0);
if (withUnmapped.length > 0) {
  console.log(`\n--- POLICIES WITH UNMAPPED CODES: ${withUnmapped.length} of ${parsedPolicies.length} ---`);
  for (const p of withUnmapped.slice(0, 10)) {
    console.log(`  ${p.policy} (${p.carrier}): ${p.unmapped.join(', ')}`);
  }
}

console.log('\n--- SUMMARY ---');
console.log(`✓ ${totalParsed} policies parsed successfully`);
console.log(`✗ ${totalErrors} errors`);
console.log(`⚠️ ${unmappedCodes.size} unmapped coverage codes`);
console.log(`Total unique coverage types: ${allCoverageTypes.size}`);

process.exit(totalErrors > 0 ? 1 : 0);
