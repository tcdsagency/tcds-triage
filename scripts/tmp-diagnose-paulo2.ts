import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

async function run() {
  const { db } = await import('../src/db');
  const { calls, users } = await import('../src/db/schema');
  const { eq, desc, gte, and, inArray } = await import('drizzle-orm');

  // Check the calls that DO have segments around Paulo's call time
  const callIds = [
    '6d5b2ab2-7c97-4aaf-a450-2f7ff713f7ec', // 97 segments
    'c5de68f8-8f9b-49a2-bd0a-a8b2c7bbb5a9', // 97 segments
    '707ce359-2a58-49d5-bb90-cd11d71702ff', // 47 segments
  ];

  for (const cid of callIds) {
    const [c] = await db.select({
      id: calls.id,
      extension: calls.extension,
      agentId: calls.agentId,
      fromNumber: calls.fromNumber,
      toNumber: calls.toNumber,
      vmSessionId: calls.vmSessionId,
      externalCallId: calls.externalCallId,
      startedAt: calls.startedAt,
      endedAt: calls.endedAt,
      status: calls.status,
    }).from(calls).where(eq(calls.id, cid)).limit(1);

    if (c) {
      let agentName = 'NONE';
      if (c.agentId) {
        const [u] = await db.select({ firstName: users.firstName, lastName: users.lastName }).from(users).where(eq(users.id, c.agentId)).limit(1);
        agentName = u ? `${u.firstName} ${u.lastName}` : 'UNKNOWN';
      }
      console.log(`${c.id}`);
      console.log(`  agent: ${agentName} | ext: ${c.extension} | from: ${c.fromNumber} | to: ${c.toNumber}`);
      console.log(`  vmSession: ${c.vmSessionId || 'NULL'} | extCallId: ${c.externalCallId || 'NULL'}`);
      console.log(`  started: ${c.startedAt?.toLocaleTimeString()} | ended: ${c.endedAt?.toLocaleTimeString() || 'ACTIVE'}`);
      console.log('');
    }
  }

  // Now check: are there ANY calls today with externalCallId that overlap Paulo's time?
  // Paulo's call was 2:14-2:17 PM
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const allCalls = await db.select({
    id: calls.id,
    extension: calls.extension,
    agentId: calls.agentId,
    fromNumber: calls.fromNumber,
    toNumber: calls.toNumber,
    vmSessionId: calls.vmSessionId,
    externalCallId: calls.externalCallId,
    startedAt: calls.startedAt,
    endedAt: calls.endedAt,
    status: calls.status,
    transcriptionSegmentCount: calls.transcriptionSegmentCount,
  }).from(calls).where(gte(calls.startedAt, today)).orderBy(desc(calls.startedAt));

  // Find calls around 2:14-2:20 PM
  console.log('All calls between 2:00-2:30 PM:');
  for (const c of allCalls) {
    const hour = c.startedAt?.getHours();
    const min = c.startedAt?.getMinutes();
    if (hour === 14 || (hour === 20 && min !== undefined && min >= 0 && min <= 30)) {
      // UTC time - 2:14 PM CST = 20:14 UTC
      let agentName = 'NONE';
      if (c.agentId) {
        const [u] = await db.select({ firstName: users.firstName, lastName: users.lastName }).from(users).where(eq(users.id, c.agentId)).limit(1);
        agentName = u ? `${u.firstName} ${u.lastName}` : 'UNKNOWN';
      }
      console.log(`  ${c.startedAt?.toLocaleTimeString()} | ${c.id.substring(0,8)} | ${agentName} | ext: ${c.extension} | segs: ${c.transcriptionSegmentCount} | extId: ${c.externalCallId?.substring(0,15) || 'NULL'} | vm: ${c.vmSessionId?.substring(0,15) || 'NULL'}`);
    }
  }

  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
