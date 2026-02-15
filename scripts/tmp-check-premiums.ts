import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env.production.local') });

async function run() {
  const { db } = await import('../src/db');
  const { renewalCandidates } = await import('../src/db/schema');
  const { isNotNull, desc } = await import('drizzle-orm');

  // Get recent candidates with snapshots
  const candidates = await db.select({
    policyNumber: renewalCandidates.policyNumber,
    carrierName: renewalCandidates.carrierName,
    baselineSnapshot: renewalCandidates.baselineSnapshot,
    renewalSnapshot: renewalCandidates.renewalSnapshot,
  })
  .from(renewalCandidates)
  .where(isNotNull(renewalCandidates.renewalSnapshot))
  .orderBy(desc(renewalCandidates.createdAt))
  .limit(10);

  console.log('=== PREMIUM COMPARISON CHECK ===\n');
  console.log('Policy'.padEnd(22), '| Carrier'.padEnd(22), '| Baseline $'.padEnd(14), '| Renewal $'.padEnd(14), '| Change');
  console.log('-'.repeat(90));

  for (const c of candidates) {
    const baseline = c.baselineSnapshot as any;
    const renewal = c.renewalSnapshot as any;

    const baselinePremium = baseline?.premium;
    const renewalPremium = renewal?.premium;

    let change = '';
    if (baselinePremium && renewalPremium) {
      const diff = renewalPremium - baselinePremium;
      const pct = ((diff / baselinePremium) * 100).toFixed(1);
      change = diff >= 0 ? `+$${diff.toFixed(0)} (+${pct}%)` : `-$${Math.abs(diff).toFixed(0)} (${pct}%)`;
    } else if (!baselinePremium) {
      change = 'NO BASELINE';
    } else if (!renewalPremium) {
      change = 'NO RENEWAL';
    }

    console.log(
      (c.policyNumber || '').padEnd(22), '|',
      (c.carrierName || '').substring(0, 20).padEnd(20), '|',
      (baselinePremium ? `$${baselinePremium.toFixed(2)}` : 'N/A').padEnd(12), '|',
      (renewalPremium ? `$${renewalPremium.toFixed(2)}` : 'N/A').padEnd(12), '|',
      change
    );
  }

  process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
