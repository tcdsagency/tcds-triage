import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function main() {
  const { db } = await import('../src/db');
  const { users } = await import('../src/db/schema');

  const allUsers = await db.select({
    id: users.id,
    firstName: users.firstName,
    lastName: users.lastName,
    email: users.email,
    role: users.role,
    extension: users.extension,
  }).from(users);

  console.log('Users in database:');
  for (const u of allUsers) {
    const initials = `${u.firstName?.[0] || ''}${u.lastName?.[0] || ''}`.toUpperCase();
    console.log(`  ${initials.padEnd(5)} ${u.firstName} ${u.lastName} (${u.email}) role=${u.role} ext=${u.extension || 'none'}`);
    console.log(`         id: ${u.id}`);
  }

  process.exit(0);
}
main();
