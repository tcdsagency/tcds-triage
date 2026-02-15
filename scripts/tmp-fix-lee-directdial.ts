import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

async function run() {
  const { db } = await import('../src/db');
  const { users } = await import('../src/db/schema');
  const { eq } = await import('drizzle-orm');

  // Update Lee Tidwell's directDial to his outbound DID
  const [updated] = await db
    .update(users)
    .set({ directDial: '2058475616' })
    .where(eq(users.id, '6227a527-3b51-4f93-8d93-ce5139c1ef81'))
    .returning({ firstName: users.firstName, lastName: users.lastName, directDial: users.directDial });

  console.log('Updated:', updated.firstName, updated.lastName, '| directDial:', updated.directDial);
  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
