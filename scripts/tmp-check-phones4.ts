require('dotenv').config({ path: '.env.production.local' });

async function run() {
  const { db } = await import('../src/db');
  const { calls, customers } = await import('../src/db/schema');
  const { or, like, desc } = await import('drizzle-orm');

  const phones = ['2565252134', '2052663492'];

  for (const phone of phones) {
    console.log('\n========================================');
    console.log('PHONE:', phone);
    console.log('========================================');

    // Check calls table
    const callResults = await db.select().from(calls)
      .where(or(
        like(calls.fromNumber, '%' + phone + '%'),
        like(calls.toNumber, '%' + phone + '%')
      ))
      .orderBy(desc(calls.startedAt))
      .limit(3);

    if (callResults.length > 0) {
      console.log('\nCALLS:');
      for (const c of callResults) {
        console.log('  Call', c.id.slice(0, 8));
        console.log('    From:', c.fromNumber, '-> To:', c.toNumber);
        console.log('    Time:', c.startedAt);
        console.log('    Status:', c.status);
        console.log('    Customer Match:', c.customerId || 'NONE');
        console.log('    AZ Synced:', c.agencyzoomActivityId ? 'YES' : 'NO');
      }
    } else {
      console.log('\nNO CALLS FOUND');
    }

    // Check customers table
    const custResults = await db.select({
      id: customers.id,
      firstName: customers.firstName,
      lastName: customers.lastName,
      phone: customers.phone,
      phoneAlt: customers.phoneAlt,
      azId: customers.agencyzoomId
    }).from(customers)
      .where(or(
        like(customers.phone, '%' + phone + '%'),
        like(customers.phoneAlt, '%' + phone + '%')
      ))
      .limit(5);

    if (custResults.length > 0) {
      console.log('\nCUSTOMER:');
      for (const c of custResults) {
        console.log('  ', c.firstName, c.lastName);
        console.log('    Phone:', c.phone);
        console.log('    AZ ID:', c.azId);
      }
    } else {
      console.log('\n❌ CUSTOMER NOT FOUND');
      console.log('   Phone not in customers table');
      console.log('   Cannot sync to AgencyZoom');
    }
  }
}

run().catch(e => console.error(e));
