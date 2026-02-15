import { db } from "../src/db";
import { sql } from "drizzle-orm";

async function checkQueues() {
  // 1. Pending transcript jobs
  const transcriptJobs = await db.execute(sql`
    SELECT status, count(*) as cnt
    FROM pending_transcript_jobs
    GROUP BY status
  `);
  console.log("=== TRANSCRIPT JOBS ===");
  console.log(JSON.stringify(transcriptJobs, null, 2));

  // 2. API Retry Queue
  const retryQueue = await db.execute(sql`
    SELECT status, target_service, count(*) as cnt
    FROM api_retry_queue
    GROUP BY status, target_service
    ORDER BY status
  `);
  console.log("\n=== API RETRY QUEUE ===");
  console.log(JSON.stringify(retryQueue, null, 2));

  // 3. Review Requests
  const reviews = await db.execute(sql`
    SELECT status, count(*) as cnt
    FROM review_requests
    GROUP BY status
  `);
  console.log("\n=== REVIEW REQUESTS ===");
  console.log(JSON.stringify(reviews, null, 2));

  // 4. Stale calls (still in_progress or ringing)
  const staleCalls = await db.execute(sql`
    SELECT id, status, started_at, agent_id
    FROM calls
    WHERE status IN ('ringing', 'in_progress')
    ORDER BY started_at DESC
  `);
  console.log("\n=== STALE CALLS (ringing/in_progress) ===");
  console.log(JSON.stringify(staleCalls, null, 2));

  // 5. Wrapup drafts (last 24h)
  const pendingWrapups = await db.execute(sql`
    SELECT status, count(*) as cnt
    FROM wrapup_drafts
    WHERE created_at > now() - interval '24 hours'
    GROUP BY status
  `);
  console.log("\n=== WRAPUP DRAFTS (last 24h) ===");
  console.log(JSON.stringify(pendingWrapups, null, 2));

  // 6. Quotes pending ticket link
  try {
    const pendingQuotes = await db.execute(sql`
      SELECT count(*) as cnt
      FROM quotes
      WHERE call_id IS NOT NULL
        AND az_ticket_note_posted = false
        AND az_ticket_note_error IS NULL
    `);
    console.log("\n=== QUOTES PENDING TICKET LINK ===");
    console.log(JSON.stringify(pendingQuotes, null, 2));
  } catch {
    console.log("\n=== QUOTES PENDING TICKET LINK ===");
    console.log("(table/columns may not exist yet)");
  }

  // 7. Service tickets (last 24h)
  try {
    const stuckTickets = await db.execute(sql`
      SELECT status, count(*) as cnt
      FROM service_tickets
      WHERE created_at > now() - interval '24 hours'
      GROUP BY status
    `);
    console.log("\n=== SERVICE TICKETS (last 24h) ===");
    console.log(JSON.stringify(stuckTickets, null, 2));
  } catch (e: any) {
    console.log("\n=== SERVICE TICKETS ===");
    console.log("(query error:", e.message, ")");
  }

  process.exit(0);
}

checkQueues().catch((e) => {
  console.error(e);
  process.exit(1);
});
