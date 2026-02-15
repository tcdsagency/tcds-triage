import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env.production.local') });

async function main() {
  const { db } = await import('../src/db');
  const { sql } = await import('drizzle-orm');

  console.log('Running migration: 0010_add_check_results...');

  await db.execute(sql`
    ALTER TABLE "renewal_comparisons" ADD COLUMN IF NOT EXISTS "check_results" jsonb
  `);
  console.log('  Added check_results column');

  await db.execute(sql`
    ALTER TABLE "renewal_comparisons" ADD COLUMN IF NOT EXISTS "check_summary" jsonb
  `);
  console.log('  Added check_summary column');

  console.log('Migration complete!');
  process.exit(0);
}

main().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
