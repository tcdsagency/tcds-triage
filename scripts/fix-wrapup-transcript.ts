// Fix script to update wrapup with live transcript
// Run with: npx tsx scripts/fix-wrapup-transcript.ts

import { db } from '../src/db';
import { wrapupDrafts, calls, liveTranscriptSegments } from '../src/db/schema';
import { eq, asc } from 'drizzle-orm';

const CALL_ID = 'eda39152-f177-4bf6-9db1-216c468fc83d';

async function main() {
  console.log('Fetching live transcript segments...');

  // Get segments
  const segments = await db
    .select({
      speaker: liveTranscriptSegments.speaker,
      text: liveTranscriptSegments.text,
      sequenceNumber: liveTranscriptSegments.sequenceNumber,
    })
    .from(liveTranscriptSegments)
    .where(eq(liveTranscriptSegments.callId, CALL_ID))
    .orderBy(asc(liveTranscriptSegments.sequenceNumber));

  if (segments.length === 0) {
    console.log('No segments found!');
    process.exit(1);
  }

  console.log(`Found ${segments.length} segments`);

  // Consolidate
  const transcript = segments
    .map(s => {
      const speaker = s.speaker === 'agent' ? 'Agent' : 'Customer';
      return `${speaker}: ${s.text}`;
    })
    .join('\n');

  console.log('Consolidated transcript:');
  console.log(transcript);
  console.log('---');

  // Update the wrapup
  console.log('Updating wrapup...');
  await db
    .update(wrapupDrafts)
    .set({
      summary: 'Agent tested outbound call to Spectrum IVR system. Verified live transcription is working correctly.',
      aiExtraction: {
        transcriptSource: 'live_fallback',
        topics: ['test_call', 'live_transcription'],
        sentiment: 'neutral',
      },
      aiProcessingStatus: 'completed',
      aiProcessedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(wrapupDrafts.callId, CALL_ID));

  // Update call with transcript
  console.log('Updating call...');
  await db
    .update(calls)
    .set({
      transcription: transcript,
      transcriptionStatus: 'completed',
      aiSummary: 'Agent tested outbound call to Spectrum IVR system. Verified live transcription is working correctly.',
      updatedAt: new Date(),
    })
    .where(eq(calls.id, CALL_ID));

  console.log('Done!');
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
