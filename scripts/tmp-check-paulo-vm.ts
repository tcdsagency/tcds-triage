import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

async function run() {
  const { db } = await import('../src/db');
  const { calls, liveTranscriptSegments } = await import('../src/db/schema');
  const { eq, sql, desc } = await import('drizzle-orm');

  // Get Paulo's active call with all VM-related fields
  const [call] = await db.select({
    id: calls.id,
    status: calls.status,
    vmSessionId: calls.vmSessionId,
    extension: calls.extension,
    externalCallId: calls.externalCallId,
    transcriptionStatus: calls.transcriptionStatus,
    transcriptionError: calls.transcriptionError,
    transcriptionSegmentCount: calls.transcriptionSegmentCount,
    agentId: calls.agentId,
    startedAt: calls.startedAt,
    answeredAt: calls.answeredAt,
  }).from(calls).where(eq(calls.id, 'fca286ea-a331-4d87-9195-d31a43f82978')).limit(1);

  if (!call) {
    console.log('Call not found');
    process.exit(1);
  }

  console.log('Paulo call details:');
  console.log('  id:', call.id);
  console.log('  status:', call.status);
  console.log('  vmSessionId:', call.vmSessionId || 'NULL');
  console.log('  extension:', call.extension);
  console.log('  externalCallId:', call.externalCallId || 'NULL');
  console.log('  transcriptionStatus:', call.transcriptionStatus);
  console.log('  transcriptionError:', call.transcriptionError || 'none');
  console.log('  transcriptionSegmentCount:', call.transcriptionSegmentCount);
  console.log('  startedAt:', call.startedAt);
  console.log('  answeredAt:', call.answeredAt);

  // Check segments
  const segments = await db.select({
    id: liveTranscriptSegments.id,
    text: liveTranscriptSegments.text,
    speaker: liveTranscriptSegments.speaker,
    sequenceNumber: liveTranscriptSegments.sequenceNumber,
  }).from(liveTranscriptSegments).where(eq(liveTranscriptSegments.callId, call.id)).limit(5);

  console.log(`\nSegments: ${segments.length}`);
  for (const s of segments) {
    console.log(`  #${s.sequenceNumber} [${s.speaker}]: ${s.text?.substring(0, 80)}`);
  }

  // Check if there are any VM Bridge calls today with segments
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const vmCalls = await db.select({
    id: calls.id,
    vmSessionId: calls.vmSessionId,
    extension: calls.extension,
    status: calls.status,
    transcriptionSegmentCount: calls.transcriptionSegmentCount,
    startedAt: calls.startedAt,
  }).from(calls).where(sql`${calls.vmSessionId} IS NOT NULL AND ${calls.startedAt} >= ${today}`).orderBy(desc(calls.startedAt)).limit(10);

  console.log(`\nVM Bridge calls today: ${vmCalls.length}`);
  for (const c of vmCalls) {
    console.log(`  ${c.startedAt?.toLocaleTimeString()} | vm: ${c.vmSessionId} | ext: ${c.extension} | segments: ${c.transcriptionSegmentCount} | status: ${c.status}`);
  }

  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
