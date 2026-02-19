import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL!);

async function main() {
  // Add hawksoft_cloud_uuid column to customers
  await sql.unsafe(`ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "hawksoft_cloud_uuid" varchar(36)`);
  console.log('Added hawksoft_cloud_uuid column');

  // Create hawksoft_attachment_log table
  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS "hawksoft_attachment_log" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "tenant_id" uuid NOT NULL,
      "hawksoft_attachment_id" varchar(50) NOT NULL,
      "hawksoft_client_uuid" varchar(36) NOT NULL,
      "policy_number" varchar(50),
      "al3_type" integer,
      "effective_date" timestamp,
      "file_ext" varchar(10),
      "file_size" integer,
      "processed_at" timestamp,
      "batch_id" uuid,
      "status" varchar(20) DEFAULT 'downloaded' NOT NULL,
      "created_at" timestamp DEFAULT now() NOT NULL
    )
  `);
  console.log('Created hawksoft_attachment_log table');

  // Create indexes (IF NOT EXISTS)
  await sql.unsafe(`CREATE INDEX IF NOT EXISTS "hs_attachment_log_tenant_idx" ON "hawksoft_attachment_log" USING btree ("tenant_id")`);
  await sql.unsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "hs_attachment_log_dedup_idx" ON "hawksoft_attachment_log" USING btree ("tenant_id","hawksoft_attachment_id")`);
  await sql.unsafe(`CREATE INDEX IF NOT EXISTS "hs_attachment_log_policy_idx" ON "hawksoft_attachment_log" USING btree ("tenant_id","policy_number")`);
  console.log('Created indexes');

  // Add foreign keys (check if they exist first)
  try {
    await sql.unsafe(`ALTER TABLE "hawksoft_attachment_log" ADD CONSTRAINT "hawksoft_attachment_log_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action`);
  } catch (e: any) {
    if (!e.message.includes('already exists')) throw e;
  }
  try {
    await sql.unsafe(`ALTER TABLE "hawksoft_attachment_log" ADD CONSTRAINT "hawksoft_attachment_log_batch_id_renewal_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."renewal_batches"("id") ON DELETE set null ON UPDATE no action`);
  } catch (e: any) {
    if (!e.message.includes('already exists')) throw e;
  }
  console.log('Added foreign keys');

  console.log('Migration complete!');
  await sql.end();
}

main().catch(e => { console.error(e); process.exit(1); });
