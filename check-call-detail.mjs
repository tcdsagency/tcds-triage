import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { sql } from 'drizzle-orm';

const client = postgres(process.env.DATABASE_URL);
const db = drizzle(client);

async function check() {
  const phone = '6019534597';

  console.log('=== SEARCHING FOR MICHAEL INGRAM / 601-953-4597 ===\n');

  // Check calls
  console.log('--- CALLS ---');
  const calls = await db.execute(sql`
    SELECT id, from_number, direction, status, disposition, created_at
    FROM calls
    WHERE from_number LIKE ${'%' + phone + '%'}
       OR from_number LIKE ${'+1' + phone + '%'}
    ORDER BY created_at DESC
    LIMIT 5
  `);
  console.log('Calls found:', calls.length);
  calls.forEach(c => console.log(c));

  // Check messages (after-hours)
  console.log('\n--- MESSAGES (after-hours) ---');
  const messages = await db.execute(sql`
    SELECT id, from_number, contact_name, body, is_after_hours, created_at
    FROM messages
    WHERE from_number LIKE ${'%' + phone + '%'}
       OR from_number LIKE ${'+1' + phone + '%'}
    ORDER BY created_at DESC
    LIMIT 5
  `);
  console.log('Messages found:', messages.length);
  messages.forEach(m => console.log({
    id: m.id,
    from: m.from_number,
    name: m.contact_name,
    afterHours: m.is_after_hours,
    created: m.created_at,
    body: m.body?.substring(0, 100)
  }));

  // Check triage items
  console.log('\n--- TRIAGE ITEMS ---');
  const triage = await db.execute(sql`
    SELECT id, type, status, title, description, created_at
    FROM triage_items
    WHERE title ILIKE '%Ingram%'
       OR title ILIKE '%${phone}%'
       OR description ILIKE '%${phone}%'
    ORDER BY created_at DESC
    LIMIT 5
  `);
  console.log('Triage items found:', triage.length);
  triage.forEach(t => console.log(t));

  // Check ALL recent after-hours items
  console.log('\n--- ALL RECENT AFTER-HOURS MESSAGES (last 24h) ---');
  const recentAH = await db.execute(sql`
    SELECT id, from_number, contact_name, body, created_at
    FROM messages
    WHERE is_after_hours = true
      AND created_at > NOW() - INTERVAL '24 hours'
    ORDER BY created_at DESC
  `);
  console.log('Recent after-hours:', recentAH.length);
  recentAH.forEach(m => console.log({
    from: m.from_number,
    name: m.contact_name,
    created: m.created_at
  }));

  await client.end();
}
check().catch(e => { console.error(e); process.exit(1); });
