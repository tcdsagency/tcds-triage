require('dotenv').config({ path: '.env.production.local' });

async function run() {
  const { db } = await import('../src/db');
  const { customers, calls } = await import('../src/db/schema');
  const { like, desc } = await import('drizzle-orm');

  // Check phone format - call vs customer
  const phone = '2052663492';

  // Get call
  const [call] = await db.select({
    fromNumber: calls.fromNumber
  }).from(calls)
    .where(like(calls.fromNumber, '%' + phone + '%'))
    .orderBy(desc(calls.startedAt))
    .limit(1);

  // Get customer
  const [customer] = await db.select({
    firstName: customers.firstName,
    lastName: customers.lastName,
    phone: customers.phone,
    azId: customers.agencyzoomId,
  }).from(customers)
    .where(like(customers.phone, '%' + phone + '%'))
    .limit(1);

  console.log('=== PHONE FORMAT COMPARISON ===');
  console.log('Call fromNumber:', JSON.stringify(call?.fromNumber));
  console.log('Customer phone:', JSON.stringify(customer?.phone));
  console.log('Customer name:', customer?.firstName, customer?.lastName);
  console.log('Customer AZ ID:', customer?.azId);

  // Check if normalizing would match
  const callNorm = call?.fromNumber?.replace(/\D/g, '').slice(-10);
  const custNorm = customer?.phone?.replace(/\D/g, '').slice(-10);
  console.log('\nNormalized call:', callNorm);
  console.log('Normalized cust:', custNorm);
  console.log('Would match:', callNorm === custNorm);
}

run().catch(e => console.error(e));
