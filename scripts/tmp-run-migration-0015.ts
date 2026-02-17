import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

async function main() {
  const { db } = await import('../src/db');
  const { sql } = await import('drizzle-orm');

  console.log('Running migration: 0015 - AZ gated renewals...');

  await db.execute(sql`
    ALTER TYPE "public"."renewal_candidate_status" ADD VALUE IF NOT EXISTS 'awaiting_az_ticket' BEFORE 'pending'
  `);
  console.log('  ✓ Added awaiting_az_ticket enum value');

  await db.execute(sql`
    ALTER TABLE "renewal_candidates" ADD COLUMN IF NOT EXISTS "agencyzoom_sr_id" integer
  `);
  console.log('  ✓ Added agencyzoom_sr_id column to renewal_candidates');

  console.log('Migration complete!');
  process.exit(0);
}

main().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
