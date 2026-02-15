import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env.production.local') });

async function main() {
  const { db } = await import('../src/db');
  const { sql } = await import('drizzle-orm');

  console.log('Running check_results migration...');
  await db.execute(sql`ALTER TABLE "renewal_comparisons" ADD COLUMN IF NOT EXISTS "check_results" jsonb`);
  await db.execute(sql`ALTER TABLE "renewal_comparisons" ADD COLUMN IF NOT EXISTS "check_summary" jsonb`);
  console.log('Done — check_results and check_summary columns added.');
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
