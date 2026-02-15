import { db } from "@/db";
import { sql } from "drizzle-orm";

async function main() {
  console.log("Testing DB connection...");
  const result = await db.execute(sql`SELECT 1 as ok`);
  console.log("Connected:", result);
  process.exit(0);
}

main().catch(err => {
  console.error("DB connection failed:", err.message || err);
  process.exit(1);
});
