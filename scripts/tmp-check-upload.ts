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
    status: renewalCandidates.status,
    baselineSnapshot: renewalCandidates.baselineSnapshot,
    renewalSnapshot: renewalCandidates.renewalSnapshot,
  })
  .from(renewalCandidates)
  .orderBy(desc(renewalCandidates.createdAt));

  console.log('=== UPLOADED RENEWALS ===\n');
  console.log('Policy'.padEnd(22), '| Carrier'.padEnd(22), '| Baseline $'.padEnd(14), '| Renewal $'.padEnd(14), '| Change');
  console.log('-'.repeat(95));

  for (const c of candidates) {
    const baseline = c.baselineSnapshot as any;
    const renewal = c.renewalSnapshot as any;
    const bPrem = baseline?.premium;
    const rPrem = renewal?.premium;

    let change = '';
    if (bPrem && rPrem) {
      const diff = rPrem - bPrem;
      const pct = ((diff / bPrem) * 100).toFixed(1);
      change = diff >= 0 ? `+$${diff.toFixed(0)} (+${pct}%)` : `-$${Math.abs(diff).toFixed(0)} (${pct}%)`;
    } else if (!bPrem) {
      change = 'NO BASELINE';
    } else if (!rPrem) {
      change = 'NO RENEWAL $';
    }

    console.log(
      (c.policyNumber || '').padEnd(22), '|',
      (c.carrierName || '').substring(0, 20).padEnd(20), '|',
      (bPrem ? `$${bPrem.toFixed(2)}` : 'N/A').padEnd(12), '|',
      (rPrem ? `$${rPrem.toFixed(2)}` : 'N/A').padEnd(12), '|',
      change
    );
  }

  console.log('\nTotal:', candidates.length, 'candidates');
  process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
