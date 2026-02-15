import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

async function run() {
  const { db } = await import('../src/db');
  const { calls, users } = await import('../src/db/schema');
  const { gte, desc, eq } = await import('drizzle-orm');

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const rows = await db
    .select({
      direction: calls.direction,
      fromNumber: calls.fromNumber,
      toNumber: calls.toNumber,
      agentId: calls.agentId,
      disposition: calls.disposition,
      startedAt: calls.startedAt,
    })
    .from(calls)
    .where(gte(calls.startedAt, today))
    .orderBy(desc(calls.startedAt))
    .limit(30);

  console.log(`${rows.length} calls today:\n`);
  for (const r of rows) {
    let agentName = 'NONE';
    if (r.agentId) {
      const [u] = await db.select({ firstName: users.firstName, lastName: users.lastName }).from(users).where(eq(users.id, r.agentId)).limit(1);
      agentName = u ? `${u.firstName} ${u.lastName}` : 'UNKNOWN';
    }
    const time = r.startedAt?.toLocaleTimeString() || '?';
    console.log(`${time} | ${r.direction?.padEnd(9)} | from: ${(r.fromNumber || '-').padEnd(14)} | to: ${(r.toNumber || '-').padEnd(14)} | agent: ${agentName.padEnd(20)} | disp: ${r.disposition || '-'}`);
  }

  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
