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
    rawAl3Content: renewalCandidates.rawAl3Content,
  }).from(renewalCandidates)
    .orderBy(desc(renewalCandidates.createdAt))
    .limit(10);

  // Focus on RSAL policies only
  const rsals = candidates.filter(c => c.carrierName?.includes('RSAL'));

  for (const c of rsals) {
    if (!c.rawAl3Content) continue;
    console.log(`\n${'='.repeat(70)}`);
    console.log(`Policy: ${c.policyNumber || '[blank]'}`);

    const lines = c.rawAl3Content.split('\n');

    // Search EVERY line for "PL" as a standalone word in the cleaned content
    let foundPL = false;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const recType = line.substring(0, 4).trim();

      // Split on 0xFA and look for PL-related content
      const parts: string[] = [];
      let start = 0;
      for (let j = 0; j < line.length; j++) {
        if (line.charCodeAt(j) === 0xFA) {
          parts.push(line.substring(start, j));
          start = j + 1;
        }
      }
      parts.push(line.substring(start));

      for (let p = 0; p < parts.length; p++) {
        const clean = parts[p].replace(/[\x00-\x1f\x7f-\xff]/g, '').trim();
        // Look for PL in sub-record headers
        if (/\s{2,}PL\s*$/.test(clean) || /\s{2,}PL\?/.test(parts[p].replace(/[\x00-\x1f\x7f-\xff]/g, ''))) {
          console.log(`  Line ${i} (${recType}), part ${p}: PL header: "${clean.substring(0, 80)}"`);
          foundPL = true;
        }
        // Also look for "Personal Liab" description
        if (clean.includes('Personal Liab')) {
          console.log(`  Line ${i} (${recType}), part ${p}: PL desc: "${clean.substring(0, 80)}"`);
          foundPL = true;
        }
      }
    }

    if (!foundPL) {
      console.log('  ** PL NOT FOUND ANYWHERE IN RAW DATA **');

      // Show the end of the 6HRU line to see if PL was truncated
      const hruLine = lines.find(l => l.startsWith('6HRU'));
      if (hruLine) {
        console.log(`\n  6HRU line length: ${hruLine.length}`);
        // Show last 100 bytes as hex
        const last100 = hruLine.substring(Math.max(0, hruLine.length - 100));
        const hex = [...last100].map(c => {
          const code = c.charCodeAt(0);
          return code >= 32 && code < 127 ? c : `[${code.toString(16).padStart(2, '0')}]`;
        }).join('');
        console.log(`  Last 100 bytes: ${hex}`);
      }
    }
  }

  process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
