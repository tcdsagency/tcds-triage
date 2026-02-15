import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env.production.local') });

import * as fs from 'fs';
import AdmZip from 'adm-zip';
import { parseAL3File } from '../src/lib/al3/parser';
import { DISCOUNT_COVERAGE_TYPES } from '../src/lib/al3/constants';

async function run() {
  // Use the most recent IVANS zip
  const zipPath = 'C:\\Users\\ToddConn\\Downloads\\Files_YX67JQA_20260206073206.zip';

  console.log('Opening ZIP:', zipPath);
  const zip = new AdmZip(zipPath);
  const entries = zip.getEntries();

  console.log('Files in ZIP:', entries.length);

  let totalDiscounts = 0;
  let policiesWithDiscounts = 0;

  for (const entry of entries) {
    if (entry.isDirectory) continue;

    const content = entry.getData().toString('utf8');
    const transactions = parseAL3File(content);

    for (const tx of transactions) {
      // Check for discounts in coverages
      const discounts = tx.coverages.filter(c =>
        DISCOUNT_COVERAGE_TYPES.has(c.type)
      );

      if (discounts.length > 0) {
        policiesWithDiscounts++;
        totalDiscounts += discounts.length;

        console.log('\n--- Policy:', tx.header.policyNumber, '---');
        console.log('  LOB:', tx.header.lineOfBusiness);
        console.log('  Discounts found:');
        for (const d of discounts) {
          console.log('    -', d.code, '/', d.type, '-', d.description);
        }
      }
    }
  }

  console.log('\n=== Summary ===');
  console.log('Policies with discounts:', policiesWithDiscounts);
  console.log('Total discount records:', totalDiscounts);

  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
