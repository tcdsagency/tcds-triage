import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { sql } from 'drizzle-orm';

const client = postgres(process.env.DATABASE_URL!);
const db = drizzle(client);

async function check() {
  // Get stuck runs details
  const stuck = await db.execute(sql`
    SELECT id, run_type, status, started_at, error_message
    FROM risk_monitor_activity_log
    WHERE status = 'running'
    ORDER BY started_at DESC
  `);

  console.log('Stuck running scans (' + stuck.length + '):');
  for (const r of stuck) {
    console.log(`  ID: ${r.id}`);
    console.log(`  Started: ${r.started_at}`);
    console.log(`  Error: ${r.error_message || 'none'}`);
    console.log('');
  }

  // Get error messages from failed scans
  const failed = await db.execute(sql`
    SELECT id, started_at, error_message
    FROM risk_monitor_activity_log
    WHERE status = 'failed'
    ORDER BY started_at DESC
    LIMIT 5
  `);

  console.log('\nRecent failed scans error messages:');
  for (const r of failed) {
    console.log(`  [${r.started_at}] ${r.error_message || 'no error message'}`);
  }

  await client.end();
}
check();
