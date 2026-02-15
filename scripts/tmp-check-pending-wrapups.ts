import { db } from "../src/db";
import { sql } from "drizzle-orm";

async function checkPendingWrapups() {
  const pending = await db.execute(sql`
    SELECT
      w.id,
      w.call_id,
      w.status,
      w.customer_name,
      w.customer_phone,
      w.direction,
      w.agent_name,
      w.summary,
      w.created_at,
      w.updated_at,
      w.agencyzoom_ticket_id,
      c.status as call_status,
      c.started_at as call_started,
      c.from_number,
      c.to_number,
      j.status as job_status,
      j.error as job_error,
      j.attempt_count
    FROM wrapup_drafts w
    LEFT JOIN calls c ON c.id = w.call_id
    LEFT JOIN pending_transcript_jobs j ON j.call_id = w.call_id
    WHERE w.status = 'pending_review'
      AND w.created_at > now() - interval '48 hours'
    ORDER BY w.created_at DESC
  `);

  console.log(`=== PENDING REVIEW WRAPUPS (${pending.length}) ===`);
  for (const w of pending as any[]) {
    console.log(`\n  Wrapup: ${w.id}`);
    console.log(`  Customer: ${w.customer_name} | Phone: ${w.customer_phone}`);
    console.log(`  Agent: ${w.agent_name} | Direction: ${w.direction}`);
    console.log(`  Call: ${w.call_id} (${w.call_status}) ${w.from_number} → ${w.to_number}`);
    console.log(`  Created: ${w.created_at} | Updated: ${w.updated_at}`);
    console.log(`  AZ Ticket: ${w.agencyzoom_ticket_id || 'none'}`);
    console.log(`  Transcript Job: ${w.job_status || 'no job'} | Attempts: ${w.attempt_count || 0}`);
    if (w.job_error) console.log(`  Job Error: ${(w.job_error || '').substring(0, 150)}`);
    console.log(`  Summary: ${(w.summary || 'none').substring(0, 150)}`);
  }

  process.exit(0);
}

checkPendingWrapups().catch((e) => {
  console.error(e);
  process.exit(1);
});
