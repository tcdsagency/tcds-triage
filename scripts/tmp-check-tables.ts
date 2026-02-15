import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function main() {
  const { db } = await import('../src/db');
  const { sql } = await import('drizzle-orm');

  const result = await db.execute(sql`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name LIKE 'commission_%'
    ORDER BY table_name
  `);

  console.log('Commission tables in database:');
  if (result.length === 0) {
    console.log('  NONE - tables do not exist!');
  } else {
    for (const row of result) {
      console.log(' ', row.table_name);
    }
  }

  process.exit(0);
}

main();
