import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

async function run() {
  const { db } = await import('../src/db');
  const { sql } = await import('drizzle-orm');

  const r = (q: any) => (Array.isArray(q) ? q : q.rows)[0];

  const total = r(await db.execute(sql`SELECT count(*)::int as cnt FROM policies`));
  const withCovs = r(await db.execute(sql`SELECT count(*)::int as cnt FROM policies WHERE coverages IS NOT NULL AND jsonb_array_length(coverages) > 0`));
  const noCovs = r(await db.execute(sql`SELECT count(*)::int as cnt FROM policies WHERE coverages IS NULL OR jsonb_array_length(COALESCE(coverages,'[]'::jsonb)) = 0`));
  const vehs = r(await db.execute(sql`SELECT count(*)::int as cnt FROM vehicles`));
  const drvs = r(await db.execute(sql`SELECT count(*)::int as cnt FROM drivers`));

  console.log(`Total policies:      ${total.cnt}`);
  console.log(`With coverages:      ${withCovs.cnt}`);
  console.log(`Without coverages:   ${noCovs.cnt}`);
  console.log(`Total vehicles:      ${vehs.cnt}`);
  console.log(`Total drivers:       ${drvs.cnt}`);

  process.exit(0);
}
run();
