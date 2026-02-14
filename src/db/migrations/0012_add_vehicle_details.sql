ALTER TABLE "vehicles" ADD COLUMN IF NOT EXISTS "cost_new" integer;
ALTER TABLE "vehicles" ADD COLUMN IF NOT EXISTS "estimated_value" integer;
ALTER TABLE "vehicles" ADD COLUMN IF NOT EXISTS "primary_driver" varchar(100);
ALTER TABLE "vehicles" ADD COLUMN IF NOT EXISTS "lienholder" varchar(200);
