import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { sql } from 'drizzle-orm';

const client = postgres(process.env.DATABASE_URL!);
const db = drizzle(client);

async function cleanup() {
  // Mark stuck running scans as failed
  const result = await db.execute(sql`
    UPDATE risk_monitor_activity_log
    SET status = 'failed',
        error_message = 'Stuck in running state - cleaned up',
        completed_at = NOW()
    WHERE status = 'running'
    RETURNING id, started_at
  `);

  console.log('Cleaned up', result.length, 'stuck scans:');
  for (const r of result) {
    console.log(`  ID: ${r.id}, Started: ${r.started_at}`);
  }

  await client.end();
}
cleanup();
