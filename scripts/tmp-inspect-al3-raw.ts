import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env.production.local') });

import * as fs from 'fs';
import * as unzipper from 'unzipper';

// AL3 6CVA field positions per spec (0-indexed)
const CVA_SPEC = {
  HEADER: { start: 0, end: 30 },
  COVERAGE_CODE: { start: 30, end: 36 },
  COV_EFF_DATE: { start: 36, end: 42 },
  COV_EXP_DATE: { start: 42, end: 48 },
  COINSURANCE: { start: 48, end: 51 },
  RATE: { start: 51, end: 61 },
  PREMIUM: { start: 61, end: 73 },
  NET_CHANGE_PREMIUM: { start: 73, end: 85 },
  ORDER_OF_PROCESSING: { start: 85, end: 87 },
  FORM_NUMBER: { start: 87, end: 97 },
  FORM_EDITION_DATE: { start: 97, end: 103 },
  LIMIT1: { start: 103, end: 111 },
  LIMIT2: { start: 111, end: 119 },
  DEDUCTIBLE: { start: 119, end: 125 },
  PERCENT_DED_DISCOUNT: { start: 125, end: 128 },
  OPTION_CODE1: { start: 128, end: 130 },
  BENEFITS_CODE1: { start: 130, end: 132 },
  OPTION_CODE2: { start: 132, end: 134 },
  BENEFITS_CODE2: { start: 134, end: 136 },
  OPTION_CODE3: { start: 136, end: 138 },
  BENEFITS_CODE3: { start: 138, end: 140 },
  DEDUCTIBLE_TYPE: { start: 140, end: 142 },
  DISCOUNT_SURCHARGE_PREMIUM: { start: 142, end: 154 },
  DESCRIPTION: { start: 154, end: 214 },
  EFF_DATE_8: { start: 214, end: 222 },
  EXP_DATE_8: { start: 222, end: 230 },
  FORM_ED_DATE_8: { start: 230, end: 238 },
  NUM_OF_1: { start: 238, end: 243 },
  NUM_OF_2: { start: 243, end: 248 },
  NUM_OF_3: { start: 248, end: 253 },
};

function extractField(line: string, field: { start: number; end: number }): string {
  return line.substring(field.start, field.end);
}

async function run() {
  const zipPath = 'C:\\Users\\ToddConn\\Downloads\\Files_YX67JQA_20260206073206.zip';

  console.log('Opening ZIP:', zipPath);
  const zipBuffer = fs.readFileSync(zipPath);
  const directory = await unzipper.Open.buffer(zipBuffer);

  let recordCount = 0;
  const maxRecords = 5; // Just show first 5 6CVA records

  for (const file of directory.files) {
    if (file.type === 'Directory') continue;

    const content = (await file.buffer()).toString('utf8');
    const lines = content.split(/\r?\n/);

    for (const line of lines) {
      if (line.length < 30) continue;

      const groupCode = line.substring(0, 4);
      if (groupCode !== '6CVA') continue;

      recordCount++;
      if (recordCount > maxRecords) continue;

      console.log('\n' + '='.repeat(80));
      console.log('RAW LINE (first 260 chars):');
      console.log(line.substring(0, 260));
      console.log('\nFIELD BREAKDOWN:');

      for (const [name, pos] of Object.entries(CVA_SPEC)) {
        const value = extractField(line, pos).trim();
        if (value) {
          console.log(`  ${name.padEnd(25)} [${pos.start.toString().padStart(3)}-${pos.end.toString().padStart(3)}]: "${value}"`);
        }
      }
    }
  }

  console.log('\n\nTotal 6CVA records found:', recordCount);
  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
