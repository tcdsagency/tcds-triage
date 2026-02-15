import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env.production.local') });

async function run() {
  const { db } = await import('../src/db');
  const { renewalCandidates } = await import('../src/db/schema');
  const { desc } = await import('drizzle-orm');

  const candidates = await db.select({
    policyNumber: renewalCandidates.policyNumber,
    rawAl3Content: renewalCandidates.rawAl3Content,
  }).from(renewalCandidates)
    .orderBy(desc(renewalCandidates.createdAt))
    .limit(10);

  // Check all RSAL policies for PL
  for (const c of candidates) {
    if (!c.rawAl3Content) continue;

    const lines = c.rawAl3Content.split('\n');
    console.log(`\n=== ${c.policyNumber || '[blank]'} ===`);

    // Search for "PL" as a coverage code in any line (preceded by spaces)
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Look for PL as potential coverage code - usually "    PL" or " PL" at the end of a header
      if (/\s{2,}PL\s*$/.test(line.replace(/[\x00-\x1f\x80-\xff]/g, '').trimEnd()) ||
          /\s{2,}PL[\x00-\x1f\x80-\xff]/.test(line) ||
          line.includes('    PL')) {
        const recType = line.substring(0, 4).trim();
        const display = line.replace(/[\x00-\x1f\x80-\xff]/g, '?');
        console.log(`  Found "PL" in line ${i} (${recType}), len=${line.length}:`);
        // Show last 100 chars where PL likely is
        const plIdx = display.indexOf('    PL');
        if (plIdx >= 0) {
          console.log(`    ...${display.substring(Math.max(0, plIdx - 40), plIdx + 40)}`);
        } else {
          console.log(`    ${display.substring(0, 200)}`);
        }
      }
    }

    // Also check: does ANY line contain "6CVH" followed by "PL" header pattern?
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const clean = line.replace(/[\x00-\x1f\x80-\xff]/g, '');
      // Look for 6CVH...PL pattern (sub-record header with PL coverage code)
      const plMatch = clean.match(/6CVH\d{3}[^6]*?\s{2,}(PL)\b/);
      if (plMatch) {
        const recType = line.substring(0, 4).trim();
        console.log(`  6CVH+PL header in line ${i} (${recType}), len=${line.length}`);
        const idx = clean.indexOf(plMatch[0]);
        console.log(`    at pos ${idx}: "${clean.substring(idx, idx + 60)}"`);

        // Show what comes AFTER the PL header
        const afterPL = clean.substring(idx + plMatch[0].length, idx + plMatch[0].length + 100);
        console.log(`    after PL header: "${afterPL}"`);
      }
    }

    // Also: show all 6CVH sub-record headers found (to see which coverages are embedded)
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const clean = line.replace(/[\x00-\x1f\x80-\xff]/g, '');
      const recType = line.substring(0, 4).trim();

      // Find all "6CVH292...CODE" patterns in this line
      const regex = /6CVH\d{3}\s.*?\s{2,}(\S+)/g;
      let match;
      const codes: string[] = [];
      while ((match = regex.exec(clean)) !== null) {
        codes.push(match[1]);
      }
      if (codes.length > 0) {
        console.log(`  Line ${i} (${recType}, len=${line.length}): sub-record codes: ${codes.join(', ')}`);
      }
    }
  }

  process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
