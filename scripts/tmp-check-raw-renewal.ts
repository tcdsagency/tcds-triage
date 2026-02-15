import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env.production.local') });

async function run() {
  const { db } = await import('../src/db');
  const { renewalCandidates } = await import('../src/db/schema');
  const { desc, eq, and, isNotNull, like } = await import('drizzle-orm');

  // Get candidates from today's batch that have raw AL3 content
  const candidates = await db.select({
    id: renewalCandidates.id,
    policyNumber: renewalCandidates.policyNumber,
    carrierName: renewalCandidates.carrierName,
    lineOfBusiness: renewalCandidates.lineOfBusiness,
    rawAl3Content: renewalCandidates.rawAl3Content,
    renewalSnapshot: renewalCandidates.renewalSnapshot,
  }).from(renewalCandidates)
    .orderBy(desc(renewalCandidates.createdAt))
    .limit(10);

  console.log(`Found ${candidates.length} recent candidates\n`);

  for (const c of candidates) {
    console.log('='.repeat(70));
    console.log(`Policy: ${c.policyNumber} | Carrier: ${c.carrierName} | LOB: ${c.lineOfBusiness}`);

    const snap = c.renewalSnapshot as any;
    if (snap) {
      console.log(`Snapshot coverages: ${snap.coverages?.length || 0}`);
      for (const cov of (snap.coverages || [])) {
        console.log(`  ${cov.type}: limit=${cov.limitAmount || '-'}, ded=${cov.deductibleAmount || '-'}, prem=${cov.premium ?? '-'}`);
      }
    }

    if (c.rawAl3Content) {
      // Show the raw AL3 lines to understand the format
      const lines = c.rawAl3Content.split('\n');
      console.log(`\nRaw AL3 lines: ${lines.length}`);

      // Show 6CVH (home coverage) and 5BPI (premium) records
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const recType = line.substring(0, 4).trim();
        // Show all record types to understand the structure
        if (['6CVH', '5BPI', '5PPH', '5ISI', '2TRG', '2TCG', '5AOI', '9AOI', '6HRU'].includes(recType)) {
          // Show first 120 chars to see the structure
          console.log(`  [${i}] ${recType}: ${line.substring(0, 150).replace(/[\x00-\x1f\x80-\xff]/g, '?')}`);
        }
      }

      // Also check for EDIFACT format
      const firstLine = lines[0] || '';
      const hasFA = firstLine.includes('\xFA') || c.rawAl3Content.includes('\xFA');
      console.log(`\nEDIFACT format: ${hasFA}`);

      // Check record types found
      const recordTypes = new Set(lines.map(l => l.substring(0, 4).trim()).filter(Boolean));
      console.log(`Record types: ${[...recordTypes].join(', ')}`);
    } else {
      console.log('No raw AL3 content stored');
    }
    console.log('');
  }

  process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
