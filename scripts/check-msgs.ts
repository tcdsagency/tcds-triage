import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { desc } from 'drizzle-orm';
import { pgTable, text, timestamp, uuid, boolean, varchar } from 'drizzle-orm/pg-core';

const messages = pgTable('messages', {
  id: uuid('id').primaryKey(),
  fromNumber: varchar('from_number'),
  contactName: text('contact_name'),
  isAfterHours: boolean('is_after_hours'),
  isAcknowledged: boolean('is_acknowledged'),
  createdAt: timestamp('created_at'),
});

async function main() {
  const dbUrl = process.env.DATABASE_URL || '';
  const client = postgres(dbUrl);
  const db = drizzle(client);

  console.log('=== Most Recent 10 Messages ===');
  const results = await db
    .select()
    .from(messages)
    .orderBy(desc(messages.createdAt))
    .limit(10);

  for (const m of results) {
    const marker = m.isAfterHours ? '[AH]' : '[SMS]';
    const ack = m.isAcknowledged ? 'ACK' : 'NEW';
    console.log(marker, ack, m.fromNumber || 'no-phone', '-', m.contactName || 'unknown', '-', m.createdAt);
  }

  console.log('\nCurrent time:', new Date().toISOString());
  await client.end();
}

main().catch(console.error);
