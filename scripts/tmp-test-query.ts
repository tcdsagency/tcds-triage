require('dotenv').config({ path: '.env.production.local' });

async function run() {
  const { db } = await import('../src/db');
  const { customers } = await import('../src/db/schema');
  const { and, eq, sql } = await import('drizzle-orm');

  const phoneForLookup = '2052663492';
  const tenantId = '062c4693-96b2-4000-814b-04c2a334ebeb';
  const phoneDigits = phoneForLookup.replace(/\D/g, '').slice(-10);

  console.log('Testing with:');
  console.log('  phoneForLookup:', phoneForLookup);
  console.log('  phoneDigits:', phoneDigits);
  console.log('  tenantId:', tenantId);

  // Exact query from call-completed webhook
  const localMatches = await db
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

  console.log('\n=== QUERY RESULTS ===');
  console.log('Matches found:', localMatches.length);

  for (const m of localMatches) {
    console.log('  -', m.firstName, m.lastName);
    console.log('    Phone:', m.phone);
    console.log('    AZ ID:', m.agencyzoomId);
  }

  if (localMatches.length === 1 && localMatches[0].agencyzoomId) {
    console.log('\n✅ Would match:', localMatches[0].firstName, localMatches[0].lastName);
  } else if (localMatches.length > 1) {
    console.log('\n⚠️ Multiple matches - would set status to multiple_matches');
  } else if (localMatches.length === 0) {
    console.log('\n❌ No matches found');
  } else if (!localMatches[0]?.agencyzoomId) {
    console.log('\n❌ Match found but no AZ ID');
  }
}

run().catch(e => console.error(e));
