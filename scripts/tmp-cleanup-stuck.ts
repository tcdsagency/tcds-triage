require('dotenv').config({ path: '.env.local' });
import { db } from '../src/db';
import { calls } from '../src/db/schema';
import { eq, and, lt } from 'drizzle-orm';

async function cleanup() {
  const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000);

  // Find stuck calls
  const stuckCalls = await db.select({
    id: calls.id,
    status: calls.status,
    transcriptionStatus: calls.transcriptionStatus,
    startedAt: calls.startedAt,
    fromNumber: calls.fromNumber,
    toNumber: calls.toNumber,
  })
  .from(calls)
  .where(
    and(
      eq(calls.transcriptionStatus, 'active'),
      lt(calls.startedAt, thirtyMinAgo)
    )
  );

  console.log(`Found ${stuckCalls.length} stuck calls with active transcription`);

  for (const c of stuckCalls) {
    const age = Math.round((Date.now() - new Date(c.startedAt!).getTime()) / 60000);
    console.log(`  ${c.id} | ${c.fromNumber} -> ${c.toNumber} | ${age}m old`);

    await db.update(calls)
      .set({
        transcriptionStatus: 'completed',
        status: 'completed'
      })
      .where(eq(calls.id, c.id));
    console.log(`    -> cleaned up`);
  }

  console.log('Done');
}

cleanup().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
