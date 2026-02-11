CREATE TABLE IF NOT EXISTS "referral_sources" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id"),
  "name" varchar(200) NOT NULL,
  "contact_name" varchar(200),
  "email" varchar(200),
  "phone" varchar(20),
  "company" varchar(200),
  "type" varchar(50) NOT NULL DEFAULT 'other',
  "is_active" boolean NOT NULL DEFAULT true,
  "notes" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "referral_sources_tenant_idx" ON "referral_sources" ("tenant_id");
CREATE INDEX IF NOT EXISTS "referral_sources_name_idx" ON "referral_sources" ("tenant_id", "name");
