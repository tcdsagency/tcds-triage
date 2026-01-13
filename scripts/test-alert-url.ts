import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { sql } from 'drizzle-orm';

const client = postgres(process.env.DATABASE_URL!);
const db = drizzle(client);

async function test() {
  // Get a recent alert with policy info
  const alerts = await db.execute(sql`
    SELECT
      a.id,
      a.title,
      a.description,
      p.az_contact_id,
      p.contact_name,
      p.address_line1,
      p.city
    FROM risk_monitor_alerts a
    JOIN risk_monitor_policies p ON a.policy_id = p.id
    ORDER BY a.created_at DESC
    LIMIT 3
  `);

  console.log('Recent alerts:');
  for (const alert of alerts) {
    console.log('\n---');
    console.log('Title:', alert.title);
    console.log('Customer:', alert.contact_name);
    console.log('Address:', alert.address_line1, alert.city);
    console.log('AZ Contact ID:', alert.az_contact_id);

    if (alert.az_contact_id) {
      const oldUrl = `https://tcds-triage.vercel.app/customers/${alert.az_contact_id}`;
      const newUrl = `https://tcds-triage.vercel.app/customers/${alert.az_contact_id}?azId=${alert.az_contact_id}`;
      console.log('Old URL (broken):', oldUrl);
      console.log('New URL (fixed):', newUrl);
    }
  }

  await client.end();
}
test();
