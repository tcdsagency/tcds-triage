import { db } from '../src/db';
import { wrapupDrafts, calls } from '../src/db/schema';
import { desc } from 'drizzle-orm';

async function check() {
  const wrapups = await db
    .select({
      id: wrapupDrafts.id,
      status: wrapupDrafts.status,
      matchStatus: wrapupDrafts.matchStatus,
      customerPhone: wrapupDrafts.customerPhone,
      isAutoVoided: wrapupDrafts.isAutoVoided,
      createdAt: wrapupDrafts.createdAt,
    })
    .from(wrapupDrafts)
    .orderBy(desc(wrapupDrafts.createdAt))
    .limit(5);

  console.log('Recent Wrapups:');
  console.log(JSON.stringify(wrapups, null, 2));

  const recentCalls = await db
    .select({
      id: calls.id,
      status: calls.status,
      transcriptionStatus: calls.transcriptionStatus,
      fromNumber: calls.fromNumber,
      durationSeconds: calls.durationSeconds,
      startedAt: calls.startedAt,
    })
    .from(calls)
    .orderBy(desc(calls.startedAt))
    .limit(5);

  console.log('\nRecent Calls:');
  console.log(JSON.stringify(recentCalls, null, 2));

  process.exit(0);
}
check();
