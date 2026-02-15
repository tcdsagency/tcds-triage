require('dotenv').config({ path: '.env.production.local' });

async function run() {
  const { db } = await import('../src/db');
  const { calls, customers, wrapupDrafts } = await import('../src/db/schema');
  const { eq, like, or, desc } = await import('drizzle-orm');
  const { getAgencyZoomClient } = await import('../src/lib/api/agencyzoom');

  const phonesToFix = [
    { phone: '2052663492', customerName: 'Dwight Bronson' },
    { phone: '2565252134', customerName: 'Robert Mishoe' },
  ];

  const azClient = getAgencyZoomClient();

  for (const { phone, customerName } of phonesToFix) {
    console.log(`\n========================================`);
    console.log(`Fixing calls for ${phone} (${customerName})`);
    console.log(`========================================`);

    // Find the customer
    const [customer] = await db.select({
      id: customers.id,
      firstName: customers.firstName,
      lastName: customers.lastName,
      azId: customers.agencyzoomId,
    }).from(customers)
      .where(like(customers.phone, '%' + phone + '%'))
      .limit(1);

    if (!customer) {
      console.log('❌ Customer not found!');
      continue;
    }

    console.log(`Found customer: ${customer.firstName} ${customer.lastName} (AZ: ${customer.azId})`);

    // Find calls for this phone
    const callsToFix = await db.select().from(calls)
      .where(or(
        like(calls.fromNumber, '%' + phone + '%'),
        like(calls.toNumber, '%' + phone + '%')
      ))
      .orderBy(desc(calls.startedAt));

    console.log(`Found ${callsToFix.length} calls to fix`);

    for (const call of callsToFix) {
      console.log(`\n--- Call ${call.id.slice(0, 8)} (${call.startedAt}) ---`);

      // Update call with customerId
      if (!call.customerId) {
        await db.update(calls)
          .set({ customerId: customer.id })
          .where(eq(calls.id, call.id));
        console.log(`✓ Updated call customerId to ${customer.id.slice(0, 8)}`);
      } else {
        console.log(`  Already has customerId: ${call.customerId.slice(0, 8)}`);
      }

      // Find wrapup for this call
      const [wrapup] = await db.select().from(wrapupDrafts)
        .where(eq(wrapupDrafts.callId, call.id));

      if (!wrapup) {
        console.log(`  No wrapup found for this call`);
        continue;
      }

      console.log(`  Wrapup: ${wrapup.id.slice(0, 8)} - status: ${wrapup.status}`);

      // Update wrapup matchStatus
      if (wrapup.matchStatus !== 'matched') {
        await db.update(wrapupDrafts)
          .set({ matchStatus: 'matched' })
          .where(eq(wrapupDrafts.id, wrapup.id));
        console.log(`  ✓ Updated wrapup matchStatus to 'matched'`);
      }

      // Post note to AgencyZoom if not already posted
      if (!wrapup.noteAutoPosted && wrapup.summary && customer.azId) {
        const azCustomerId = parseInt(customer.azId);
        const now = new Date();
        const formattedDate = now.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' });
        const formattedTime = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

        const noteText = `📞 ${call.direction === 'inbound' ? 'Inbound' : 'Outbound'} Call - ${formattedDate} ${formattedTime}\n\n${wrapup.summary}\n\n(Retroactively synced)`;

        console.log(`  Posting note to AZ customer ${azCustomerId}...`);

        try {
          const result = await azClient.addNote(azCustomerId, noteText);
          if (result.success) {
            await db.update(wrapupDrafts)
              .set({
                noteAutoPosted: true,
                noteAutoPostedAt: now,
                agencyzoomNoteId: result.id?.toString() || null,
                status: 'completed',
                completedAt: now,
              })
              .where(eq(wrapupDrafts.id, wrapup.id));
            console.log(`  ✅ Posted to AZ! Note ID: ${result.id}`);

            // Also update call with AZ activity ID
            await db.update(calls)
              .set({ agencyzoomActivityId: result.id?.toString() })
              .where(eq(calls.id, call.id));
          } else {
            console.log(`  ⚠️ AZ post failed:`, result);
          }
        } catch (err: any) {
          console.log(`  ❌ AZ post error:`, err.message);
        }
      } else if (wrapup.noteAutoPosted) {
        console.log(`  Already posted to AZ: ${wrapup.agencyzoomNoteId}`);
      } else if (!wrapup.summary) {
        console.log(`  No summary to post`);
      } else if (!customer.azId) {
        console.log(`  No AZ ID for customer`);
      }
    }
  }

  console.log('\n✅ Done!');
}

run().catch(e => console.error(e));
