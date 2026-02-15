import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

async function run() {
  const { db } = await import('../src/db');
  const { calls, users } = await import('../src/db/schema');
  const { eq, desc, and, or } = await import('drizzle-orm');

  // Find Paulo's recent calls
  const pauloId = '145325f7-349a-4dc0-83c2-657a69d95545';

  const recentCalls = await db.select({
    id: calls.id,
    direction: calls.direction,
    status: calls.status,
    fromNumber: calls.fromNumber,
    toNumber: calls.toNumber,
    agentId: calls.agentId,
    extension: calls.extension,
    startedAt: calls.startedAt,
    endedAt: calls.endedAt,
    transcriptionStatus: calls.transcriptionStatus,
    transcriptionError: calls.transcriptionError,
  }).from(calls).where(eq(calls.agentId, pauloId)).orderBy(desc(calls.startedAt)).limit(5);

  console.log(`Paulo's last 5 calls:`);
  for (const c of recentCalls) {
    console.log(`  ${c.startedAt?.toLocaleString()} | ${c.direction} | status: ${c.status} | ext: ${c.extension} | transcription: ${c.transcriptionStatus} | error: ${c.transcriptionError || 'none'}`);
    console.log(`    id: ${c.id}`);
  }

  // Also check for any active/in_progress/ringing calls right now
  const activeCalls = await db.select({
    id: calls.id,
    direction: calls.direction,
    status: calls.status,
    fromNumber: calls.fromNumber,
    toNumber: calls.toNumber,
    agentId: calls.agentId,
    extension: calls.extension,
    startedAt: calls.startedAt,
    transcriptionStatus: calls.transcriptionStatus,
    transcriptionError: calls.transcriptionError,
  }).from(calls).where(
    or(eq(calls.status, 'ringing'), eq(calls.status, 'in_progress'))
  ).orderBy(desc(calls.startedAt)).limit(10);

  console.log(`\nAll active calls (ringing/in_progress):`);
  if (activeCalls.length === 0) {
    console.log('  None');
  }
  for (const c of activeCalls) {
    let agentName = 'NONE';
    if (c.agentId) {
      const [u] = await db.select({ firstName: users.firstName, lastName: users.lastName }).from(users).where(eq(users.id, c.agentId)).limit(1);
      agentName = u ? `${u.firstName} ${u.lastName}` : 'UNKNOWN';
    }
    console.log(`  ${c.startedAt?.toLocaleString()} | ${c.direction} | status: ${c.status} | agent: ${agentName} | ext: ${c.extension} | transcription: ${c.transcriptionStatus} | error: ${c.transcriptionError || 'none'}`);
    console.log(`    id: ${c.id}`);
  }

  // Check most recent call on ext 107 (Paulo's extension)
  const ext107Calls = await db.select({
    id: calls.id,
    direction: calls.direction,
    status: calls.status,
    agentId: calls.agentId,
    extension: calls.extension,
    startedAt: calls.startedAt,
    transcriptionStatus: calls.transcriptionStatus,
    transcriptionError: calls.transcriptionError,
  }).from(calls).where(eq(calls.extension, '107')).orderBy(desc(calls.startedAt)).limit(3);

  console.log(`\nMost recent calls on ext 107:`);
  for (const c of ext107Calls) {
    console.log(`  ${c.startedAt?.toLocaleString()} | ${c.direction} | status: ${c.status} | agent: ${c.agentId?.substring(0,8) || 'NULL'} | transcription: ${c.transcriptionStatus} | error: ${c.transcriptionError || 'none'}`);
    console.log(`    id: ${c.id}`);
  }

  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
