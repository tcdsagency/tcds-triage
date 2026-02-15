import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env.production.local') });

async function run() {
  const { db } = await import('../src/db');
  const { renewalCandidates } = await import('../src/db/schema');
  const { desc, eq } = await import('drizzle-orm');

  // Get specific problem candidates
  const candidates = await db.select({
    id: renewalCandidates.id,
    policyNumber: renewalCandidates.policyNumber,
    carrierName: renewalCandidates.carrierName,
    rawAl3Content: renewalCandidates.rawAl3Content,
  }).from(renewalCandidates)
    .orderBy(desc(renewalCandidates.createdAt))
    .limit(10);

  // Show 0301-2500-2023 (RSAL with missing coverages) - ALL lines
  const rsal = candidates.find(c => c.policyNumber === '0301-2500-2023');
  if (rsal?.rawAl3Content) {
    console.log('=== RSAL 0301-2500-2023 - ALL LINES ===');
    const lines = rsal.rawAl3Content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const recType = line.substring(0, 4).trim();
      // Show up to 200 chars, replacing non-printable
      const display = line.substring(0, 250).replace(/[\x00-\x1f\x80-\xff]/g, '?');
      console.log(`  [${i}] ${recType}: ${display}`);
    }

    // Specifically find where DWELL sub-record boundaries are
    console.log('\n--- Lines containing "DWELL" ---');
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('DWELL')) {
        console.log(`  Line ${i}: ...${lines[i].substring(Math.max(0, lines[i].indexOf('DWELL') - 30), lines[i].indexOf('DWELL') + 100).replace(/[\x00-\x1f\x80-\xff]/g, '?')}...`);
      }
    }

    // Find where OS, CONT, LOU, PL sub-records are
    for (const code of ['OS?', 'CONT?', 'LOU?', '    PL?', 'DWELL']) {
      console.log(`\n--- Lines containing "${code}" ---`);
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes(code)) {
          const idx = lines[i].indexOf(code);
          console.log(`  Line ${i} at pos ${idx}: ${recType(lines[i])}`);
        }
      }
    }
  }

  // Show CAN STRATEGIC (ALA159099) - ALL lines
  const canStrat = candidates.find(c => c.policyNumber === 'ALA159099');
  if (canStrat?.rawAl3Content) {
    console.log('\n\n=== CAN STRATEGIC ALA159099 - ALL LINES ===');
    const lines = canStrat.rawAl3Content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const rt = line.substring(0, 4).trim();
      const display = line.substring(0, 250).replace(/[\x00-\x1f\x80-\xff]/g, '?');
      console.log(`  [${i}] ${rt}: ${display}`);
    }

    // Find DWELL, COVA, COV_A type references
    console.log('\n--- Lines containing "DWELL" or "COV" or "BLDG" ---');
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].match(/DWELL|COV[_A]|BLDG|COVGA/i)) {
        const display = lines[i].substring(0, 200).replace(/[\x00-\x1f\x80-\xff]/g, '?');
        console.log(`  Line ${i}: ${display}`);
      }
    }

    // Check the 6COM record which might contain building info
    console.log('\n--- 6COM records (full) ---');
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith('6COM')) {
        const display = lines[i].substring(0, 300).replace(/[\x00-\x1f\x80-\xff]/g, '?');
        console.log(`  Line ${i}: ${display}`);
      }
    }

    // Check 5REP records
    console.log('\n--- 5REP records (full) ---');
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith('5REP')) {
        const display = lines[i].substring(0, 300).replace(/[\x00-\x1f\x80-\xff]/g, '?');
        console.log(`  Line ${i}: ${display}`);
      }
    }
  }

  process.exit(0);
}

function recType(line: string) { return line.substring(0, 4).trim(); }

run().catch(e => { console.error(e); process.exit(1); });
