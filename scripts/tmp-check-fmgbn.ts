import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env.production.local') });

async function run() {
  const { db } = await import('../src/db');
  const { renewalCandidates } = await import('../src/db/schema');
  const { desc } = await import('drizzle-orm');

  const candidates = await db.select({
    policyNumber: renewalCandidates.policyNumber,
    carrierName: renewalCandidates.carrierName,
    lineOfBusiness: renewalCandidates.lineOfBusiness,
    rawAl3Content: renewalCandidates.rawAl3Content,
  }).from(renewalCandidates)
    .orderBy(desc(renewalCandidates.createdAt))
    .limit(15);

  const fmgbn = candidates.find(c => c.policyNumber === 'ALU3424');
  if (!fmgbn?.rawAl3Content) { console.log('Not found'); process.exit(1); }

  console.log(`Policy: ${fmgbn.policyNumber} | LOB: ${fmgbn.lineOfBusiness}`);

  const lines = fmgbn.rawAl3Content.split('\n');
  // Show first 3 lines
  for (let i = 0; i < Math.min(5, lines.length); i++) {
    const display = lines[i].substring(0, 200).replace(/[\x00-\x1f\x80-\xff]/g, '?');
    console.log(`  [${i}] ${display}`);
  }

  // The 2TRG line - show the LOB area
  const trgLine = lines.find(l => l.startsWith('2TRG'));
  if (trgLine) {
    const hex = [...trgLine.substring(0, 80)].map((c, idx) => {
      const code = c.charCodeAt(0);
      return code >= 32 && code < 127 ? c : `[${code.toString(16).padStart(2, '0')}]`;
    }).join('');
    console.log(`\n2TRG hex: ${hex}`);

    // Show positions around LOB (24-30)
    const clean = trgLine.replace(/[\x00-\x1f\x80-\xff]/g, '?');
    console.log(`Positions 19-35: "${clean.substring(19, 35)}"`);
  }

  // Check all record types and look for HOME/FIRE/DWELL indicators
  const recordTypes = new Set(lines.map(l => l.substring(0, 4).trim()).filter(Boolean));
  console.log(`\nRecord types: ${[...recordTypes].join(', ')}`);

  // Look for coverage types to determine actual LOB
  for (const line of lines) {
    const clean = line.replace(/[\x00-\x1f\x80-\xff]/g, '?');
    if (clean.includes('DWELL') || clean.includes('HOME') || clean.includes('AUTO') || clean.includes('FIRE')) {
      console.log(`  LOB hint: ${clean.substring(0, 150)}`);
    }
  }

  process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
