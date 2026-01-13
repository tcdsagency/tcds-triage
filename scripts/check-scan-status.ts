import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { sql } from 'drizzle-orm';

const client = postgres(process.env.DATABASE_URL!);
const db = drizzle(client);

async function check() {
  // Check for any running scans
  const running = await db.execute(sql`
    SELECT id, run_type, status, started_at, policies_checked, alerts_created, errors_encountered
    FROM risk_monitor_activity_log
    WHERE status = 'running'
    ORDER BY started_at DESC
    LIMIT 5
  `);

  console.log('Currently running scans:', running.length);
  if (running.length > 0) {
    for (const r of running) {
      console.log(`  [running] ${r.run_type} started at ${r.started_at}`);
    }
  }

  // Check recent completed scans
  const recent = await db.execute(sql`
    SELECT id, run_type, status, started_at, completed_at, policies_checked, alerts_created, errors_encountered
    FROM risk_monitor_activity_log
    WHERE status IN ('completed', 'failed')
    ORDER BY started_at DESC
    LIMIT 10
  `);

  console.log('\nRecent completed scans:');
  for (const r of recent) {
    console.log(`  [${r.status}] ${r.run_type} at ${r.started_at}: ${r.policies_checked || 0} checked, ${r.alerts_created || 0} alerts, ${r.errors_encountered || 0} errors`);
  }

  await client.end();
}
check();
