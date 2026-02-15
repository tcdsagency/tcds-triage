import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

async function run() {
  const { db } = await import('../src/db');
  const { calls } = await import('../src/db/schema');
  const { eq, desc, isNull } = await import('drizzle-orm');

  // Get outbound calls with no agent
  const rows = await db.select({
    fromNumber: calls.fromNumber,
    toNumber: calls.toNumber,
    startedAt: calls.startedAt,
  }).from(calls).where(eq(calls.direction, 'outbound')).orderBy(desc(calls.startedAt)).limit(50);

  const froms = new Map<string, number>();
  for (const r of rows) {
    if (r.fromNumber) froms.set(r.fromNumber, (froms.get(r.fromNumber) || 0) + 1);
  }

  console.log('Distinct outbound fromNumbers (last 50 calls):');
  for (const [num, count] of froms) {
    console.log(`  ${num} (${count} calls)`);
  }

  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
