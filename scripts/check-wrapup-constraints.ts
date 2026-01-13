import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { sql } from 'drizzle-orm';

const client = postgres(process.env.DATABASE_URL!);
const db = drizzle(client);

async function check() {
  // Check table constraints
  const constraints = await db.execute(sql`
    SELECT conname, contype, pg_get_constraintdef(oid) as definition
    FROM pg_constraint
    WHERE conrelid = 'wrapup_drafts'::regclass
  `);

  console.log('Constraints on wrapup_drafts:');
  for (const c of constraints) {
    console.log(`  ${c.conname} (${c.contype}): ${c.definition}`);
  }

  // Check recent wrapups
  const recent = await db.execute(sql`
    SELECT id, call_id, status, created_at
    FROM wrapup_drafts
    ORDER BY created_at DESC
    LIMIT 5
  `);

  console.log('\nRecent wrapup drafts:');
  for (const w of recent) {
    console.log(`  ${w.id} - call: ${w.call_id} - status: ${w.status}`);
  }

  await client.end();
}
check();
