require('dotenv').config({ path: '.env.production.local' });

async function run() {
  const { db } = await import('../src/db');
  const { customers } = await import('../src/db/schema');
  const { like, or } = await import('drizzle-orm');
  const { getAgencyZoomClient } = await import('../src/lib/api/agencyzoom');

  const azClient = getAgencyZoomClient();

  // Find customers by phone
  const phones = ['2052663492', '2565252134'];

  for (const phone of phones) {
    console.log('\n========================================');
    console.log('Phone:', phone);

    const matches = await db.select().from(customers).where(
      or(
        like(customers.phone, '%' + phone + '%'),
        like(customers.phoneAlt, '%' + phone + '%')
      )
    );

    console.log('Customers found:', matches.length);
    for (const c of matches) {
      console.log('  -', c.firstName, c.lastName, '| ID:', c.id.slice(0,8), '| AZ:', c.agencyzoomId);

      if (c.agencyzoomId) {
        const activities = await azClient.getCustomerActivities(parseInt(c.agencyzoomId));
        console.log('  Recent activities:', activities.length);
        for (const act of activities.slice(0, 5)) {
          const notePreview = act.noteText ? act.noteText.substring(0, 60) : '';
          console.log('    -', act.activityId, '|', act.typeDescription, '|', act.updatedOn);
          if (notePreview) console.log('      ', notePreview);
        }
      }
    }
  }
}

run().catch(e => console.error(e));
