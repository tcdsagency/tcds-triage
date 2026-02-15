import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

async function run() {
  const { db } = await import('../src/db');
  const { calls, liveTranscriptSegments } = await import('../src/db/schema');
  const { eq, desc, gte, sql, or, and, ilike } = await import('drizzle-orm');

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Find ALL calls on ext 107 today (might be duplicates)
  const ext107Calls = await db.select({
    id: calls.id,
    status: calls.status,
    vmSessionId: calls.vmSessionId,
    externalCallId: calls.externalCallId,
    extension: calls.extension,
    agentId: calls.agentId,
    fromNumber: calls.fromNumber,
    toNumber: calls.toNumber,
    transcriptionStatus: calls.transcriptionStatus,
    transcriptionSegmentCount: calls.transcriptionSegmentCount,
    startedAt: calls.startedAt,
    answeredAt: calls.answeredAt,
    endedAt: calls.endedAt,
    durationSeconds: calls.durationSeconds,
  }).from(calls).where(
    and(
      gte(calls.startedAt, today),
      or(
        eq(calls.extension, '107'),
        eq(calls.agentId, '145325f7-349a-4dc0-83c2-657a69d95545')
      )
    )
  ).orderBy(desc(calls.startedAt));

  console.log(`All calls for Paulo/ext-107 today: ${ext107Calls.length}\n`);
  for (const c of ext107Calls) {
    // Count segments for this call
    const segResult = await db.select({ count: sql<number>`count(*)::int` })
      .from(liveTranscriptSegments)
      .where(eq(liveTranscriptSegments.callId, c.id));
    const segCount = segResult[0]?.count || 0;

    console.log(`Call: ${c.id}`);
    console.log(`  status: ${c.status} | ext: ${c.extension} | agentId: ${c.agentId?.substring(0,8) || 'NULL'}`);
    console.log(`  externalCallId: ${c.externalCallId || 'NULL'}`);
    console.log(`  vmSessionId: ${c.vmSessionId || 'NULL'}`);
    console.log(`  from: ${c.fromNumber} | to: ${c.toNumber}`);
    console.log(`  started: ${c.startedAt?.toLocaleTimeString()} | answered: ${c.answeredAt?.toLocaleTimeString() || 'N/A'} | ended: ${c.endedAt?.toLocaleTimeString() || 'ACTIVE'}`);
    console.log(`  transcription: ${c.transcriptionStatus} | dbSegCount: ${c.transcriptionSegmentCount} | actualSegs: ${segCount}`);
    console.log(`  duration: ${c.durationSeconds || 'N/A'}s`);
    console.log('');
  }

  // Check if any segments exist today at all
  const allSegsToday = await db.select({
    callId: liveTranscriptSegments.callId,
    count: sql<number>`count(*)::int`,
  }).from(liveTranscriptSegments)
    .where(gte(liveTranscriptSegments.timestamp, today))
    .groupBy(liveTranscriptSegments.callId);

  console.log(`\nAll transcript segments today by call:`);
  if (allSegsToday.length === 0) {
    console.log('  NONE - no segments stored today at all');
  }
  for (const s of allSegsToday) {
    console.log(`  call ${s.callId}: ${s.count} segments`);
  }

  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
