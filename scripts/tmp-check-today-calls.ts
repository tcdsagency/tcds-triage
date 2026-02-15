require('dotenv').config({ path: '.env.production.local' });

async function run() {
  const { db } = await import('../src/db');
  const { calls, wrapupDrafts, customers } = await import('../src/db/schema');
  const { eq, gte, desc, and } = await import('drizzle-orm');

  // Get today's date at midnight
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  console.log('Checking calls from:', today.toISOString());
  console.log('========================================\n');

  const todaysCalls = await db.select().from(calls)
    .where(gte(calls.startedAt, today))
    .orderBy(desc(calls.startedAt));

  console.log('Total calls today:', todaysCalls.length);
  console.log('');

  let issues: string[] = [];

  for (const call of todaysCalls) {
    const time = new Date(call.startedAt!).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    const phone = call.direction === 'inbound' ? call.fromNumber : call.toNumber;

    console.log('----------------------------------------');
    console.log(`${time} | ${call.direction} | ${phone}`);
    console.log(`Call ID: ${call.id.slice(0, 8)}`);

    // Check customer match
    if (call.customerId) {
      const [customer] = await db.select({
        firstName: customers.firstName,
        lastName: customers.lastName,
        azId: customers.agencyzoomId,
      }).from(customers).where(eq(customers.id, call.customerId));

      if (customer) {
        console.log(`Customer: ${customer.firstName} ${customer.lastName} (AZ: ${customer.azId || 'NONE'})`);
        if (!customer.azId) {
          issues.push(`${time} ${phone} - Customer has no AZ ID`);
        }
      }
    } else {
      console.log('Customer: NOT MATCHED');
      issues.push(`${time} ${phone} - No customer match`);
    }

    // Check wrapup
    const [wrapup] = await db.select().from(wrapupDrafts).where(eq(wrapupDrafts.callId, call.id));

    if (wrapup) {
      console.log(`Wrapup: ${wrapup.status} | Match: ${wrapup.matchStatus}`);
      console.log(`Note Posted: ${wrapup.noteAutoPosted ? 'YES' : 'NO'} | Ticket: ${wrapup.agencyzoomTicketId || 'NONE'}`);

      if (wrapup.summary) {
        console.log(`Summary: ${wrapup.summary.substring(0, 100)}...`);
      }

      // Check for issues
      if (wrapup.status === 'completed' && !wrapup.noteAutoPosted && call.customerId) {
        issues.push(`${time} ${phone} - Wrapup completed but note not posted`);
      }
      if (wrapup.matchStatus === 'unmatched' && call.customerId) {
        issues.push(`${time} ${phone} - Has customerId but matchStatus is unmatched`);
      }
    } else {
      console.log('Wrapup: NONE');
    }
    console.log('');
  }

  console.log('========================================');
  console.log('SUMMARY');
  console.log('========================================');
  console.log('Total calls:', todaysCalls.length);
  console.log('With customer match:', todaysCalls.filter(c => c.customerId).length);
  console.log('Without customer match:', todaysCalls.filter(c => !c.customerId).length);

  if (issues.length > 0) {
    console.log('\n⚠️  ISSUES FOUND:');
    for (const issue of issues) {
      console.log('  -', issue);
    }
  } else {
    console.log('\n✅ No issues found');
  }
}

run().catch(e => console.error(e));
