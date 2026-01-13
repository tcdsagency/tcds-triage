import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { sql } from 'drizzle-orm';

const client = postgres(process.env.DATABASE_URL as string);
const db = drizzle(client);

async function createTestItem() {
  // Create a test wrapup that's 2 minutes old (will trigger alert at 90 seconds)
  const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);

  const result = await db.execute(sql`
    INSERT INTO wrapup_drafts (
      id,
      tenant_id,
      session_id,
      customer_name,
      customer_phone,
      request_type,
      summary,
      ai_cleaned_summary,
      status,
      match_status,
      created_at,
      updated_at
    ) VALUES (
      gen_random_uuid(),
      ${process.env.DEFAULT_TENANT_ID || 'default'},
      'test-session-' || extract(epoch from now())::text,
      'TEST - Delete Me',
      '555-123-4567',
      'Test Alert',
      'This is a test wrapup to trigger the pending review alert. You can delete this after testing.',
      'This is a test wrapup to trigger the pending review alert. You can delete this after testing.',
      'pending_review',
      'matched',
      ${twoMinutesAgo.toISOString()}::timestamp,
      NOW()
    )
    RETURNING id, customer_name, created_at
  `);

  console.log('Created test pending item:');
  console.log(result[0]);
  console.log('\nRefresh the Pending Review page - the alert should trigger within 60 seconds.');
  console.log('The snooze modal should appear automatically.');

  await client.end();
}

createTestItem();
