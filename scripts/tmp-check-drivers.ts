import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env.production.local') });

async function run() {
  const { db } = await import('../src/db');
  const { renewalComparisons } = await import('../src/db/schema');
  const { eq } = await import('drizzle-orm');

  const comps = await db.select().from(renewalComparisons)
    .where(eq(renewalComparisons.policyNumber, '955847785'));

  if (comps.length === 0) {
    console.log('Not found');
    process.exit(0);
  }

  const c = comps[0];
  const baseline = c.baselineSnapshot as any;
  const renewal = c.renewalSnapshot as any;
  const changes = c.materialChanges as any[];

  console.log('Baseline drivers:');
  for (const d of baseline?.drivers || []) {
    console.log(' ', JSON.stringify(d));
  }

  console.log('\nRenewal drivers:');
  for (const d of renewal?.drivers || []) {
    console.log(' ', JSON.stringify(d));
  }

  console.log('\nDriver-related changes:');
  for (const ch of changes || []) {
    if (ch.category?.includes('driver')) {
      console.log(' ', ch.category, ':', ch.description);
    }
  }

  process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
