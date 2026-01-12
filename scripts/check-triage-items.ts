import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { desc, eq } from 'drizzle-orm';
import { pgTable, text, timestamp, uuid, varchar, boolean } from 'drizzle-orm/pg-core';

const triageItems = pgTable('triage_items', {
  id: uuid('id').primaryKey(),
  type: varchar('type'),
  status: varchar('status'),
  title: text('title'),
  description: text('description'),
  messageId: uuid('message_id'),
  createdAt: timestamp('created_at'),
});

async function main() {
  const dbUrl = process.env.DATABASE_URL || '';
  const client = postgres(dbUrl);
  const db = drizzle(client);

  console.log('=== Recent Triage Items ===');
  const results = await db
    .select()
    .from(triageItems)
    .orderBy(desc(triageItems.createdAt))
    .limit(15);

  for (const t of results) {
    console.log('---');
    console.log('ID:', t.id);
    console.log('Type:', t.type);
    console.log('Status:', t.status);
    console.log('Title:', t.title);
    console.log('MessageId:', t.messageId);
    console.log('Created:', t.createdAt);
  }

  // Count by type
  console.log('\n=== Count by Type ===');
  const afterHours = results.filter(r => r.type === 'after_hours');
  console.log('after_hours:', afterHours.length);

  await client.end();
}

main().catch(console.error);
