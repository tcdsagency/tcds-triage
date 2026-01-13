import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { sql } from 'drizzle-orm';

const client = postgres(process.env.DATABASE_URL!);
const db = drizzle(client);

async function check() {
  // Check messages from today
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const result = await db.execute(sql`
    SELECT id, direction, from_number, to_number, body, is_after_hours, created_at
    FROM messages
    WHERE created_at >= ${today.toISOString()}
    ORDER BY created_at DESC
    LIMIT 20
  `);

  console.log('Messages from today:', result.length);
  result.forEach((m: any) => {
    console.log(`[${m.direction}] ${m.from_number} -> ${m.to_number}: ${(m.body || '').substring(0, 50)}... (after_hours: ${m.is_after_hours}, ${m.created_at})`);
  });

  // Also check total message count
  const total = await db.execute(sql`SELECT COUNT(*) as count FROM messages`);
  console.log('\nTotal messages in DB:', total[0].count);

  // Check most recent messages regardless of date
  console.log('\nMost recent 5 messages:');
  const recent = await db.execute(sql`
    SELECT id, direction, from_number, body, is_after_hours, created_at
    FROM messages
    ORDER BY created_at DESC
    LIMIT 5
  `);
  recent.forEach((m: any) => {
    console.log(`  ${m.created_at} [${m.direction}] ${m.from_number}: ${(m.body || '').substring(0, 40)}...`);
  });

  await client.end();
}
check();
