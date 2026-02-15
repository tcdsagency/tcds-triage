import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

async function run() {
  const { db } = await import('../src/db');
  const { policies } = await import('../src/db/schema');
  const { sql } = await import('drizzle-orm');

  const home = await db.execute(sql`
    SELECT policy_number, carrier, coverages
    FROM policies
    WHERE line_of_business = 'HOME'
      AND coverages IS NOT NULL AND jsonb_array_length(coverages) > 0
    ORDER BY updated_at DESC LIMIT 1
  `);
  const rows = Array.isArray(home) ? home : (home as any).rows || [];
  for (const p of rows as any[]) {
    console.log(`\n=== Policy ${p.policy_number} (${p.carrier || 'unknown'}) ===`);
    for (const c of p.coverages) {
      const prem = c.premium != null ? `  $${c.premium}` : '';
      console.log(`  ${(c.type || '???').padEnd(45)} limit: ${(c.limit || '-').toString().padEnd(15)} ded: ${(c.deductible || '-').toString().padEnd(10)}${prem}`);
    }
    const empty = p.coverages.filter((c: any) => !c.type);
    console.log(`\n${empty.length} of ${p.coverages.length} still have empty type`);
  }

  process.exit(0);
}
run();
