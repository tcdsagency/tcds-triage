import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

async function run() {
  const { db } = await import('../src/db');
  const { calls, users } = await import('../src/db/schema');
  const { eq } = await import('drizzle-orm');

  const [call] = await db.select().from(calls).where(eq(calls.id, '0feae84b-e047-4b8c-aa0a-5c9c0e652718')).limit(1);

  if (!call) {
    console.log('Call not found');
    process.exit(1);
  }

  console.log('Call details:');
  console.log('  direction:', call.direction);
  console.log('  fromNumber:', call.fromNumber);
  console.log('  toNumber:', call.toNumber);
  console.log('  agentId:', call.agentId || 'NULL');
  console.log('  customerId:', call.customerId || 'NULL');
  console.log('  externalCallId:', call.externalCallId);
  console.log('  disposition:', call.disposition);
  console.log('  startedAt:', call.startedAt);
  console.log('  durationSeconds:', call.durationSeconds);

  // Check Lee's user record
  const lees = await db.select({
    id: users.id, firstName: users.firstName, lastName: users.lastName,
    extension: users.extension, phone: users.phone, directDial: users.directDial,
  }).from(users).where(eq(users.lastName, 'Tidwell'));

  console.log('\nLee Tidwell user record:');
  for (const u of lees) {
    console.log('  id:', u.id);
    console.log('  ext:', u.extension);
    console.log('  phone:', u.phone);
    console.log('  directDial:', u.directDial);
  }

  // Check if fromNumber matches Lee's phone
  if (call.fromNumber && lees[0]) {
    const fromDigits = call.fromNumber.replace(/\D/g, '').slice(-10);
    const phoneDigits = (lees[0].phone || '').replace(/\D/g, '').slice(-10);
    const ddDigits = (lees[0].directDial || '').replace(/\D/g, '').slice(-10);
    console.log('\nMatch check:');
    console.log('  fromNumber last 10:', fromDigits);
    console.log('  Lee phone last 10:', phoneDigits, '| match:', fromDigits === phoneDigits);
    console.log('  Lee directDial last 10:', ddDigits, '| match:', fromDigits === ddDigits);
    console.log('  Lee extension:', lees[0].extension, '| match:', call.fromNumber === lees[0].extension);
  }

  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
