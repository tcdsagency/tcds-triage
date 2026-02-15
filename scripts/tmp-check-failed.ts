import { db } from "../src/db";
import { sql } from "drizzle-orm";

async function checkFailed() {
  // 1. Failed transcript jobs
  const failedJobs = await db.execute(sql`
    SELECT
      j.id,
      j.call_id,
      j.caller_number,
      j.agent_extension,
      j.attempt_count,
      j.error,
      j.created_at,
      j.failed_at,
      c.direction,
      c.from_number,
      c.to_number,
      c.started_at as call_started,
      c.status as call_status
    FROM pending_transcript_jobs j
    LEFT JOIN calls c ON c.id = j.call_id
    WHERE j.status = 'failed'
    ORDER BY j.created_at DESC
  `);
  console.log("=== FAILED TRANSCRIPT JOBS (" + failedJobs.length + ") ===");
  for (const j of failedJobs as any[]) {
    console.log(`\n  Job: ${j.id}`);
    console.log(`  Call: ${j.call_id} (${j.direction}) ${j.from_number} → ${j.to_number}`);
    console.log(`  Call status: ${j.call_status} | Started: ${j.call_started}`);
    console.log(`  Attempts: ${j.attempt_count} | Created: ${j.created_at} | Failed: ${j.failed_at}`);
    console.log(`  Error: ${(j.error || '').substring(0, 200)}`);
  }

  // 2. Failed review requests
  const failedReviews = await db.execute(sql`
    SELECT
      id,
      customer_name,
      customer_phone,
      call_id,
      status,
      error_message,
      created_at,
      updated_at
    FROM review_requests
    WHERE status = 'failed'
    ORDER BY created_at DESC
  `);
  console.log("\n\n=== FAILED REVIEW REQUESTS (" + failedReviews.length + ") ===");
  for (const rev of failedReviews as any[]) {
    console.log(`\n  ID: ${rev.id}`);
    console.log(`  Customer: ${rev.customer_name} | Phone: ${rev.customer_phone}`);
    console.log(`  Call: ${rev.call_id}`);
    console.log(`  Error: ${(rev.error_message || '').substring(0, 200)}`);
    console.log(`  Created: ${rev.created_at} | Updated: ${rev.updated_at}`);
  }

  // 3. Check orphaned wrapups from failed jobs
  const orphanedWrapups = await db.execute(sql`
    SELECT
      w.id,
      w.call_id,
      w.status,
      w.customer_name,
      w.created_at,
      j.error as job_error
    FROM wrapup_drafts w
    JOIN pending_transcript_jobs j ON j.call_id = w.call_id
    WHERE j.status = 'failed'
      AND w.status NOT IN ('completed', 'dismissed')
    ORDER BY w.created_at DESC
  `);
  console.log("\n\n=== ORPHANED WRAPUPS (failed job + incomplete wrapup) (" + orphanedWrapups.length + ") ===");
  for (const wr of orphanedWrapups as any[]) {
    console.log(`\n  Wrapup: ${wr.id} | Status: ${wr.status}`);
    console.log(`  Customer: ${wr.customer_name}`);
    console.log(`  Call: ${wr.call_id}`);
    console.log(`  Job error: ${(wr.job_error || '').substring(0, 200)}`);
  }

  // 4. Date breakdown of failures
  const failureDates = await db.execute(sql`
    SELECT
      date_trunc('day', created_at) as day,
      count(*) as cnt
    FROM pending_transcript_jobs
    WHERE status = 'failed'
    GROUP BY day
    ORDER BY day DESC
  `);
  console.log("\n\n=== FAILURE DATES ===");
  for (const d of failureDates as any[]) {
    console.log(`  ${d.day}: ${d.cnt} failed`);
  }

  process.exit(0);
}

checkFailed().catch((e) => {
  console.error(e);
  process.exit(1);
});
