import { config } from 'dotenv';
config({ path: '.env.local' });

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { sql } from 'drizzle-orm';

const client = postgres(process.env.DATABASE_URL as string);
const db = drizzle(client);

async function check() {
  console.log('='.repeat(80));
  console.log('MORNING WRAPUPS DIAGNOSTIC REPORT');
  console.log('Generated:', new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' }));
  console.log('='.repeat(80));

  // Get today's date range in CST
  const today = new Date();
  const cstOffset = -6 * 60; // CST is UTC-6
  const startOfDay = new Date(today);
  startOfDay.setHours(0, 0, 0, 0);

  // Check ALL wrapups from today (regardless of status)
  const allWrapups = await db.execute(sql`
    SELECT
      w.id,
      w.status,
      w.match_status,
      w.customer_name,
      w.customer_phone,
      w.request_type,
      w.agent_extension,
      w.agent_name,
      w.is_auto_voided,
      w.auto_void_reason,
      w.outcome,
      w.created_at,
      w.ai_cleaned_summary,
      c.direction as call_direction,
      c.duration_seconds,
      c.disposition as call_disposition,
      c.transcription IS NOT NULL as has_transcript,
      LENGTH(c.transcription) as transcript_length
    FROM wrapup_drafts w
    LEFT JOIN calls c ON w.call_id = c.id
    WHERE w.created_at >= NOW() - INTERVAL '24 hours'
    ORDER BY w.created_at DESC
  `);

  console.log(`\n${'─'.repeat(80)}`);
  console.log(`TOTAL WRAPUPS IN LAST 24 HOURS: ${allWrapups.length}`);
  console.log('─'.repeat(80));

  // Group by status
  const byStatus: Record<string, any[]> = {};
  allWrapups.forEach((w: any) => {
    const status = w.status || 'unknown';
    if (!byStatus[status]) byStatus[status] = [];
    byStatus[status].push(w);
  });

  console.log('\nBREAKDOWN BY STATUS:');
  for (const [status, items] of Object.entries(byStatus)) {
    console.log(`  ${status}: ${items.length}`);
  }

  // Check for auto-voided
  const autoVoided = allWrapups.filter((w: any) => w.is_auto_voided);
  console.log(`\nAUTO-VOIDED: ${autoVoided.length}`);
  if (autoVoided.length > 0) {
    console.log('  Reasons:');
    const reasons: Record<string, number> = {};
    autoVoided.forEach((w: any) => {
      const reason = w.auto_void_reason || 'no_reason';
      reasons[reason] = (reasons[reason] || 0) + 1;
    });
    for (const [reason, count] of Object.entries(reasons)) {
      console.log(`    - ${reason}: ${count}`);
    }
  }

  // Show pending_review items
  const pendingReview = allWrapups.filter((w: any) => w.status === 'pending_review');
  console.log(`\n${'─'.repeat(80)}`);
  console.log(`PENDING REVIEW ITEMS: ${pendingReview.length}`);
  console.log('─'.repeat(80));

  if (pendingReview.length > 0) {
    pendingReview.forEach((w: any, i: number) => {
      const time = new Date(w.created_at).toLocaleTimeString('en-US', { timeZone: 'America/Chicago' });
      console.log(`\n${i + 1}. ${w.customer_name || 'Unknown'} @ ${time}`);
      console.log(`   Phone: ${w.customer_phone}`);
      console.log(`   Type: ${w.request_type}`);
      console.log(`   Agent: ${w.agent_name || 'N/A'} (ext: ${w.agent_extension || 'N/A'})`);
      console.log(`   Match: ${w.match_status}`);
      console.log(`   Call: ${w.call_direction || 'N/A'}, ${w.duration_seconds || 0}s`);
      console.log(`   Transcript: ${w.has_transcript ? `Yes (${w.transcript_length} chars)` : 'No'}`);
    });
  }

  // Show completed/non-pending items
  const notPending = allWrapups.filter((w: any) => w.status !== 'pending_review');
  console.log(`\n${'─'.repeat(80)}`);
  console.log(`NON-PENDING ITEMS (completed/posted/voided): ${notPending.length}`);
  console.log('─'.repeat(80));

  if (notPending.length > 0) {
    notPending.forEach((w: any, i: number) => {
      const time = new Date(w.created_at).toLocaleTimeString('en-US', { timeZone: 'America/Chicago' });
      console.log(`\n${i + 1}. ${w.customer_name || 'Unknown'} @ ${time}`);
      console.log(`   Phone: ${w.customer_phone}`);
      console.log(`   Status: ${w.status}`);
      console.log(`   Outcome: ${w.outcome || 'N/A'}`);
      console.log(`   Auto-voided: ${w.is_auto_voided ? `Yes (${w.auto_void_reason})` : 'No'}`);
      console.log(`   Match: ${w.match_status}`);
      console.log(`   Transcript: ${w.has_transcript ? `Yes (${w.transcript_length} chars)` : 'No'}`);
    });
  }

  // Check calls without wrapups
  console.log(`\n${'─'.repeat(80)}`);
  console.log('CALLS WITHOUT WRAPUPS (last 24 hours):');
  console.log('─'.repeat(80));

  const callsWithoutWrapups = await db.execute(sql`
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
      c.ai_summary
    FROM calls c
    LEFT JOIN wrapup_drafts w ON c.id = w.call_id
    WHERE c.started_at >= NOW() - INTERVAL '24 hours'
      AND w.id IS NULL
      AND c.status = 'completed'
    ORDER BY c.started_at DESC
  `);

  console.log(`Found: ${callsWithoutWrapups.length}`);
  if (callsWithoutWrapups.length > 0) {
    callsWithoutWrapups.forEach((c: any, i: number) => {
      const time = new Date(c.started_at).toLocaleTimeString('en-US', { timeZone: 'America/Chicago' });
      const phone = c.direction === 'inbound' ? c.from_number : c.to_number;
      console.log(`\n${i + 1}. ${c.direction} @ ${time}`);
      console.log(`   Phone: ${phone}`);
      console.log(`   Duration: ${c.duration_seconds || 0}s`);
      console.log(`   Disposition: ${c.disposition || 'N/A'}`);
      console.log(`   Transcript: ${c.has_transcript ? `Yes (${c.transcript_length} chars)` : 'No'}`);
      console.log(`   AI Summary: ${c.ai_summary ? 'Yes' : 'No'}`);
    });
  }

  // Check triage items that might have merged calls
  console.log(`\n${'─'.repeat(80)}`);
  console.log('AFTER-HOURS TRIAGE ITEMS WITH LINKED CALLS:');
  console.log('─'.repeat(80));

  const triageWithCalls = await db.execute(sql`
    SELECT
      t.id,
      t.title,
      t.status,
      t.call_id,
      t.message_id,
      t.created_at,
      t.ai_summary,
      c.from_number,
      c.duration_seconds
    FROM triage_items t
    LEFT JOIN calls c ON t.call_id = c.id
    WHERE t.type = 'after_hours'
      AND t.created_at >= NOW() - INTERVAL '24 hours'
    ORDER BY t.created_at DESC
  `);

  console.log(`Found: ${triageWithCalls.length}`);
  if (triageWithCalls.length > 0) {
    triageWithCalls.forEach((t: any, i: number) => {
      const time = new Date(t.created_at).toLocaleTimeString('en-US', { timeZone: 'America/Chicago' });
      console.log(`\n${i + 1}. ${t.title || 'Unknown'} @ ${time}`);
      console.log(`   Status: ${t.status}`);
      console.log(`   Has linked call: ${t.call_id ? `Yes (${t.from_number}, ${t.duration_seconds}s)` : 'No'}`);
      console.log(`   Has linked message: ${t.message_id ? 'Yes' : 'No'}`);
    });
  }

  console.log(`\n${'='.repeat(80)}`);
  console.log('END OF REPORT');
  console.log('='.repeat(80));

  await client.end();
}

check().catch(console.error);
