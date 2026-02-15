require('dotenv').config({ path: '.env.production.local' });

async function run() {
  const { db } = await import('../src/db');
  const { calls, wrapupDrafts, customers } = await import('../src/db/schema');
  const { eq, like, desc } = await import('drizzle-orm');
  const { getAgencyZoomClient } = await import('../src/lib/api/agencyzoom');

  const azClient = getAgencyZoomClient();

  // Find Jeff Washburn's call by phone
  const phone = '2057479291';
  const callList = await db.select().from(calls)
    .where(like(calls.fromNumber, '%' + phone + '%'))
    .orderBy(desc(calls.startedAt));

  console.log('Found', callList.length, 'calls for', phone);

  for (const call of callList) {
    console.log('\n========================================');
    console.log('Call:', call.id);
    console.log('Started:', call.startedAt);
    console.log('Customer ID:', call.customerId);

    if (!call.customerId) {
      console.log('No customer ID - skipping');
      continue;
    }

    // Get the customer
    const [customer] = await db.select().from(customers).where(eq(customers.id, call.customerId));
    console.log('Customer:', customer.firstName, customer.lastName);
    console.log('AZ ID:', customer.agencyzoomId);

    // Get the wrapup
    const [wrapup] = await db.select().from(wrapupDrafts).where(eq(wrapupDrafts.callId, call.id));
    if (!wrapup) {
      console.log('No wrapup - skipping');
      continue;
    }

    console.log('\nWrapup:', wrapup.id);
    console.log('Status:', wrapup.status);
    console.log('Match Status:', wrapup.matchStatus);
    console.log('Note Posted:', wrapup.noteAutoPosted);
    console.log('Summary:', wrapup.summary?.substring(0, 100));

    // Fix matchStatus if needed
    if (wrapup.matchStatus !== 'matched') {
      await db.update(wrapupDrafts)
        .set({ matchStatus: 'matched' })
        .where(eq(wrapupDrafts.id, wrapup.id));
      console.log('\n✓ Updated matchStatus to matched');
    }

    // Post note to AZ if not already posted
    if (!wrapup.noteAutoPosted && wrapup.summary && customer.agencyzoomId) {
      const azCustomerId = parseInt(customer.agencyzoomId);
      const callTime = new Date(call.startedAt!);
      const formattedDate = callTime.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' });
      const formattedTime = callTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

      const noteText = `📞 ${call.direction === 'inbound' ? 'Inbound' : 'Outbound'} Call - ${formattedDate} ${formattedTime}\n\n${wrapup.summary}`;

      console.log('\nPosting note to AZ customer', azCustomerId);

      const result = await azClient.addNote(azCustomerId, noteText);
      console.log('Result:', JSON.stringify(result));

      if (result.success) {
        await db.update(wrapupDrafts)
          .set({
            noteAutoPosted: true,
            noteAutoPostedAt: new Date(),
          })
          .where(eq(wrapupDrafts.id, wrapup.id));
        console.log('✓ Updated wrapup noteAutoPosted to true');
      }
    } else if (wrapup.noteAutoPosted) {
      console.log('\nNote already posted');
    }
  }

  console.log('\n✅ Done!');
}

run().catch(e => console.error(e));
