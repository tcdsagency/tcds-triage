import { db } from "../src/db";
import { sql } from "drizzle-orm";

async function reset() {
  const result = await db.execute(sql`
    UPDATE review_requests
    SET status = 'pending_approval', error_message = NULL, updated_at = now()
    WHERE id IN (
      'fecbb143-d424-47ec-b488-f1674fb08ec2',
      '4c65a7b4-64bb-49d4-9f52-a507ae67eee3',
      '4fe24e7f-f246-4c74-a428-5b8a4dd2b634'
    )
  `);
  console.log("Updated rows:", result);

  const check = await db.execute(sql`
    SELECT id, customer_name, status, error_message
    FROM review_requests
    WHERE id IN (
      'fecbb143-d424-47ec-b488-f1674fb08ec2',
      '4c65a7b4-64bb-49d4-9f52-a507ae67eee3',
      '4fe24e7f-f246-4c74-a428-5b8a4dd2b634'
    )
  `);
  console.log("Verified:");
  for (const r of check as any[]) {
    console.log(`  ${r.customer_name}: status=${r.status}, error=${r.error_message}`);
  }

  process.exit(0);
}

reset().catch((e) => {
  console.error(e);
  process.exit(1);
});
