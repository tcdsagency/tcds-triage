import { db } from '../src/db';
import { calls } from '../src/db/schema';
import { desc } from 'drizzle-orm';

async function check() {
  const recent = await db.select({
    startedAt: calls.startedAt,
    fromNumber: calls.fromNumber,
    toNumber: calls.toNumber,
    extension: calls.extension,
    direction: calls.direction,
    status: calls.status,
    externalCallId: calls.externalCallId,
  })
  .from(calls)
  .orderBy(desc(calls.startedAt))
  .limit(10);

  console.log('Most recent 10 calls in DB:');
  for (const c of recent) {
    const cst = c.startedAt ? new Date(c.startedAt).toLocaleString('en-US', { timeZone: 'America/Chicago' }) : 'N/A';
    const phone = c.direction === 'inbound' ? c.fromNumber : c.toNumber;
    console.log(cst + ' | ' + c.direction + ' | Phone: ' + phone + ' | Ext: ' + c.extension + ' | ' + c.status + ' | CallID: ' + c.externalCallId);
  }
}

check().then(() => process.exit(0)).catch(console.error);
