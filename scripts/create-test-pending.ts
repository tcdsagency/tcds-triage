import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { sql } from 'drizzle-orm';

const client = postgres(process.env.DATABASE_URL as string);
const db = drizzle(client);

async function createTestItem() {
  // Create a test message that's 2 minutes old (will trigger alert at 90 seconds)
  const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
  const tenantId = '062c4693-96b2-4000-814b-04c2a334ebeb';

  const result = await db.execute(sql`
    INSERT INTO messages (
      id,
      tenant_id,
      type,
      direction,
      from_number,
      to_number,
      body,
      contact_name,
      is_acknowledged,
      is_after_hours,
      created_at
    ) VALUES (
      gen_random_uuid(),
      ${tenantId}::uuid,
      'sms',
      'inbound',
      '+15551234567',
      '+15559876543',
      'TEST MESSAGE - Delete Me. This is a test message to trigger the pending review alert.',
      'TEST - Delete Me',
      false,
      false,
      ${twoMinutesAgo.toISOString()}::timestamp
    )
    RETURNING id, contact_name, created_at
  `);

  console.log('Created test pending message:');
  console.log(result[0]);
  console.log('\nRefresh the Pending Review page - the alert should trigger within 60 seconds.');
  console.log('The snooze modal should appear automatically.');

  await client.end();
}

createTestItem();
