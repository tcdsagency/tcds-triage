require('dotenv').config({ path: '.env.local' });

async function main() {
  const { db } = await import('../src/db');
  const { calls, wrapupDrafts, serviceTickets, customers } = await import('../src/db/schema');
  const { eq, gte, desc, sql } = await import('drizzle-orm');

  // Get today's tickets
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const todayTickets = await db.select().from(serviceTickets)
    .where(gte(serviceTickets.createdAt, today))
    .orderBy(desc(serviceTickets.createdAt));

  console.log(`Total tickets created today: ${todayTickets.length}\n`);

  // Group by wrapupDraftId to find duplicates
  const byWrapup = new Map<string, typeof todayTickets>();
  for (const t of todayTickets) {
    const key = t.wrapupDraftId || 'no-wrapup';
    if (!byWrapup.has(key)) byWrapup.set(key, []);
    byWrapup.get(key)!.push(t);
  }

  // Show duplicates (same wrapupDraftId with multiple tickets)
  let dupCount = 0;
  for (const [wrapupId, tickets] of byWrapup) {
    if (tickets.length > 1) {
      dupCount++;
      console.log(`\n=== DUPLICATE: wrapup ${wrapupId.slice(0, 8)} has ${tickets.length} tickets ===`);
      for (const t of tickets) {
        const created = t.createdAt ? new Date(t.createdAt).toLocaleTimeString() : '?';
        console.log(`  AZ#${t.azTicketId} | ${t.source} | ${created} | ${t.subject?.slice(0, 70)}`);
      }
    }
  }

  // Also group by phone number (from call) to find cross-wrapup dups
  console.log('\n\n========================================');
  console.log('ALL TICKETS TODAY (chronological):');
  console.log('========================================\n');

  for (const t of todayTickets.reverse()) {
    const created = t.createdAt ? new Date(t.createdAt).toLocaleTimeString() : '?';

    // Get call info via wrapup
    let phone = '';
    let callTime = '';
    if (t.wrapupDraftId) {
      const [wrapup] = await db.select({ callId: wrapupDrafts.callId, customerPhone: wrapupDrafts.customerPhone })
        .from(wrapupDrafts).where(eq(wrapupDrafts.id, t.wrapupDraftId)).limit(1);
      if (wrapup?.callId) {
        const [call] = await db.select({ fromNumber: calls.fromNumber, toNumber: calls.toNumber, startedAt: calls.startedAt, direction: calls.direction })
          .from(calls).where(eq(calls.id, wrapup.callId)).limit(1);
        if (call) {
          phone = call.direction === 'inbound' ? call.fromNumber || '' : call.toNumber || '';
          callTime = call.startedAt ? new Date(call.startedAt).toLocaleTimeString() : '?';
        }
      }
      if (!phone && wrapup?.customerPhone) phone = wrapup.customerPhone;
    }

    console.log(`${created} | AZ#${t.azTicketId} | ${t.source?.padEnd(13)} | ${phone.padEnd(14)} | call@${callTime} | wrapup:${(t.wrapupDraftId || 'none').slice(0, 8)} | ${t.subject?.slice(0, 60)}`);
  }

  // Check for same phone within short time windows
  console.log('\n\n========================================');
  console.log('PHONE-BASED DUPLICATE CHECK:');
  console.log('========================================\n');

  const byPhone = new Map<string, typeof todayTickets>();
  for (const t of todayTickets) {
    if (t.wrapupDraftId) {
      const [wrapup] = await db.select({ customerPhone: wrapupDrafts.customerPhone })
        .from(wrapupDrafts).where(eq(wrapupDrafts.id, t.wrapupDraftId)).limit(1);
      const phone = (wrapup?.customerPhone || '').replace(/\D/g, '').slice(-10);
      if (phone.length >= 7) {
        if (!byPhone.has(phone)) byPhone.set(phone, []);
        byPhone.get(phone)!.push(t);
      }
    }
  }

  for (const [phone, tickets] of byPhone) {
    if (tickets.length > 1) {
      console.log(`\nPhone ${phone} — ${tickets.length} tickets:`);
      for (const t of tickets) {
        const created = t.createdAt ? new Date(t.createdAt).toLocaleTimeString() : '?';
        console.log(`  AZ#${t.azTicketId} | ${t.source} | ${created} | ${t.subject?.slice(0, 70)}`);
      }
    }
  }

  if (dupCount === 0) {
    console.log('\nNo wrapup-level duplicates found.');
  } else {
    console.log(`\n${dupCount} wrapup-level duplicate groups found.`);
  }

  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
