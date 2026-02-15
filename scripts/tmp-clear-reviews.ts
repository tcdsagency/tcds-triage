import { db } from "@/db";
import { reviewRequests } from "@/db/schema";
import { sql } from "drizzle-orm";

async function main() {
  // Count existing
  const rows = await db
    .select({ status: reviewRequests.status, cnt: sql<number>`count(*)::int` })
    .from(reviewRequests)
    .groupBy(reviewRequests.status);

  console.log("Current review requests:");
  let total = 0;
  for (const r of rows) {
    console.log(`  ${r.status}: ${r.cnt}`);
    total += r.cnt;
  }
  console.log(`  TOTAL: ${total}`);

  if (total === 0) {
    console.log("Nothing to delete.");
    process.exit(0);
  }

  // Delete all
  const deleted = await db.delete(reviewRequests).returning({ id: reviewRequests.id });
  console.log(`\nDeleted ${deleted.length} review requests.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
