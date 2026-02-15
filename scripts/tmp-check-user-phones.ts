import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

async function run() {
  const { db } = await import('../src/db');
  const { users } = await import('../src/db/schema');

  const all = await db.select({
    firstName: users.firstName,
    lastName: users.lastName,
    extension: users.extension,
    phone: users.phone,
    directDial: users.directDial,
  }).from(users);

  for (const u of all) {
    console.log(`${u.firstName} ${u.lastName} | ext: ${u.extension || 'none'} | phone: ${u.phone || 'none'} | directDial: ${u.directDial || 'none'}`);
  }

  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
