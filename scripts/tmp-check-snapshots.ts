import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env.production.local') });

async function run() {
  const { db } = await import('../src/db');
  const { renewalComparisons } = await import('../src/db/schema');
  const { or, ilike } = await import('drizzle-orm');

  const comps = await db.select({
    id: renewalComparisons.id,
    policyNumber: renewalComparisons.policyNumber,
    carrierName: renewalComparisons.carrierName,
    lob: renewalComparisons.lineOfBusiness,
    renewalSnapshot: renewalComparisons.renewalSnapshot,
    baselineSnapshot: renewalComparisons.baselineSnapshot,
  }).from(renewalComparisons)
    .where(or(
      ilike(renewalComparisons.policyNumber, '%0301-2000-1138%'),
      ilike(renewalComparisons.policyNumber, '%885225705%')
    ));

  for (const c of comps) {
    const rs = c.renewalSnapshot as any;
    const bs = c.baselineSnapshot as any;
    console.log('---', c.policyNumber, c.carrierName, c.lob);
    if (rs) {
      console.log('  RS: covs=' + (rs.coverages?.length ?? 0) + ' vehs=' + (rs.vehicles?.length ?? 0) + ' drvs=' + (rs.drivers?.length ?? 0) + ' prem=' + rs.premium + ' file=' + rs.sourceFileName);
    } else {
      console.log('  RS: none');
    }
    if (bs) {
      console.log('  BS: covs=' + (bs.coverages?.length ?? 0) + ' vehs=' + (bs.vehicles?.length ?? 0) + ' drvs=' + (bs.drivers?.length ?? 0) + ' prem=' + bs.premium);
    } else {
      console.log('  BS: none');
    }
  }
  process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
