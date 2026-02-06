require('dotenv').config({ path: '.env.production.local' });

async function run() {
  const { db } = await import('../src/db');
  const { customers } = await import('../src/db/schema');
  const { like, or, and, eq, sql } = await import('drizzle-orm');

  const phone = '2052663492';
  const tenantId = '062c4693-96b2-4000-814b-04c2a334ebeb';

  // Check ALL customers with this phone
  const allMatches = await db.select({
    id: customers.id,
    firstName: customers.firstName,
    lastName: customers.lastName,
    phone: customers.phone,
    phoneAlt: customers.phoneAlt,
    azId: customers.agencyzoomId,
    tenantId: customers.tenantId,
  }).from(customers)
    .where(or(
      like(customers.phone, '%' + phone + '%'),
      like(customers.phoneAlt, '%' + phone + '%')
    ));

  console.log('=== ALL MATCHES (any tenant) ===');
  console.log('Count:', allMatches.length);
  for (const r of allMatches) {
    console.log(`  ${r.firstName} ${r.lastName} - phone: ${r.phone}, az: ${r.azId}, tenant: ${r.tenantId?.slice(0,8)}`);
  }

  // Now check with tenant filter (like the webhook does)
  const phoneDigits = phone.replace(/\D/g, '').slice(-10);
  const tenantMatches = await db
    .select({
      id: customers.id,
      agencyzoomId: customers.agencyzoomId,
      firstName: customers.firstName,
      lastName: customers.lastName,
      phone: customers.phone,
    })
    .from(customers)
    .where(
      and(
        eq(customers.tenantId, tenantId),
        sql`REPLACE(REPLACE(REPLACE(REPLACE(${customers.phone}, '(', ''), ')', ''), '-', ''), ' ', '') LIKE ${'%' + phoneDigits}`
      )
    )
    .limit(5);

  console.log('\n=== TENANT-FILTERED MATCHES ===');
  console.log('Count:', tenantMatches.length);
  for (const r of tenantMatches) {
    console.log(`  ${r.firstName} ${r.lastName} - phone: ${r.phone}, az: ${r.agencyzoomId}`);
  }

  // What would the webhook do?
  if (tenantMatches.length === 1 && tenantMatches[0].agencyzoomId) {
    console.log('\n✅ Webhook would MATCH:', tenantMatches[0].firstName, tenantMatches[0].lastName);
  } else if (tenantMatches.length > 1) {
    console.log('\n⚠️ Webhook would set MULTIPLE_MATCHES');
  } else {
    console.log('\n❌ Webhook would be UNMATCHED');
  }
}

run().catch(e => console.error(e));
