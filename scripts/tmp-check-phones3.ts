require('dotenv').config({ path: '.env.production.local' });

async function run() {
  const { db } = await import('../src/db');
  const { calls } = await import('../src/db/schema');
  const { or, like, desc, sql } = await import('drizzle-orm');
  const { Pool } = await import('pg');

  // Use raw pg for customer lookup
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

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
        console.log('    AZ Synced:', c.agencyzoomActivityId ? 'YES' : 'NO');
      }
    } else {
      console.log('\nNO CALLS FOUND in database');
    }

    // Check customers table with raw pg
    const custQuery = await pool.query(
      `SELECT id, first_name, last_name, phone, phone_alt, agencyzoom_id
       FROM customers
       WHERE phone LIKE $1 OR phone_alt LIKE $1
       LIMIT 5`,
      ['%' + phone + '%']
    );

    if (custQuery.rows.length > 0) {
      console.log('\nCUSTOMER FOUND:');
      for (const c of custQuery.rows) {
        console.log('  ', c.first_name, c.last_name);
        console.log('    Phone:', c.phone);
        console.log('    AZ ID:', c.agencyzoom_id);
      }
    } else {
      console.log('\n❌ CUSTOMER NOT FOUND in database');
      console.log('   -> Phone number not in customers table');
      console.log('   -> Cannot match call to a customer');
      console.log('   -> Cannot sync to AgencyZoom without customer match');
    }
  }

  await pool.end();
}

run().catch(e => console.error(e));
