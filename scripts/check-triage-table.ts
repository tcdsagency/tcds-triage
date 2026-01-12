import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { sql } from 'drizzle-orm';

async function main() {
  const dbUrl = process.env.DATABASE_URL || '';
  const client = postgres(dbUrl);
  const db = drizzle(client);

  console.log('=== Checking if triage_items table exists ===');

  try {
    const result = await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'triage_items'
      ) as exists
    `);
    console.log('Table exists:', result);
  } catch (e) {
    console.log('Error checking table:', e);
  }

  console.log('\n=== Counting triage_items ===');
  try {
    const count = await db.execute(sql`SELECT COUNT(*) FROM triage_items`);
    console.log('Count:', count);
  } catch (e) {
    console.log('Error counting:', e);
  }

  await client.end();
}

main().catch(console.error);
