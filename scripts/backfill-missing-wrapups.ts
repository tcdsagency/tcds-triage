/**
 * Backfill missing wrapups for calls that have transcripts but no wrapup_draft
 *
 * This script finds all calls with transcripts that don't have a wrapup and creates one.
 * Run with: npx tsx scripts/backfill-missing-wrapups.ts
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { sql } from 'drizzle-orm';

const client = postgres(process.env.DATABASE_URL as string);
const db = drizzle(client);

async function backfillMissingWrapups() {
  console.log('='.repeat(80));
  console.log('BACKFILLING MISSING WRAPUPS');
  console.log('='.repeat(80));

  const tenantId = process.env.DEFAULT_TENANT_ID;
  if (!tenantId) {
    console.error('DEFAULT_TENANT_ID not set');
    await client.end();
    return;
  }

  // Find calls with transcripts but no wrapup
  const callsWithoutWrapups = await db.execute(sql`
    SELECT
      c.id,
      c.tenant_id,
      c.direction,
      c.from_number,
      c.to_number,
      c.status,
      c.disposition,
      c.duration_seconds,
      c.started_at,
      c.extension,
      c.agent_id,
      c.ai_summary,
      LENGTH(c.transcription) as transcript_length
    FROM calls c
    LEFT JOIN wrapup_drafts w ON c.id = w.call_id
    WHERE c.started_at >= NOW() - INTERVAL '48 hours'
      AND c.transcription IS NOT NULL
      AND LENGTH(c.transcription) > 50
      AND w.id IS NULL
      AND c.status = 'completed'
    ORDER BY c.started_at DESC
  `);

  console.log(`\nFound ${callsWithoutWrapups.length} calls with transcripts but no wrapup\n`);

  if (callsWithoutWrapups.length === 0) {
    console.log('No calls need backfilling.');
    await client.end();
    return;
  }

  let created = 0;
  let failed = 0;

  for (const call of callsWithoutWrapups as any[]) {
    const isAfterHours = call.disposition === 'after_hours';
    const isHangup = call.disposition === 'hangup';
    const callDir = call.direction || 'inbound';
    const customerPhone = callDir === 'inbound' ? call.from_number : call.to_number;

    console.log(`\nProcessing call ${call.id}:`);
    console.log(`  Direction: ${callDir}`);
    console.log(`  Phone: ${customerPhone}`);
    console.log(`  Disposition: ${call.disposition || 'N/A'}`);
    console.log(`  Duration: ${call.duration_seconds}s`);
    console.log(`  AI Summary: ${call.ai_summary ? 'Yes' : 'No'}`);

    try {
      const result = await db.execute(sql`
        INSERT INTO wrapup_drafts (
          tenant_id,
          call_id,
          direction,
          agent_extension,
          agent_name,
          summary,
          customer_phone,
          request_type,
          status,
          match_status,
          ai_cleaned_summary,
          ai_processing_status,
          ai_processed_at,
          created_at,
          updated_at
        ) VALUES (
          ${call.tenant_id},
          ${call.id},
          ${callDir === 'inbound' ? 'Inbound' : 'Outbound'},
          ${isAfterHours ? 'after-hours' : (call.extension || null)},
          ${isAfterHours ? 'After-Hours Service' : null},
          ${call.ai_summary || 'Call completed - review required'},
          ${customerPhone},
          ${isAfterHours ? 'after_hours' : (isHangup ? 'hangup' : 'general')},
          'pending_review',
          'unmatched',
          ${call.ai_summary || null},
          ${call.ai_summary ? 'completed' : 'skipped'},
          NOW(),
          NOW(),
          NOW()
        )
        ON CONFLICT (call_id) DO NOTHING
        RETURNING id
      `);

      if (result.length > 0) {
        console.log(`  ✅ Created wrapup: ${(result[0] as any).id}`);
        created++;
      } else {
        console.log(`  ⚠️ Wrapup already exists (conflict)`);
      }
    } catch (error) {
      console.error(`  ❌ Failed to create wrapup:`, error);
      failed++;
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log(`BACKFILL COMPLETE: ${created} created, ${failed} failed`);
  console.log('='.repeat(80));

  await client.end();
}

backfillMissingWrapups().catch(console.error);
