import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env.production.local') });

import { parseAL3File } from '../src/lib/al3/parser.js';
import { buildRenewalSnapshot } from '../src/lib/al3/snapshot-builder.js';

async function run() {
  const { db } = await import('../src/db/index.js');
  const { renewalCandidates } = await import('../src/db/schema.js');
  const { eq } = await import('drizzle-orm');

  // Get GEICO policy to verify commercial vehicle parsing
  const [candidate] = await db.select()
    .from(renewalCandidates)
    .where(eq(renewalCandidates.policyNumber, '9300129277'))
    .limit(1);

  if (!candidate?.rawAl3Content) {
    console.log('Candidate not found');
    process.exit(1);
  }

  console.log('=== RAW AL3 LINES ===\n');
  const lines = candidate.rawAl3Content.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const prefix = line.substring(0, 4);
    console.log(`[${i.toString().padStart(2)}] ${prefix} | len=${line.length.toString().padStart(3)} | ${line.substring(0, 100)}`);
  }

  // Debug: Check switch case matching
  console.log('\n=== GROUP CODE MATCHING ===');
  const { AL3_GROUP_CODES } = await import('../src/lib/al3/constants.js');
  for (let i = 0; i < Math.min(lines.length, 40); i++) {
    const line = lines[i];
    const gc = line.substring(0, 4);
    let matched = 'UNKNOWN';
    for (const [key, val] of Object.entries(AL3_GROUP_CODES)) {
      if (gc === val) {
        matched = key;
        break;
      }
    }
    console.log(`[${i.toString().padStart(2)}] ${gc} -> ${matched}`);
  }

  console.log('\n\n=== PARSED TRANSACTIONS ===\n');
  const transactions = parseAL3File(candidate.rawAl3Content);
  console.log('Transactions found:', transactions.length);

  for (const tx of transactions) {
    console.log('\n--- Transaction ---');
    console.log('Header:', JSON.stringify(tx.header, null, 2));
    console.log('Coverages:', tx.coverages?.length || 0);
    if (tx.coverages) {
      for (const cov of tx.coverages) {
        console.log(`  ${cov.code?.padEnd(8) || 'N/A'} | type=${(cov.type || 'N/A').padEnd(20)} | limit=${cov.limitAmount ?? 'N/A'} | ded=${cov.deductibleAmount ?? 'N/A'} | prem=${cov.premium ?? 'N/A'}`);
      }
    }
    console.log('Drivers:', tx.drivers?.length || 0);
    console.log('Vehicles:', tx.vehicles?.length || 0);
    if (tx.vehicles) {
      for (const veh of tx.vehicles) {
        console.log(`  Vehicle: ${veh.year} ${veh.make} ${veh.model} | VIN: ${veh.vin}`);
        console.log(`    Coverages: ${veh.coverages?.length || 0}`);
        if (veh.coverages) {
          for (const cov of veh.coverages) {
            console.log(`      ${cov.code?.padEnd(8) || 'N/A'} | limit=${cov.limitAmount ?? 'N/A'} | prem=${cov.premium ?? 'N/A'}`);
          }
        }
      }
    }
    console.log('Total Premium:', tx.totalPremium ?? 'N/A');
  }

  console.log('\n\n=== SNAPSHOT ===\n');
  if (transactions.length > 0) {
    const snapshot = buildRenewalSnapshot(transactions[0]);
    console.log('Premium:', snapshot.premium);
    console.log('Coverages:', snapshot.coverages?.length || 0);
    console.log('Drivers:', snapshot.drivers?.length || 0);
    console.log('Vehicles:', snapshot.vehicles?.length || 0);

    if (snapshot.coverages) {
      console.log('\nCoverages detail:');
      for (const cov of snapshot.coverages) {
        console.log(`  ${(cov.type || 'N/A').padEnd(25)} | limit=${cov.limit ?? cov.limitAmount ?? 'N/A'} | ded=${cov.deductible ?? cov.deductibleAmount ?? 'N/A'} | prem=${cov.premium ?? 'N/A'}`);
      }
    }
  }

  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
