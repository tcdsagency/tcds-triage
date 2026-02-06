require('dotenv').config({ path: '.env.production.local' });

async function run() {
  const { db } = await import('../src/db');
  const { customers, calls } = await import('../src/db/schema');
  const { or, like, desc, sql } = await import('drizzle-orm');

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
      console.log('\nCALLS FOUND:');
      for (const c of callResults) {
        console.log('  Call', c.id.slice(0, 8));
        console.log('    From:', c.fromNumber, '-> To:', c.toNumber);
        console.log('    Started:', c.startedAt);
        console.log('    Status:', c.status);
        console.log('    Customer Match:', c.customerId || 'NONE');
        console.log('    AZ Synced:', c.agencyzoomActivityId ? 'YES (' + c.agencyzoomActivityId + ')' : 'NO');
      }
    } else {
      console.log('\nNO CALLS FOUND');
    }

    // Check customers table - use raw SQL to avoid column issues
    const custResults = await db.execute(
      sql`SELECT id, first_name, last_name, phone, phone_alt, agencyzoom_id
          FROM customers
          WHERE phone LIKE ${'%' + phone + '%'}
             OR phone_alt LIKE ${'%' + phone + '%'}
          LIMIT 5`
    );

    if (custResults.rows.length > 0) {
      console.log('\nCUSTOMER FOUND:');
      for (const c of custResults.rows as any[]) {
        console.log('  ', c.first_name, c.last_name);
        console.log('    Phone:', c.phone);
        console.log('    Phone Alt:', c.phone_alt);
        console.log('    AZ ID:', c.agencyzoom_id);
      }
    } else {
      console.log('\n❌ CUSTOMER NOT FOUND');
      console.log('   -> This is why the call did not sync to AgencyZoom');
      console.log('   -> The phone number is not in our customers table');
    }
  }
}

run().catch(e => console.error(e));
