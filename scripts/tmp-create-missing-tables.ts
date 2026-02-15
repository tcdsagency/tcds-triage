import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function main() {
  const { db } = await import('../src/db');
  const { sql } = await import('drizzle-orm');

  console.log('=== Step 1: Fix enum naming conflict ===');

  // The old enum 'commission_month_close_status' conflicts with the table name.
  // We need to:
  // 1. Drop the old enum (nothing uses it since the table doesn't exist yet)
  // 2. Create the new enum 'commission_month_close_status_type'
  // 3. Create the table 'commission_month_close_status' using the new enum

  const oldEnumExists = await db.execute(sql`
    SELECT typname FROM pg_type WHERE typname = 'commission_month_close_status' AND typtype = 'e'
  `);

  if (oldEnumExists.length > 0) {
    console.log('Dropping old enum commission_month_close_status...');
    await db.execute(sql`DROP TYPE "public"."commission_month_close_status"`);
    console.log('Old enum dropped.');
  }

  const newEnumExists = await db.execute(sql`
    SELECT typname FROM pg_type WHERE typname = 'commission_month_close_status_type'
  `);

  if (newEnumExists.length === 0) {
    console.log('Creating commission_month_close_status_type enum...');
    await db.execute(sql`
      CREATE TYPE "public"."commission_month_close_status_type" AS ENUM('open', 'in_review', 'locked')
    `);
    console.log('New enum created.');
  } else {
    console.log('New enum already exists.');
  }

  console.log('\n=== Step 2: Create missing tables ===');

  const existing = await db.execute(sql`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name LIKE 'commission_%'
    ORDER BY table_name
  `);
  const existingNames = existing.map((r: any) => r.table_name);

  // Create commission_month_close_status
  if (!existingNames.includes('commission_month_close_status')) {
    console.log('Creating commission_month_close_status...');
    await db.execute(sql`
      CREATE TABLE "commission_month_close_status" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "tenant_id" uuid NOT NULL,
        "reporting_month" varchar(7) NOT NULL,
        "status" "commission_month_close_status_type" DEFAULT 'open' NOT NULL,
        "locked_by_user_id" uuid,
        "locked_at" timestamp,
        "unlocked_by_user_id" uuid,
        "unlocked_at" timestamp,
        "validation_results" jsonb,
        "notes" text,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
      )
    `);
    await db.execute(sql`ALTER TABLE "commission_month_close_status" ADD CONSTRAINT "commission_month_close_status_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action`);
    await db.execute(sql`ALTER TABLE "commission_month_close_status" ADD CONSTRAINT "commission_month_close_status_locked_by_user_id_users_id_fk" FOREIGN KEY ("locked_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action`);
    await db.execute(sql`ALTER TABLE "commission_month_close_status" ADD CONSTRAINT "commission_month_close_status_unlocked_by_user_id_users_id_fk" FOREIGN KEY ("unlocked_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action`);
    await db.execute(sql`CREATE INDEX "commission_month_close_tenant_idx" ON "commission_month_close_status" USING btree ("tenant_id")`);
    await db.execute(sql`CREATE UNIQUE INDEX "commission_month_close_unique" ON "commission_month_close_status" USING btree ("tenant_id","reporting_month")`);
    console.log('  Done.');
  }

  // Create commission_policies
  if (!existingNames.includes('commission_policies')) {
    console.log('Creating commission_policies...');
    await db.execute(sql`
      CREATE TABLE "commission_policies" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "tenant_id" uuid NOT NULL,
        "policy_number" text NOT NULL,
        "carrier_id" uuid,
        "carrier_name" text,
        "insured_name" text,
        "line_of_business" text,
        "effective_date" date,
        "expiration_date" date,
        "premium" numeric(12, 2),
        "primary_agent_id" uuid,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
      )
    `);
    await db.execute(sql`ALTER TABLE "commission_policies" ADD CONSTRAINT "commission_policies_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action`);
    await db.execute(sql`ALTER TABLE "commission_policies" ADD CONSTRAINT "commission_policies_carrier_id_commission_carriers_id_fk" FOREIGN KEY ("carrier_id") REFERENCES "public"."commission_carriers"("id") ON DELETE set null ON UPDATE no action`);
    await db.execute(sql`ALTER TABLE "commission_policies" ADD CONSTRAINT "commission_policies_primary_agent_id_commission_agents_id_fk" FOREIGN KEY ("primary_agent_id") REFERENCES "public"."commission_agents"("id") ON DELETE set null ON UPDATE no action`);
    await db.execute(sql`CREATE INDEX "commission_policies_tenant_idx" ON "commission_policies" USING btree ("tenant_id")`);
    await db.execute(sql`CREATE UNIQUE INDEX "commission_policies_unique" ON "commission_policies" USING btree ("tenant_id","policy_number","carrier_id")`);
    await db.execute(sql`CREATE INDEX "commission_policies_carrier_idx" ON "commission_policies" USING btree ("carrier_id")`);
    await db.execute(sql`CREATE INDEX "commission_policies_agent_idx" ON "commission_policies" USING btree ("primary_agent_id")`);
    console.log('  Done.');
  }

  // Create commission_transactions
  if (!existingNames.includes('commission_transactions')) {
    console.log('Creating commission_transactions...');
    await db.execute(sql`
      CREATE TABLE "commission_transactions" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "tenant_id" uuid NOT NULL,
        "policy_id" uuid,
        "carrier_id" uuid,
        "import_batch_id" uuid,
        "policy_number" text NOT NULL,
        "carrier_name" text,
        "insured_name" text,
        "transaction_type" "commission_transaction_type" DEFAULT 'other',
        "line_of_business" text,
        "effective_date" date,
        "statement_date" date,
        "agent_paid_date" date,
        "gross_premium" numeric(12, 2),
        "commission_rate" numeric(5, 4),
        "commission_amount" numeric(12, 2) NOT NULL,
        "reporting_month" varchar(7),
        "dedupe_hash" varchar(64),
        "notes" text,
        "is_manual_entry" boolean DEFAULT false NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
      )
    `);
    await db.execute(sql`ALTER TABLE "commission_transactions" ADD CONSTRAINT "commission_transactions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action`);
    await db.execute(sql`ALTER TABLE "commission_transactions" ADD CONSTRAINT "commission_transactions_policy_id_commission_policies_id_fk" FOREIGN KEY ("policy_id") REFERENCES "public"."commission_policies"("id") ON DELETE set null ON UPDATE no action`);
    await db.execute(sql`ALTER TABLE "commission_transactions" ADD CONSTRAINT "commission_transactions_carrier_id_commission_carriers_id_fk" FOREIGN KEY ("carrier_id") REFERENCES "public"."commission_carriers"("id") ON DELETE set null ON UPDATE no action`);
    await db.execute(sql`ALTER TABLE "commission_transactions" ADD CONSTRAINT "commission_transactions_import_batch_id_commission_import_batches_id_fk" FOREIGN KEY ("import_batch_id") REFERENCES "public"."commission_import_batches"("id") ON DELETE set null ON UPDATE no action`);
    await db.execute(sql`CREATE INDEX "commission_transactions_tenant_idx" ON "commission_transactions" USING btree ("tenant_id")`);
    await db.execute(sql`CREATE INDEX "commission_transactions_policy_idx" ON "commission_transactions" USING btree ("policy_id")`);
    await db.execute(sql`CREATE INDEX "commission_transactions_carrier_idx" ON "commission_transactions" USING btree ("carrier_id")`);
    await db.execute(sql`CREATE INDEX "commission_transactions_month_idx" ON "commission_transactions" USING btree ("tenant_id","reporting_month")`);
    await db.execute(sql`CREATE INDEX "commission_transactions_batch_idx" ON "commission_transactions" USING btree ("import_batch_id")`);
    await db.execute(sql`CREATE UNIQUE INDEX "commission_transactions_dedupe_idx" ON "commission_transactions" USING btree ("tenant_id","dedupe_hash")`);
    console.log('  Done.');
  }

  // Verify
  console.log('\n=== Final verification ===');
  const final = await db.execute(sql`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name LIKE 'commission_%'
    ORDER BY table_name
  `);
  console.log('Commission tables:', final.map((r: any) => r.table_name));
  console.log('Total:', final.length, 'tables (expected 18)');

  process.exit(0);
}

main();
