import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { sql } from 'drizzle-orm';

const client = postgres(process.env.DATABASE_URL as string);
const db = drizzle(client);

async function check() {
  // Check pending wrapups
  const wrapups = await db.execute(sql`
    SELECT id, customer_name, request_type, created_at,
           EXTRACT(EPOCH FROM (NOW() - created_at)) / 60 as age_minutes
    FROM wrapup_drafts
    WHERE status = 'pending_review'
    ORDER BY created_at DESC
    LIMIT 5
  `);

  console.log('Pending wrapups:', wrapups.length);
  if (wrapups.length > 0) {
    wrapups.forEach((w: any) => {
      const ageSeconds = Math.round(w.age_minutes * 60);
      const overdue = ageSeconds >= 90 ? '⚠️ OVERDUE' : '';
      console.log(`  - ${w.customer_name || 'Unknown'} (${w.request_type}) - ${Math.round(w.age_minutes)} min old ${overdue}`);
    });
  }

  // Check pending messages
  const messages = await db.execute(sql`
    SELECT id, contact_name, from_number, created_at,
           EXTRACT(EPOCH FROM (NOW() - created_at)) / 60 as age_minutes
    FROM messages
    WHERE is_acknowledged = false
    ORDER BY created_at DESC
    LIMIT 5
  `);

  console.log('\nPending messages:', messages.length);
  if (messages.length > 0) {
    messages.forEach((m: any) => {
      const ageSeconds = Math.round(m.age_minutes * 60);
      const overdue = ageSeconds >= 90 ? '⚠️ OVERDUE' : '';
      console.log(`  - ${m.contact_name || m.from_number} - ${Math.round(m.age_minutes)} min old ${overdue}`);
    });
  }

  await client.end();
}
check();
