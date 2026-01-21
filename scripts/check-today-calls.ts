import { config } from 'dotenv';
config({ path: '.env.local' });

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { sql } from 'drizzle-orm';

const client = postgres(process.env.DATABASE_URL as string);
const db = drizzle(client);

async function check() {
  console.log('=== CALLS FROM TODAY (since midnight CST) ===');
  console.log('Current time:', new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' }));

  const todayCalls = await db.execute(sql`
    SELECT
      c.id,
      c.direction,
      c.from_number,
      c.to_number,
      c.status,
      c.disposition,
      c.duration_seconds,
      c.started_at,
      c.agent_id,
      c.transcription IS NOT NULL as has_transcript,
      LENGTH(c.transcription) as transcript_length,
      c.ai_summary IS NOT NULL as has_ai_summary,
      w.id as wrapup_id,
      w.status as wrapup_status,
      w.outcome as wrapup_outcome
    FROM calls c
    LEFT JOIN wrapup_drafts w ON c.id = w.call_id
    WHERE c.started_at >= (CURRENT_DATE AT TIME ZONE 'America/Chicago')
    ORDER BY c.started_at DESC
  `);

  console.log('\nTotal calls today:', todayCalls.length);

  if (todayCalls.length === 0) {
    console.log('\nNo calls found today. Checking recent calls...\n');

    // Show most recent 10 calls
    const recentCalls = await db.execute(sql`
      SELECT
        c.id,
        c.direction,
        c.from_number,
        c.to_number,
        c.status,
        c.disposition,
        c.duration_seconds,
        c.started_at,
        c.transcription IS NOT NULL as has_transcript,
        LENGTH(c.transcription) as transcript_length,
        c.ai_summary IS NOT NULL as has_ai_summary,
        w.id as wrapup_id,
        w.status as wrapup_status,
        w.outcome as wrapup_outcome
      FROM calls c
      LEFT JOIN wrapup_drafts w ON c.id = w.call_id
      WHERE c.status = 'completed'
      ORDER BY c.started_at DESC
      LIMIT 10
    `);

    console.log('Most recent 10 completed calls:');
    for (const c of recentCalls as any[]) {
      const time = new Date(c.started_at).toLocaleString('en-US', { timeZone: 'America/Chicago' });
      const phone = c.direction === 'inbound' ? c.from_number : c.to_number;
      console.log('---');
      console.log(`Time: ${time} | Direction: ${c.direction}`);
      console.log(`Phone: ${phone || 'Unknown'} | Duration: ${c.duration_seconds || 0}s`);
      console.log(`Status: ${c.status} | Disposition: ${c.disposition || 'N/A'}`);
      console.log(`Has Transcript: ${c.has_transcript ? 'Yes (' + c.transcript_length + ' chars)' : 'No'}`);
      console.log(`AI Summary: ${c.has_ai_summary ? 'Yes' : 'No'}`);
      console.log(`Wrapup: ${c.wrapup_id ? `${c.wrapup_status} (${c.wrapup_outcome || 'no outcome'})` : 'NONE CREATED'}`);
    }
  } else {
    for (const c of todayCalls as any[]) {
      const time = new Date(c.started_at).toLocaleTimeString('en-US', { timeZone: 'America/Chicago' });
      const phone = c.direction === 'inbound' ? c.from_number : c.to_number;
      console.log('---');
      console.log(`Time: ${time} | Direction: ${c.direction}`);
      console.log(`Phone: ${phone || 'Unknown'} | Duration: ${c.duration_seconds || 0}s`);
      console.log(`Status: ${c.status} | Disposition: ${c.disposition || 'N/A'}`);
      console.log(`Has Transcript: ${c.has_transcript ? 'Yes (' + c.transcript_length + ' chars)' : 'No'}`);
      console.log(`AI Summary: ${c.has_ai_summary ? 'Yes' : 'No'}`);
      console.log(`Wrapup: ${c.wrapup_id ? `${c.wrapup_status} (${c.wrapup_outcome || 'no outcome'})` : 'NONE CREATED'}`);
    }
  }

  // Also check for calls with transcripts but no wrapup
  console.log('\n\n=== CALLS WITH TRANSCRIPTS BUT NO WRAPUP (last 48 hours) ===');

  const missingWrapups = await db.execute(sql`
    SELECT
      c.id,
      c.direction,
      c.from_number,
      c.to_number,
      c.status,
      c.disposition,
      c.duration_seconds,
      c.started_at,
      LENGTH(c.transcription) as transcript_length,
      c.ai_summary
    FROM calls c
    LEFT JOIN wrapup_drafts w ON c.id = w.call_id
    WHERE c.started_at >= NOW() - INTERVAL '48 hours'
      AND c.transcription IS NOT NULL
      AND LENGTH(c.transcription) > 50
      AND w.id IS NULL
    ORDER BY c.started_at DESC
  `);

  console.log(`Found: ${missingWrapups.length} calls with transcripts but no wrapup\n`);

  for (const c of missingWrapups as any[]) {
    const time = new Date(c.started_at).toLocaleString('en-US', { timeZone: 'America/Chicago' });
    const phone = c.direction === 'inbound' ? c.from_number : c.to_number;
    console.log('---');
    console.log(`Time: ${time}`);
    console.log(`Direction: ${c.direction} | Phone: ${phone || 'Unknown'}`);
    console.log(`Duration: ${c.duration_seconds || 0}s | Disposition: ${c.disposition || 'N/A'}`);
    console.log(`Transcript: ${c.transcript_length} chars`);
    console.log(`AI Summary: ${c.ai_summary ? c.ai_summary.substring(0, 100) + '...' : 'None'}`);
  }

  await client.end();
}

check().catch(console.error);
