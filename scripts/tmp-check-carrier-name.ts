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

  // Look at CAN STRATEGIC's 2TRG header
  const canStrat = candidates.find(c => c.policyNumber === 'ALA159099');
  if (canStrat?.rawAl3Content) {
    console.log(`Stored carrier name: "${canStrat.carrierName}"`);
    const lines = canStrat.rawAl3Content.split('\n');
    const trgLine = lines.find(l => l.startsWith('2TRG'));
    if (trgLine) {
      // Show positions 7-36 (where carrier name typically lives)
      const cleaned = trgLine.replace(/[\x00-\x1f\x80-\xff]/g, '?');
      console.log(`2TRG line (first 100): "${cleaned.substring(0, 100)}"`);
      console.log(`Positions 7-36: "${cleaned.substring(7, 37)}"`);
      console.log(`Positions 7-50: "${cleaned.substring(7, 50)}"`);

      // Show hex around position 7
      const hex = [...trgLine.substring(0, 60)].map((c, idx) => {
        const code = c.charCodeAt(0);
        return code >= 32 && code < 127 ? c : `[${code.toString(16).padStart(2, '0')}]`;
      }).join('');
      console.log(`Hex first 60: ${hex}`);
    }
  }

  // Also show ALL distinct carrier names from recent candidates
  console.log('\n--- All carrier names ---');
  for (const c of candidates) {
    console.log(`  ${c.policyNumber || '[blank]'}: "${c.carrierName}"`);
  }

  process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
