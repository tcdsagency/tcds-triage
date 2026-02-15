import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

async function run() {
  const { db } = await import('../src/db');
  const { users } = await import('../src/db/schema');
  const rows = await db.select({
    firstName: users.firstName,
    lastName: users.lastName,
    agentCode: users.agentCode,
    role: users.role,
  }).from(users);

  console.log('firstName'.padEnd(14) + 'lastName'.padEnd(14) + 'agentCode'.padEnd(12) + 'role');
  console.log('-'.repeat(52));
  for (const r of rows) {
    console.log(
      (r.firstName || '').padEnd(14) +
      (r.lastName || '').padEnd(14) +
      (r.agentCode || '-').padEnd(12) +
      (r.role || '')
    );
  }
  process.exit(0);
}
run();
