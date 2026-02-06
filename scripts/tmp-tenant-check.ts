require('dotenv').config({ path: '.env.production.local' });

async function run() {
  const { db } = await import('../src/db');
  const { customers, calls } = await import('../src/db/schema');
  const { like, desc } = await import('drizzle-orm');

  const phone = '2052663492';

  // Get call
  const [call] = await db.select({
    id: calls.id,
    tenantId: calls.tenantId,
    fromNumber: calls.fromNumber
  }).from(calls)
    .where(like(calls.fromNumber, '%' + phone + '%'))
    .orderBy(desc(calls.startedAt))
    .limit(1);

  // Get customer
  const [customer] = await db.select({
    id: customers.id,
    tenantId: customers.tenantId,
    firstName: customers.firstName,
    lastName: customers.lastName,
    phone: customers.phone,
    azId: customers.agencyzoomId,
  }).from(customers)
    .where(like(customers.phone, '%' + phone + '%'))
    .limit(1);

  console.log('=== TENANT CHECK ===');
  console.log('Call tenant:', call?.tenantId);
  console.log('Customer tenant:', customer?.tenantId);
  console.log('Same tenant:', call?.tenantId === customer?.tenantId);
  console.log();
  console.log('Call fromNumber:', call?.fromNumber);
  console.log('Customer phone:', customer?.phone);
  console.log('Customer name:', customer?.firstName, customer?.lastName);
  console.log('Customer AZ ID:', customer?.azId);
}

run().catch(e => console.error(e));
