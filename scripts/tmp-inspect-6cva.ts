/**
 * 6CVA Raw Data Inspection Script
 * ================================
 * Dumps raw bytes from 6CVA records to understand field positions,
 * especially deductible encoding.
 *
 * Run with: npx tsx scripts/tmp-inspect-6cva.ts
 */

import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import AdmZip from 'adm-zip';

dotenv.config({ path: path.resolve(__dirname, '../.env.production.local') });

// Known field positions from CVA_FIELDS in parser.ts
const CVA_FIELDS = {
  COVERAGE_CODE: { start: 8, end: 12 },      // 4 chars
  LIMIT: { start: 12, end: 22 },              // 10 chars
  DEDUCTIBLE: { start: 122, end: 132 },       // 10 chars
  PREMIUM: { start: 100, end: 111 },          // 11 chars
  DESCRIPTION: { start: 27, end: 77 },        // 50 chars
};

function hexDump(buffer: Buffer, start: number, length: number): string {
  const slice = buffer.slice(start, start + length);
  const hex = slice.toString('hex').match(/.{1,2}/g)?.join(' ') || '';
  const ascii = slice.toString('ascii').replace(/[\x00-\x1F\x7F-\xFF]/g, '.');
  return `${hex.padEnd(length * 3)}  |${ascii}|`;
}

function inspectRecord(line: string, recordNum: number) {
  const buffer = Buffer.from(line, 'ascii');

  console.log(`\n${'='.repeat(80)}`);
  console.log(`6CVA RECORD #${recordNum} (${buffer.length} bytes)`);
  console.log('='.repeat(80));

  // Show key fields
  console.log('\nKEY FIELDS:');
  console.log(`  Coverage Code (8-12):    "${line.substring(8, 12).trim()}" [${hexDump(buffer, 8, 4)}]`);
  console.log(`  Limit (12-22):           "${line.substring(12, 22).trim()}" [${hexDump(buffer, 12, 10)}]`);
  console.log(`  Description (27-77):     "${line.substring(27, 77).trim()}"`);
  console.log(`  Premium (100-111):       "${line.substring(100, 111).trim()}" [${hexDump(buffer, 100, 11)}]`);
  console.log(`  Deductible (122-132):    "${line.substring(122, 132).trim()}" [${hexDump(buffer, 122, 10)}]`);

  // Look for other possible deductible locations
  console.log('\nSCANNING FOR DEDUCTIBLE PATTERNS:');

  // Common deductible values to search for
  const deductibles = ['500', '1000', '250', '100', '2500', '0500', '1500'];
  for (const ded of deductibles) {
    let idx = line.indexOf(ded);
    while (idx !== -1) {
      const context = line.substring(Math.max(0, idx - 5), Math.min(line.length, idx + ded.length + 5));
      console.log(`  Found "${ded}" at position ${idx}: "${context}"`);
      idx = line.indexOf(ded, idx + 1);
    }
  }

  // Full hex dump of interesting regions
  console.log('\nHEX DUMP (positions 80-140):');
  for (let i = 80; i < Math.min(140, buffer.length); i += 20) {
    const end = Math.min(i + 20, buffer.length);
    console.log(`  ${i.toString().padStart(3)}-${end.toString().padStart(3)}: ${hexDump(buffer, i, end - i)}`);
  }

  // Full line for reference
  console.log('\nFULL LINE:');
  console.log(line.substring(0, 150));
  if (line.length > 150) {
    console.log(line.substring(150, 292));
  }
}

