require('dotenv').config({ path: '.env.production.local' });

async function run() {
  const { db } = await import('../src/db');
  const { customers, calls } = await import('../src/db/schema');
  const { or, like, desc, eq } = await import('drizzle-orm');

  const phones = ['2565252134', '2052663492'];

  for (const phone of phones) {
    console.log('\n========================================');
    console.log('PHONE:', phone);
    console.log('========================================');

    // Check calls table
    const callResults = await db.select({
      id: calls.id,
      from: calls.fromNumber,
      to: calls.toNumber,
      started: calls.startedAt,
      status: calls.status,
      customerId: calls.customerId,
      azActivityId: calls.agencyzoomActivityId
    }).from(calls)
      .where(or(
        like(calls.fromNumber, '%' + phone + '%'),
        like(calls.toNumber, '%' + phone + '%')
      ))
      .orderBy(desc(calls.startedAt))
      .limit(3);

    if (callResults.length > 0) {
      console.log('\nCALLS FOUND:');
      for (const c of callResults) {
        console.log('  Call', c.id.slice(0, 8));
        console.log('    From:', c.from, '-> To:', c.to);
        console.log('    Started:', c.started);
        console.log('    Status:', c.status);
        console.log('    Customer Match:', c.customerId || 'NONE');
        console.log('    AZ Synced:', c.azActivityId ? 'YES' : 'NO');
      }
    } else {
      console.log('\nNO CALLS FOUND');
    }

    // Check customers table
    const custResults = await db.select({
      id: customers.id,
      name: customers.name,
      phone: customers.phone,
      azId: customers.agencyzoomId
    }).from(customers)
      .where(like(customers.phone, '%' + phone + '%'))
      .limit(3);

    if (custResults.length > 0) {
      console.log('\nCUSTOMER FOUND:');
      for (const c of custResults) {
        console.log('  ', c.name);
        console.log('    Phone:', c.phone);
        console.log('    AZ ID:', c.azId);
      }
    } else {
      console.log('\nCUSTOMER NOT FOUND - This is why call did not sync to AZ');
    }
  }
}

run().catch(e => console.error(e));
