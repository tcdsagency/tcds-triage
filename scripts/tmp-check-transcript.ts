import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env.production.local') });

async function run() {
  const { db } = await import('../src/db');
  const { calls, liveTranscriptSegments, pendingTranscriptJobs } = await import('../src/db/schema');
  const { eq, sql } = await import('drizzle-orm');

  const sessionId = '73bd2352-a7d1-4999-bb56-b84680dd5ef5';

  // 1. Try to find the call by vmSessionId
  console.log('=== Searching by vmSessionId ===');
  let call: any = null;
  const byVmSession = await db.select().from(calls).where(eq(calls.vmSessionId, sessionId)).limit(1);
  if (byVmSession.length > 0) {
    call = byVmSession[0];
    console.log('Found call by vmSessionId');
  }

  // 2. Try by externalCallId
  if (!call) {
    console.log('Not found by vmSessionId, trying externalCallId...');
    const byExternal = await db.select().from(calls).where(eq(calls.externalCallId, sessionId)).limit(1);
    if (byExternal.length > 0) {
      call = byExternal[0];
      console.log('Found call by externalCallId');
    }
  }

  // 3. Try by ID (it's a UUID)
  if (!call) {
    console.log('Not found by externalCallId, trying as call ID...');
    const byId = await db.select().from(calls).where(eq(calls.id, sessionId)).limit(1);
    if (byId.length > 0) {
      call = byId[0];
      console.log('Found call by primary ID');
    }
  }

  if (!call) {
    console.log('\nNo call found with this session ID anywhere!');
    process.exit(0);
    return;
  }

  // Print all call fields
  console.log('\n=== Call Record ===');
  for (const [key, value] of Object.entries(call)) {
    if (key === 'aiSummary' || key === 'aiSentiment' || key === 'aiActionItems' || key === 'aiTopics'
        || key === 'detectedEntities' || key === 'transcriptionSegments') {
      console.log(`  ${key}: ${value ? '[present, length=' + JSON.stringify(value).length + ']' : '[null]'}`);
    } else if (key === 'transcription') {
      console.log(`  ${key}: ${value ? '[present, length=' + (value as string).length + ']' : '[null]'}`);
    } else {
      console.log(`  ${key}: ${value}`);
    }
  }

  // 4. Check for live transcript segments
  console.log('\n=== Live Transcript Segments ===');
  const segments = await db.select().from(liveTranscriptSegments).where(eq(liveTranscriptSegments.callId, call.id));
  console.log(`Found ${segments.length} live transcript segment(s)`);
  if (segments.length > 0) {
    for (const s of segments.slice(0, 5)) {
      console.log(`  #${s.sequenceNumber} [${s.speaker}]: ${s.text?.substring(0, 80)}...`);
    }
    if (segments.length > 5) {
      console.log(`  ... and ${segments.length - 5} more segments`);
    }
  }

  // 5. Check for pending transcript jobs
  console.log('\n=== Pending Transcript Jobs ===');
  const jobs = await db.select().from(pendingTranscriptJobs).where(eq(pendingTranscriptJobs.callId, call.id));
  console.log(`Found ${jobs.length} pending transcript job(s)`);
  for (const j of jobs) {
    console.log(`  Job ID: ${j.id}`);
    console.log(`  Status: ${j.status}`);
    console.log(`  Attempts: ${j.attemptCount}`);
    console.log(`  Error: ${j.error || '[none]'}`);
    console.log(`  Created: ${j.createdAt}`);
    console.log(`  SQL Record ID: ${j.sqlRecordId || '[none]'}`);
    console.log(`  Last Attempt: ${j.lastAttemptAt || '[never]'}`);
    console.log(`  Next Attempt: ${j.nextAttemptAt}`);
  }

  // 6. Summary analysis
  console.log('\n=== Transcript Analysis ===');
  console.log(`  Call ID: ${call.id}`);
  console.log(`  Direction: ${call.direction} (live: ${call.directionLive}, final: ${call.directionFinal})`);
  console.log(`  Status: ${call.status}`);
  console.log(`  Duration: ${call.durationSeconds} seconds`);
  console.log(`  Started: ${call.startedAt}`);
  console.log(`  Ended: ${call.endedAt}`);
  console.log(`  VM Session ID: ${call.vmSessionId || '[none]'}`);
  console.log(`  External Call ID: ${call.externalCallId || '[none]'}`);
  console.log(`  Extension: ${call.extension || '[none]'}`);
  console.log(`  Recording URL: ${call.recordingUrl || '[none]'}`);
  console.log(`  Transcription Status: ${call.transcriptionStatus || '[none]'}`);
  console.log(`  Transcription Error: ${call.transcriptionError || '[none]'}`);
  console.log(`  Transcription Segment Count: ${call.transcriptionSegmentCount}`);
  console.log(`  Has Transcription Text: ${!!call.transcription}`);
  console.log(`  Has Transcription Segments JSON: ${!!call.transcriptionSegments}`);
  console.log(`  Has AI Summary: ${!!call.aiSummary}`);
  console.log(`  From: ${call.fromNumber}`);
  console.log(`  To: ${call.toNumber}`);
  console.log(`  External Number: ${call.externalNumber || '[none]'}`);

  process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