async function inspectLatestIvansZip() {
  // Look for most recent ZIP in Downloads
  const downloadsPath = 'C:\\Users\\ToddConn\\Downloads';
  const files = fs.readdirSync(downloadsPath)
    .filter(f => f.endsWith('.zip') && (f.includes('IVANS') || f.includes('ivans') || f.toLowerCase().includes('renewal')))
    .map(f => ({
      name: f,
      path: path.join(downloadsPath, f),
      mtime: fs.statSync(path.join(downloadsPath, f)).mtime
    }))
    .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

  if (files.length === 0) {
    console.log('No IVANS ZIP files found in Downloads folder.');
    console.log('Looking for any ZIP files...');

    const allZips = fs.readdirSync(downloadsPath)
      .filter(f => f.endsWith('.zip'))
      .map(f => ({
        name: f,
        path: path.join(downloadsPath, f),
        mtime: fs.statSync(path.join(downloadsPath, f)).mtime
      }))
      .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

    if (allZips.length > 0) {
      console.log('\nMost recent ZIP files:');
      allZips.slice(0, 5).forEach((f, i) => console.log(`  ${i + 1}. ${f.name}`));
    }
    return;
  }

  const zipFile = files[0];
  console.log(`Inspecting: ${zipFile.name}`);
  console.log(`Modified: ${zipFile.mtime.toISOString()}\n`);

  const zip = new AdmZip(zipFile.path);
  const entries = zip.getEntries();

  let recordCount = 0;
  const maxRecords = 10; // Limit to first 10 6CVA records

  for (const entry of entries) {
    if (entry.isDirectory) continue;

    const content = entry.getData().toString('utf-8');
    const lines = content.split(/\r?\n/);

    for (const line of lines) {
      if (line.startsWith('6CVA') && recordCount < maxRecords) {
        recordCount++;
        inspectRecord(line, recordCount);

        // Only show COMP and COLL records in detail (they have deductibles)
        const covCode = line.substring(8, 12).trim();
        if (covCode === 'COMP' || covCode === 'COLL' || covCode === 'COM' || covCode === 'COL') {
          console.log('\n>>> This is a COMP/COLL record - should have deductible <<<');
        }
      }
    }
  }

  if (recordCount === 0) {
    console.log('No 6CVA records found in the ZIP file.');
    console.log('\nShowing file structure:');
    entries.forEach(e => {
      if (!e.isDirectory) {
        console.log(`  ${e.entryName} (${e.header.size} bytes)`);
      }
    });
  } else {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`Inspected ${recordCount} 6CVA records`);
  }
}

// Also allow inspecting from database
async function inspectFromDatabase() {
  const { db } = await import('../src/db');
  const { renewalCandidates } = await import('../src/db/schema');
  const { desc, isNotNull } = await import('drizzle-orm');

  console.log('\n' + '='.repeat(80));
  console.log('CHECKING DATABASE FOR RAW AL3 DATA');
  console.log('='.repeat(80));

  const candidates = await db.select({
    id: renewalCandidates.id,
    policyNumber: renewalCandidates.policyNumber,
    carrierName: renewalCandidates.carrierName,
    rawAl3Content: renewalCandidates.rawAl3Content,
  })
    .from(renewalCandidates)
    .where(isNotNull(renewalCandidates.rawAl3Content))
    .orderBy(desc(renewalCandidates.createdAt))
    .limit(5);

  console.log(`Found ${candidates.length} candidates with raw AL3 content\n`);

  for (const cand of candidates) {
    console.log(`\nPolicy: ${cand.policyNumber} (${cand.carrierName})`);

    const content = cand.rawAl3Content as string;
    if (!content) continue;

    const lines = content.split(/\r?\n/);
    let compCollCount = 0;

    for (const line of lines) {
      if (line.startsWith('6CVA')) {
        const covCode = line.substring(8, 12).trim();
        if ((covCode === 'COMP' || covCode === 'COLL' || covCode === 'COM' || covCode === 'COL') && compCollCount < 4) {
          compCollCount++;
          inspectRecord(line, compCollCount);
        }
      }
    }

    if (compCollCount === 0) {
      console.log('  No COMP/COLL 6CVA records found');
    }
  }
}

async function run() {
  console.log('6CVA RAW DATA INSPECTION');
  console.log('========================\n');

  // First try ZIP file
  await inspectLatestIvansZip();

  // Then check database
  await inspectFromDatabase();

  process.exit(0);
}

run().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
