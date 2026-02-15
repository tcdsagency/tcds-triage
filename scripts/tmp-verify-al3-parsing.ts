import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env.production.local') });

import * as fs from 'fs';
import { parseAL3File } from '../src/lib/al3/parser';
import { DISCOUNT_COVERAGE_TYPES } from '../src/lib/al3/constants';
import { buildRenewalSnapshot, normalizeCoverageType } from '../src/lib/al3/snapshot-builder';

// Read the extracted Allstate file which has both home and auto
// IMPORTANT: Use latin1 encoding to preserve 0xFA EDIFACT separator bytes
const content = fs.readFileSync('C:\\Users\\ToddConn\\tcds-triage\\tmp-al3-extract\\progdat\\0C5481.DAT', 'latin1');

console.log('=== AL3 PARSING VERIFICATION ===\n');
console.log('File length:', content.length, 'bytes\n');

const transactions = parseAL3File(content);
console.log('Transactions parsed:', transactions.length);

for (const tx of transactions) {
  // Build snapshot to get normalized types
  const snapshot = buildRenewalSnapshot(tx);

  console.log('\n' + '='.repeat(60));
  console.log('Policy:', snapshot.policyNumber || tx.header.policyNumber);
  console.log('LOB:', snapshot.lineOfBusiness || tx.header.lineOfBusiness);
  console.log('Carrier:', snapshot.carrierName || tx.header.carrierName);
  console.log('Insured:', snapshot.insuredName || tx.header.insuredName);
  console.log('Eff Date:', snapshot.effectiveDate);
  console.log('Exp Date:', snapshot.expirationDate);
  console.log('Premium:', snapshot.totalPremium);

  console.log('\n--- COVERAGES ---');
  const realCoverages = snapshot.coverages.filter(c => !c.type || !DISCOUNT_COVERAGE_TYPES.has(c.type));
  const discountCoverages = snapshot.coverages.filter(c => c.type && DISCOUNT_COVERAGE_TYPES.has(c.type));

  console.log('Real coverages:', realCoverages.length);
  for (const c of realCoverages.slice(0, 10)) {
    const code = (c.code || 'N/A').padEnd(10);
    const type = (c.type || 'unknown').padEnd(25);
    console.log(`  ${code} ${type} Limit:${c.limitAmount ?? '-'} Ded:${c.deductibleAmount ?? '-'} Prem:${c.premium ?? '-'}`);
    if (c.description && c.description !== c.code) {
      console.log(`    Desc: ${c.description}`);
    }
  }
  if (realCoverages.length > 10) console.log(`  ... and ${realCoverages.length - 10} more`);

  console.log('\n--- DISCOUNT COVERAGES ---');
  console.log('Discount codes found:', discountCoverages.length);
  for (const c of discountCoverages) {
    const code = (c.code || 'N/A').padEnd(10);
    const type = (c.type || 'unknown').padEnd(30);
    console.log(`  ${code} → ${type} ${c.description || ''}`);
  }

  console.log('\n--- VEHICLES ---');
  console.log('Vehicles:', snapshot.vehicles.length);
  for (const v of snapshot.vehicles) {
    console.log(`  #${v.number}: ${v.year} ${v.make} ${v.model}`);
    console.log(`    VIN: ${v.vin}`);
    console.log(`    Coverages: ${v.coverages.length}`);
    const vehDiscounts = v.coverages.filter(c => c.type && DISCOUNT_COVERAGE_TYPES.has(c.type));
    if (vehDiscounts.length > 0) {
      console.log('    Vehicle Discounts:');
      for (const d of vehDiscounts) {
        console.log(`      ${d.type}`);
      }
    }
  }

  console.log('\n--- DRIVERS ---');
  console.log('Drivers:', snapshot.drivers.length);
  for (const d of snapshot.drivers) {
    console.log(`  ${d.firstName} ${d.lastName}, DOB: ${d.dateOfBirth}`);
  }

  console.log('\n--- DISCOUNTS (from snapshot) ---');
  console.log('Discounts:', snapshot.discounts.length);
  for (const d of snapshot.discounts) {
    console.log(`  ${d.code} - ${d.description}`);
  }

  console.log('\n--- MORTGAGEES ---');
  console.log('Mortgagees:', snapshot.mortgagees?.length || 0);
  for (const m of snapshot.mortgagees || []) {
    console.log(`  ${m.name} (${m.interestType})`);
    console.log(`    Loan: ${m.loanNumber}`);
  }
}

console.log('\n\n=== SUMMARY ===');
console.log('Total transactions:', transactions.length);

// Build all snapshots and count discounts
const allSnapshots = transactions.map(t => buildRenewalSnapshot(t));
const allDiscounts = allSnapshots.flatMap(s => s.discounts);
console.log('Total discount codes captured:', allDiscounts.length);
const uniqueDiscountCodes = new Set(allDiscounts.map(d => d.code));
console.log('Unique discount codes:', Array.from(uniqueDiscountCodes).join(', '));

process.exit(0);
