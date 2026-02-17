import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env.production.local') });

async function main() {
  const { db } = await import('../src/db');
  const { sql } = await import('drizzle-orm');

  const rows = await db.execute(sql`
    SELECT status, count(*) as cnt, carrier_name
    FROM renewal_comparisons
    WHERE carrier_name ILIKE '%National General%'
       OR carrier_name ILIKE '%Integon%'
       OR carrier_name ILIKE '%Imperial Fire%'
    GROUP BY status, carrier_name
    ORDER BY carrier_name, status
  `);
  console.log('NatGen comparisons by status/carrier:');
  for (const r of rows) {
    console.log(`  ${r.carrier_name} | ${r.status} | ${r.cnt}`);
  }
}
main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
