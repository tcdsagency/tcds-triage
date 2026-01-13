import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { sql } from 'drizzle-orm';

const client = postgres(process.env.DATABASE_URL!);
const db = drizzle(client);

async function test() {
  const tenantId = '062c4693-96b2-4000-814b-04c2a334ebeb';

  // Query WITHOUT any after-hours filter (what the new code should do)
  const result = await db.execute(sql`
    SELECT id, direction, from_number, body, is_after_hours, created_at
    FROM messages
    WHERE tenant_id = ${tenantId}
    ORDER BY created_at DESC
    LIMIT 10
  `);

  console.log('Results WITHOUT after-hours filter (should show todays messages):');
  result.forEach((m: any) => {
    console.log(`  ${m.created_at} [${m.is_after_hours ? 'AH' : '  '}] ${m.from_number}: ${(m.body || '').substring(0, 30)}...`);
  });

  // Query WITH after-hours filter (what the OLD code was doing)
  const filtered = await db.execute(sql`
    SELECT id, direction, from_number, body, is_after_hours, created_at
    FROM messages
    WHERE tenant_id = ${tenantId}
      AND (is_after_hours = false OR is_after_hours IS NULL)
    ORDER BY created_at DESC
    LIMIT 10
  `);

  console.log('\nResults WITH after-hours filter (old behavior):');
  filtered.forEach((m: any) => {
    console.log(`  ${m.created_at} [${m.is_after_hours ? 'AH' : '  '}] ${m.from_number}: ${(m.body || '').substring(0, 30)}...`);
  });

  await client.end();
}
test();
