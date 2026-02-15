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

  const candidate = candidates.find(c => c.policyNumber === '0301-2500-2023');
  if (!candidate?.rawAl3Content) { console.log('Not found'); process.exit(1); }

  // Find the 6HRU line
  const lines = candidate.rawAl3Content.split('\n');
  const hruLine = lines.find(l => l.startsWith('6HRU'));
  if (!hruLine) { console.log('No 6HRU line'); process.exit(1); }

  console.log('6HRU line length:', hruLine.length);

  // Split on 0xFA
  const parts: string[] = [];
  let start = 0;
  for (let i = 0; i < hruLine.length; i++) {
    if (hruLine.charCodeAt(i) === 0xFA) {
      parts.push(hruLine.substring(start, i));
      start = i + 1;
    }
  }
  parts.push(hruLine.substring(start));

  console.log(`\n0xFA-split parts: ${parts.length}`);
  for (let i = 0; i < parts.length; i++) {
    const raw = parts[i];
    const cleaned = raw.replace(/[\x00-\x1F\x7F-\xFF]/g, '');
    const hex = [...raw].map(c => c.charCodeAt(0).toString(16).padStart(2, '0')).join(' ');
    if (raw.length > 50) {
      console.log(`  [${i}] raw(${raw.length}): "${cleaned.substring(0, 80)}..." hex: ${hex.substring(0, 100)}...`);
    } else {
      console.log(`  [${i}] raw(${raw.length}): "${cleaned}" hex: ${hex}`);
    }

    // Check if this would be detected as SUB
    const cleanedCheck = raw.replace(/[\x00-\x1F\x7F-\xFF]/g, '');
    if (/^\d[A-Z]{3}\d{3}/.test(cleanedCheck)) {
      console.log(`    → MATCHES SUB pattern!`);
    }
  }

  // Now manually run parseEDIFACTSegments and show results
  const { parseEDIFACTSegments } = await import('../src/lib/al3/parser') as any;
  // Not exported, so let me replicate the logic
  console.log('\n=== SEGMENT PARSING ===');
  const segments: { tag: string; data: string }[] = [];
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (i === 0) {
      const cleaned = part.replace(/[\x00-\x1F\x7F-\xFF]/g, '').trim();
      segments.push({ tag: 'REF', data: cleaned });
      console.log(`  [${i}] REF: "${cleaned.substring(0, 60)}"`);
    } else {
      let data = part.replace(/[\x00-\x1F\x7F-\xFF]/g, '');

      // Truncate at embedded record boundaries
      const boundaryMatch = data.match(/\?\d[A-Z]{3}\d{3}/);
      if (boundaryMatch && boundaryMatch.index !== undefined) {
        console.log(`  [${i}] TRUNCATED at boundary: "${data.substring(boundaryMatch.index, boundaryMatch.index + 10)}"`);
        data = data.substring(0, boundaryMatch.index);
      }

      // NEW: Pre-check for sub-record header BEFORE hex tag strip
      if (/^\d[A-Z]{3}\d{3}/.test(data)) {
        segments.push({ tag: 'SUB', data });
        console.log(`  [${i}] SUB (pre-check): "${data.substring(0, 60)}"`);
        continue;
      }

      // Strip 2-char hex tag
      const tagMatch = data.match(/^([0-9A-Fa-f]{2})\s?(.*)/);
      let tag = '';
      if (tagMatch) {
        tag = tagMatch[1].toUpperCase();
        data = tagMatch[2];
      }

      // Post-check for sub-record header
      if (/^\d[A-Z]{3}\d{3}/.test(data)) {
        segments.push({ tag: 'SUB', data });
        console.log(`  [${i}] SUB (post-check): tag=${tag}, data="${data.substring(0, 60)}"`);
        continue;
      }

      data = data.replace(/\?+/g, '').trim();
      if (data) {
        segments.push({ tag, data });
        console.log(`  [${i}] tag=${tag}: "${data.substring(0, 60)}"`);
      } else {
        console.log(`  [${i}] tag=${tag}: (empty)`);
      }
    }
  }

  process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
