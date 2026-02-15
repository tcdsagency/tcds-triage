import { db } from "@/db";
import { sql } from "drizzle-orm";

async function main() {
  console.log("Running migration 0008: Add payment_screenshot_url column...");
  await db.execute(
    sql`ALTER TABLE mortgagee_payment_checks ADD COLUMN IF NOT EXISTS payment_screenshot_url text`
  );
  console.log("Migration applied successfully.");
  process.exit(0);
}

main().catch((e) => {
  console.error("Migration failed:", e);
  process.exit(1);
});
