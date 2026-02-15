import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function main() {
  const { db } = await import('../src/db');
  const { commissionAgents, commissionAgentCodes } = await import('../src/db/schema');
  const { eq, and } = await import('drizzle-orm');

  const tenantId = process.env.DEFAULT_TENANT_ID!;

  // KBR - Kelli Brown (outside producer, no user account)
  const [kbr] = await db.insert(commissionAgents).values({
    tenantId,
    firstName: 'Kelli',
    lastName: 'Brown',
    role: 'producer' as any,
    isActive: true,
    userId: null,
    hasDrawAccount: false,
    defaultSplitPercent: '50.00',
    notes: 'Outside producer — no user account in the system',
  }).returning();
  await db.insert(commissionAgentCodes).values({
    tenantId, agentId: kbr.id, code: 'KBR',
    description: 'HawkSoft producer code for Kelli Brown (outside producer)',
  });
  console.log('CREATED KBR Kelli Brown (outside producer)');

  // JAK - Jacob Kirk (no longer employed, maps to house)
  const [jak] = await db.insert(commissionAgents).values({
    tenantId,
    firstName: 'Jacob',
    lastName: 'Kirk',
    role: 'producer' as any,
    isActive: false,
    userId: null,
    hasDrawAccount: false,
    defaultSplitPercent: '50.00',
    notes: 'No longer employed — policies should map to house account',
  }).returning();
  await db.insert(commissionAgentCodes).values({
    tenantId, agentId: jak.id, code: 'JAK',
    description: 'HawkSoft producer code for Jacob Kirk (inactive — maps to house)',
  });
  console.log('CREATED JAK Jacob Kirk (inactive, maps to house)');

  // IAM - Ian Maloy (no longer employed, maps to house)
  const [iam] = await db.insert(commissionAgents).values({
    tenantId,
    firstName: 'Ian',
    lastName: 'Maloy',
    role: 'producer' as any,
    isActive: false,
    userId: null,
    hasDrawAccount: false,
    defaultSplitPercent: '50.00',
    notes: 'No longer employed — policies should map to house account',
  }).returning();
  await db.insert(commissionAgentCodes).values({
    tenantId, agentId: iam.id, code: 'IAM',
    description: 'HawkSoft producer code for Ian Maloy (inactive — maps to house)',
  });
  console.log('CREATED IAM Ian Maloy (inactive, maps to house)');

  // Summary
  const agents = await db.select({ id: commissionAgents.id, firstName: commissionAgents.firstName, lastName: commissionAgents.lastName, isActive: commissionAgents.isActive, notes: commissionAgents.notes })
    .from(commissionAgents).where(eq(commissionAgents.tenantId, tenantId));
  const codes = await db.select({ code: commissionAgentCodes.code, agentId: commissionAgentCodes.agentId })
    .from(commissionAgentCodes).where(eq(commissionAgentCodes.tenantId, tenantId));

  console.log('\n=== All Agents ===');
  for (const a of agents) {
    const code = codes.find(c => c.agentId === a.id);
    console.log(`  ${(code?.code || '???').padEnd(5)} ${a.firstName} ${a.lastName}  active=${a.isActive}${a.notes ? '  note: ' + a.notes : ''}`);
  }

  process.exit(0);
}
main();
