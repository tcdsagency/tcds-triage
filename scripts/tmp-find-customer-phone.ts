require('dotenv').config({ path: '.env.production.local' });

async function run() {
  const { db } = await import('../src/db');
  const { customers } = await import('../src/db/schema');
  const { or, like, ilike } = await import('drizzle-orm');

  const phone = '2565252134';
  const phoneFormatted = '256-525-2134';

  const results = await db.select({
    id: customers.id,
    name: customers.name,
    phone: customers.phone,
    mobilePhone: customers.mobilePhone,
    workPhone: customers.workPhone,
    azId: customers.agencyzoomId,
    hsId: customers.hawksoftClientCode
  }).from(customers)
    .where(or(
      like(customers.phone, '%' + phone + '%'),
      like(customers.mobilePhone, '%' + phone + '%'),
      like(customers.workPhone, '%' + phone + '%'),
      like(customers.phone, '%' + phoneFormatted + '%'),
      like(customers.mobilePhone, '%' + phoneFormatted + '%')
    ))
    .limit(10);

  if (results.length === 0) {
    console.log('No customer found with phone', phone);
    console.log('\nThis is why the call did not sync to AgencyZoom:');
    console.log('- The phone number is not in the customers table');
    console.log('- System cannot match the call to a customer');
    console.log('- Without a customer match, no AZ activity can be created');
  } else {
    console.log('Found customers:');
    for (const c of results) {
      console.log('  ', c.name);
      console.log('    Phone:', c.phone);
      console.log('    Mobile:', c.mobilePhone);
      console.log('    AZ ID:', c.azId);
      console.log('    HS ID:', c.hsId);
    }
  }
}

run().catch(e => console.error(e));
