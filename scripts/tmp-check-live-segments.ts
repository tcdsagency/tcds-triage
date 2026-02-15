import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env.production.local') });

async function run() {
  const { db } = await import('../src/db');
  const { liveTranscriptSegments } = await import('../src/db/schema');
  const { desc, sql } = await import('drizzle-orm');

  const segs = await db.select({
    id: liveTranscriptSegments.id,
    callId: liveTranscriptSegments.callId,
    speaker: liveTranscriptSegments.speaker,
    text: liveTranscriptSegments.text,
    seq: liveTranscriptSegments.sequenceNumber,
    createdAt: liveTranscriptSegments.createdAt,
  }).from(liveTranscriptSegments)
    .orderBy(desc(liveTranscriptSegments.createdAt))
    .limit(10);

  console.log(`Live transcript segments: ${segs.length}`);
  for (const s of segs) {
    console.log(`  [${s.seq}] ${s.speaker}: ${(s.text || '').substring(0, 80)} (call=${s.callId})`);
  }

  // Use raw SQL for calls table
  const recentCalls: any = await db.execute(sql.raw("SELECT id, vm_session_id, status, direction, created_at FROM calls ORDER BY created_at DESC LIMIT 5"));
  const callRows = Array.isArray(recentCalls) ? recentCalls : recentCalls?.rows || [];
  console.log('\nRecent calls:', callRows.length);
  for (const c of callRows) {
    console.log('  ' + c.id + ' | vm=' + c.vm_session_id + ' | ' + c.status + ' | ' + c.direction);
  }

  // Check if active session has a call
  const sessionResult: any = await db.execute(sql.raw("SELECT id, vm_session_id, status, direction FROM calls WHERE vm_session_id = 'sess_b656a2e7-3984-4b92-a593-97f2d45d95b8' LIMIT 1"));
  const sessionRows = Array.isArray(sessionResult) ? sessionResult : sessionResult?.rows || [];
  console.log('\nCall for active session sess_b656a2e7:', sessionRows.length ? sessionRows[0] : 'NOT FOUND');

  if (sessionRows.length > 0) {
    const callId = sessionRows[0].id;
    const segResult: any = await db.execute(sql.raw("SELECT count(*) as cnt FROM live_transcript_segments WHERE call_id = '" + callId + "'"));
    const segRows = Array.isArray(segResult) ? segResult : segResult?.rows || [];
    console.log('Segments for this call:', segRows[0]?.cnt);
  }

  // Check all unique callIds in segments
  const callIds: any = await db.execute(sql.raw("SELECT call_id, count(*) as cnt FROM live_transcript_segments GROUP BY call_id ORDER BY count(*) DESC LIMIT 5"));
  const cidRows = Array.isArray(callIds) ? callIds : callIds?.rows || [];
  console.log('\nSegments by call:');
  for (const r of cidRows) {
    console.log('  call=' + r.call_id + ' segments=' + r.cnt);
  }

  process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
