import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

async function run() {
  const { db } = await import('../src/db');
  const { policies, users } = await import('../src/db/schema');
  const { sql, isNotNull, eq } = await import('drizzle-orm');

  // Count policies with agent1 populated
  const [{ total }] = await db.select({ total: sql<number>`count(*)::int` }).from(policies);
  const [{ withAgent }] = await db.select({ withAgent: sql<number>`count(*)::int` }).from(policies).where(isNotNull(policies.agent1));
  const [{ withProducer }] = await db.select({ withProducer: sql<number>`count(*)::int` }).from(policies).where(isNotNull(policies.producerId));

  console.log(`Total policies:          ${total}`);
  console.log(`With agent1 populated:   ${withAgent}`);
  console.log(`With producerId resolved: ${withProducer}`);

  // Show sample
  const sample = await db.select({
    policyNumber: policies.policyNumber,
    agent1: policies.agent1,
    agent2: policies.agent2,
    agent3: policies.agent3,
    producerId: policies.producerId,
  }).from(policies).where(isNotNull(policies.agent1)).limit(10);

  console.log('\nSample policies with agent1:');
  for (const p of sample) {
    console.log(`  ${p.policyNumber.padEnd(22)} agent1=${(p.agent1 || '-').padEnd(6)} producerId=${p.producerId || 'NULL'}`);
  }

  // Check distinct agent1 values
  const agents = await db.select({ agent1: policies.agent1, count: sql<number>`count(*)::int` })
    .from(policies)
    .where(isNotNull(policies.agent1))
    .groupBy(policies.agent1);
  console.log('\nAgent1 distribution:');
  for (const a of agents) {
    console.log(`  ${(a.agent1 || '-').padEnd(8)} ${a.count} policies`);
  }

  process.exit(0);
}
run();
