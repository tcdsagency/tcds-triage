import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env.production.local') });

async function run() {
  const { db } = await import('../src/db');
  const { calls, wrapupDrafts, customers } = await import('../src/db/schema');
  const { eq, gte, desc, and, or, sql, ilike } = await import('drizzle-orm');

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const TENANT_ID = process.env.DEFAULT_TENANT_ID!;

  // Get today's unmatched calls that SHOULD have matched
  const problemPhones = ['4802060514', '2054541123', '2565952468', '2059993840', '2054139685'];

  console.log('=== DEBUGGING PHONE MATCHING ===\n');
  console.log('Tenant ID:', TENANT_ID);

  for (const digits of problemPhones) {
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`Phone: ${digits}`);

    // 1. Simulate the exact webhook query
    console.log('\n  Webhook query (REPLACE + LIKE):');
    try {
      const matches = await db
        .select({
          id: customers.id,
          firstName: customers.firstName,
          lastName: customers.lastName,
          phone: customers.phone,
          phoneAlt: customers.phoneAlt,
          tenantId: customers.tenantId,
          azId: customers.agencyzoomId,
        })
        .from(customers)
        .where(
          and(
            eq(customers.tenantId, TENANT_ID),
            sql`REPLACE(REPLACE(REPLACE(REPLACE(${customers.phone}, '(', ''), ')', ''), '-', ''), ' ', '') LIKE ${'%' + digits}`
          )
        )
        .limit(5);

      console.log(`    Results: ${matches.length}`);
      for (const m of matches) {
        console.log(`    → ${m.firstName} ${m.lastName} | phone="${m.phone}" | tenant=${m.tenantId.slice(0,8)} | AZ: ${m.azId}`);
      }
    } catch (e) {
      console.log(`    ERROR: ${e}`);
    }

    // 2. Check without tenant filter
    console.log('\n  Without tenant filter:');
    const noTenant = await db
      .select({
        id: customers.id,
        firstName: customers.firstName,
        lastName: customers.lastName,
        phone: customers.phone,
        tenantId: customers.tenantId,
      })
      .from(customers)
      .where(
        sql`REPLACE(REPLACE(REPLACE(REPLACE(${customers.phone}, '(', ''), ')', ''), '-', ''), ' ', '') LIKE ${'%' + digits}`
      )
      .limit(5);
    console.log(`    Results: ${noTenant.length}`);
    for (const m of noTenant) {
      console.log(`    → ${m.firstName} ${m.lastName} | phone="${m.phone}" | tenant=${m.tenantId.slice(0,8)}`);
    }

    // 3. Check the actual calls and their wrapups
    const callRecords = await db.select().from(calls)
      .where(gte(calls.startedAt, today))
      .orderBy(desc(calls.startedAt));

    const relatedCalls = callRecords.filter(c => {
      const phone = (c.fromNumber || '') + (c.toNumber || '');
      return phone.includes(digits);
    });

    console.log(`\n  Related calls today: ${relatedCalls.length}`);
    for (const c of relatedCalls) {
      const time = new Date(c.startedAt!).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Chicago' });
      const wrapups = await db.select().from(wrapupDrafts).where(eq(wrapupDrafts.callId, c.id));
      const w = wrapups[0] as any;

      console.log(`    ${time} ${c.direction} from=${c.fromNumber} to=${c.toNumber} | call.customerId=${c.customerId ? 'YES' : 'null'}`);
      if (w) {
        console.log(`      wrapup: match=${w.matchStatus || w.match_status} status=${w.status} wrapup.customerId=${w.customerId || w.customer_id || 'null'}`);
      } else {
        console.log(`      wrapup: NONE`);
      }
    }
  }

  // Also check tenant_id on calls vs customers
  console.log(`\n\n${'═'.repeat(60)}`);
  console.log('TENANT CHECK');
  console.log(`${'═'.repeat(60)}`);

  const [callCount] = await db.select({ cnt: sql<number>`count(*)::int` })
    .from(calls).where(and(eq(calls.tenantId, TENANT_ID), gte(calls.startedAt, today)));
  const [custCount] = await db.select({ cnt: sql<number>`count(*)::int` })
    .from(customers).where(eq(customers.tenantId, TENANT_ID));

  console.log(`Calls with tenant ${TENANT_ID.slice(0,8)}: ${callCount.cnt}`);
  console.log(`Customers with tenant ${TENANT_ID.slice(0,8)}: ${custCount.cnt}`);

  // Check if calls have a different tenant
  const callTenants = await db.select({ tenantId: calls.tenantId, cnt: sql<number>`count(*)::int` })
    .from(calls).where(gte(calls.startedAt, today))
    .groupBy(calls.tenantId);
  console.log('\nCall tenant distribution:');
  for (const t of callTenants) {
    console.log(`  ${t.tenantId}: ${t.cnt} calls`);
  }

  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
