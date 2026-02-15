import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

async function run() {
  const { db } = await import('../src/db');
  const { calls, users } = await import('../src/db/schema');
  const { eq, and, desc } = await import('drizzle-orm');
  const { sql } = await import('drizzle-orm');

  // Check which agents use +12058475616 as fromNumber
  // Look at calls where we DO have an agentId to see if this number is shared
  const rows = await db.select({
    fromNumber: calls.fromNumber,
    agentId: calls.agentId,
    direction: calls.direction,
    startedAt: calls.startedAt,
  }).from(calls).where(
    and(
      eq(calls.direction, 'outbound'),
      sql`${calls.fromNumber} LIKE '%2058475616'`
    )
  ).orderBy(desc(calls.startedAt)).limit(20);

  console.log(`Outbound calls from +12058475616:`);
  for (const r of rows) {
    let name = 'NONE';
    if (r.agentId) {
      const [u] = await db.select({ firstName: users.firstName, lastName: users.lastName }).from(users).where(eq(users.id, r.agentId)).limit(1);
      name = u ? `${u.firstName} ${u.lastName}` : 'UNKNOWN';
    }
    console.log(`  ${r.startedAt?.toLocaleString()} | agent: ${name} (${r.agentId || 'null'})`);
  }

  // Also check the other mystery number
  console.log('\nOutbound calls from +12568414605:');
  const rows2 = await db.select({
    fromNumber: calls.fromNumber,
    agentId: calls.agentId,
    startedAt: calls.startedAt,
  }).from(calls).where(
    and(
      eq(calls.direction, 'outbound'),
      sql`${calls.fromNumber} LIKE '%2568414605'`
    )
  ).orderBy(desc(calls.startedAt)).limit(10);

  for (const r of rows2) {
    let name = 'NONE';
    if (r.agentId) {
      const [u] = await db.select({ firstName: users.firstName, lastName: users.lastName }).from(users).where(eq(users.id, r.agentId)).limit(1);
      name = u ? `${u.firstName} ${u.lastName}` : 'UNKNOWN';
    }
    console.log(`  ${r.startedAt?.toLocaleString()} | agent: ${name} (${r.agentId || 'null'})`);
  }

  // Check +12059744444
  console.log('\nOutbound calls from +12059744444:');
  const rows3 = await db.select({
    fromNumber: calls.fromNumber,
    agentId: calls.agentId,
    startedAt: calls.startedAt,
  }).from(calls).where(
    and(
      eq(calls.direction, 'outbound'),
      sql`${calls.fromNumber} LIKE '%2059744444'`
    )
  ).orderBy(desc(calls.startedAt)).limit(10);

  for (const r of rows3) {
    let name = 'NONE';
    if (r.agentId) {
      const [u] = await db.select({ firstName: users.firstName, lastName: users.lastName }).from(users).where(eq(users.id, r.agentId)).limit(1);
      name = u ? `${u.firstName} ${u.lastName}` : 'UNKNOWN';
    }
    console.log(`  ${r.startedAt?.toLocaleString()} | agent: ${name} (${r.agentId || 'null'})`);
  }

  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
