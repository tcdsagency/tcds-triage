import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

async function run() {
  const { db } = await import('../src/db');
  const { sql } = await import('drizzle-orm');

  const statements = [
    `ALTER TABLE "policies" ADD COLUMN IF NOT EXISTS "agent1" varchar(50)`,
    `ALTER TABLE "policies" ADD COLUMN IF NOT EXISTS "agent2" varchar(50)`,
    `ALTER TABLE "policies" ADD COLUMN IF NOT EXISTS "agent3" varchar(50)`,
    `ALTER TABLE "policies" ADD COLUMN IF NOT EXISTS "producer_id" uuid REFERENCES "users"("id") ON DELETE SET NULL`,
    `CREATE INDEX IF NOT EXISTS "policies_producer_idx" ON "policies" ("tenant_id", "producer_id")`,
    `ALTER TABLE "renewal_comparisons" ADD COLUMN IF NOT EXISTS "assigned_agent_id" uuid REFERENCES "users"("id") ON DELETE SET NULL`,
    `CREATE INDEX IF NOT EXISTS "renewal_comparisons_assigned_agent_idx" ON "renewal_comparisons" ("tenant_id", "assigned_agent_id")`,
  ];

  console.log('Running migration 0011...\n');

  for (const stmt of statements) {
    const label = stmt.length > 80 ? stmt.substring(0, 80) + '...' : stmt;
    console.log(`  ${label}`);
    await db.execute(sql.raw(stmt));
    console.log('  -> OK');
  }

  console.log('\nMigration complete!');
  process.exit(0);
}

run().catch(err => { console.error('Migration failed:', err); process.exit(1); });
