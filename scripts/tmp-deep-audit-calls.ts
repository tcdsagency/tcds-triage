import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env.production.local') });

async function run() {
  const { db } = await import('../src/db');
  const { calls, wrapupDrafts, customers, serviceTickets } = await import('../src/db/schema');
  const { eq, gte, desc, sql, or, like } = await import('drizzle-orm');

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Get all today's calls
  const todaysCalls = await db.select().from(calls)
    .where(gte(calls.startedAt, today))
    .orderBy(desc(calls.startedAt));

  // Group by phone number to spot multi-leg/transfer duplicates
  const byPhone = new Map<string, typeof todaysCalls>();
  for (const c of todaysCalls) {
    const phone = (c.direction === 'inbound' ? c.fromNumber : c.toNumber) || 'unknown';
    const digits = phone.replace(/\D/g, '').slice(-10);
    if (!byPhone.has(digits)) byPhone.set(digits, []);
    byPhone.get(digits)!.push(c);
  }

  console.log('=== MULTI-LEG / DUPLICATE CALL ANALYSIS ===\n');
  for (const [digits, group] of byPhone) {
    if (group.length > 1) {
      const matched = group.filter(c => c.customerId).length;
      const unmatched = group.length - matched;
      console.log(`Phone: ${digits} — ${group.length} call records (${matched} matched, ${unmatched} unmatched)`);
      for (const c of group) {
        const time = new Date(c.startedAt!).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Chicago' });
        console.log(`  ${time} ${c.direction} ${c.fromNumber || '?'} → ${c.toNumber || '?'} | Customer: ${c.customerId ? 'YES' : 'NO'} | Agent: ${c.agentId?.slice(0,8) || 'none'}`);
      }
      console.log('');
    }
  }

  // Check unmatched phones against customer DB
  console.log('=== UNMATCHED PHONE LOOKUP IN CUSTOMER DB ===\n');
  const unmatchedPhones = new Set<string>();
  for (const c of todaysCalls) {
    if (!c.customerId) {
      const phone = (c.direction === 'inbound' ? c.fromNumber : c.toNumber) || '';
      const digits = phone.replace(/\D/g, '').slice(-10);
      if (digits.length >= 7 && digits.length <= 10) unmatchedPhones.add(digits);
    }
  }

  for (const digits of unmatchedPhones) {
    const matches = await db.select({
      id: customers.id,
      firstName: customers.firstName,
      lastName: customers.lastName,
      phone: customers.phone,
      phoneAlt: customers.phoneAlt,
      azId: customers.agencyzoomId,
    }).from(customers)
      .where(or(
        sql`REPLACE(REPLACE(REPLACE(REPLACE(${customers.phone}, '(', ''), ')', ''), '-', ''), ' ', '') LIKE ${'%' + digits}`,
        sql`REPLACE(REPLACE(REPLACE(REPLACE(${customers.phoneAlt}, '(', ''), ')', ''), '-', ''), ' ', '') LIKE ${'%' + digits}`
      ))
      .limit(5);

    if (matches.length > 0) {
      console.log(`📞 ${digits} — FOUND ${matches.length} customer(s) in DB!`);
      for (const m of matches) {
        console.log(`   ${m.firstName} ${m.lastName} | phone: ${m.phone} | alt: ${m.phoneAlt} | AZ: ${m.azId}`);
      }
      console.log(`   ⚠ WHY DIDN'T THIS MATCH? Webhook phone lookup should have found this.`);
    } else {
      // Check if it's a known business/carrier number
      const is800 = digits.startsWith('800') || digits.startsWith('877') || digits.startsWith('888') || digits.startsWith('866');
      if (is800) {
        console.log(`📞 ${digits} — Toll-free/carrier number (expected: no customer match)`);
      } else {
        console.log(`📞 ${digits} — Not in customer DB (new caller / prospect)`);
      }
    }
  }

  // Check outbound calls that should be linked
  console.log('\n=== OUTBOUND CALL CATEGORIZATION ===\n');
  const outbound = todaysCalls.filter(c => c.direction === 'outbound');
  let carrierCalls = 0;
  let customerOutbound = 0;
  let prospectOutbound = 0;
  for (const c of outbound) {
    const phone = c.toNumber || '';
    const digits = phone.replace(/\D/g, '').slice(-10);
    const is800 = digits.startsWith('800') || digits.startsWith('877') || digits.startsWith('888') || digits.startsWith('866');
    if (is800) carrierCalls++;
    else if (c.customerId) customerOutbound++;
    else prospectOutbound++;
  }
  console.log(`Outbound to carrier/business lines: ${carrierCalls} (can't match — expected)`);
  console.log(`Outbound to known customers: ${customerOutbound}`);
  console.log(`Outbound to prospects/unknown: ${prospectOutbound}`);

  // Check wrapup match status vs call customerId consistency
  console.log('\n=== MATCH STATUS INCONSISTENCIES ===\n');
  for (const c of todaysCalls) {
    const [w] = await db.select().from(wrapupDrafts).where(eq(wrapupDrafts.callId, c.id));
    if (!w) continue;

    const time = new Date(c.startedAt!).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Chicago' });
    const phone = (c.direction === 'inbound' ? c.fromNumber : c.toNumber) || '?';

    // customerId set but wrapup says unmatched
    if (c.customerId && w.matchStatus === 'unmatched') {
      const [cust] = await db.select({ firstName: customers.firstName, lastName: customers.lastName, phone: customers.phone })
        .from(customers).where(eq(customers.id, c.customerId));
      console.log(`⚠ ${time} ${phone} — call.customerId=${c.customerId.slice(0,8)} (${cust?.firstName} ${cust?.lastName}) BUT wrapup.matchStatus=unmatched`);
      console.log(`  Call phone: from=${c.fromNumber} to=${c.toNumber} | Customer phone: ${cust?.phone}`);
      console.log(`  → Likely: screen pop set customerId AFTER webhook processed the wrapup`);
    }

    // wrapup says matched but note not posted
    if (w.matchStatus === 'matched' && w.status === 'completed' && !w.noteAutoPosted && !w.isAutoVoided) {
      console.log(`⚠ ${time} ${phone} — matched + completed but note NOT auto-posted`);
      console.log(`  wrapup.customerId: ${w.customerId || 'null'}`);
    }
  }

  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
