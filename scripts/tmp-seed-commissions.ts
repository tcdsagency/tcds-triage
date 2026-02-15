import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function main() {
  const { db } = await import('../src/db');
  const { users, commissionAgents, commissionAgentCodes, commissionCarriers, commissionCarrierAliases } = await import('../src/db/schema');
  const { eq } = await import('drizzle-orm');

  const tenantId = process.env.DEFAULT_TENANT_ID!;

  // Get all users with agent codes
  const allUsers = await db.select({
    id: users.id,
    firstName: users.firstName,
    lastName: users.lastName,
    role: users.role,
    agentCode: users.agentCode,
  }).from(users);

  const agentUsers = allUsers.filter(u => u.agentCode);

  console.log('=== Creating Commission Agents ===');
  for (const u of agentUsers) {
    const role = u.role === 'owner' ? 'owner' : u.role === 'agent' ? 'producer' : 'csr';
    const isAngie = u.agentCode === 'AES';

    // Check if agent already exists for this user
    const existing = await db.select({ id: commissionAgents.id })
      .from(commissionAgents)
      .where(eq(commissionAgents.userId, u.id))
      .limit(1);

    if (existing.length > 0) {
      console.log(`  SKIP ${u.agentCode} ${u.firstName} ${u.lastName} — already exists`);
      continue;
    }

    const [agent] = await db.insert(commissionAgents).values({
      tenantId,
      firstName: u.firstName!,
      lastName: u.lastName!,
      role: role as any,
      isActive: true,
      userId: u.id,
      hasDrawAccount: isAngie,
      monthlyDrawAmount: isAngie ? '2000.00' : null,
      defaultSplitPercent: '50.00',
    }).returning();

    console.log(`  CREATED ${u.agentCode?.padEnd(5)} ${u.firstName} ${u.lastName} → agent ${agent.id} (role=${role}${isAngie ? ', DRAW=$2000' : ''})`);

    // Create agent code mapping
    await db.insert(commissionAgentCodes).values({
      tenantId,
      agentId: agent.id,
      code: u.agentCode!,
      description: `HawkSoft producer code for ${u.firstName} ${u.lastName}`,
    });
    console.log(`         code: ${u.agentCode}`);
  }

  // Create carriers
  console.log('\n=== Creating Carriers ===');
  const carrierData = [
    { name: 'Allstate', code: 'ALL', aliases: ['Allstate Property & Casualty', 'Allstate Insurance', 'Allstate Fire and Casualty'] },
    { name: 'Progressive', code: 'PROG', aliases: ['Progressive Insurance', 'Progressive Casualty', 'Progressive Home'] },
    { name: 'SAFECO', code: 'SAFE', aliases: ['Safeco Insurance', 'SAFECO Insurance Company of America'] },
    { name: 'Openly', code: 'OPEN', aliases: ['Openly Insurance', 'Openly LLC'] },
    { name: 'National General', code: 'NATG', aliases: ['National General Insurance', 'NGIC', 'Nat Gen'] },
    { name: 'Travelers', code: 'TRAV', aliases: ['Travelers Insurance', 'Travelers Home and Marine', 'Travelers Indemnity'] },
    { name: 'Foremost', code: 'FORE', aliases: ['Foremost Insurance', 'Foremost Insurance Group'] },
    { name: 'Bristol West', code: 'BRIS', aliases: ['Bristol West Insurance'] },
    { name: 'Stillwater', code: 'STIL', aliases: ['Stillwater Insurance', 'Stillwater Insurance Group'] },
    { name: 'SageSure', code: 'SAGE', aliases: ['SageSure Insurance', 'SageSure Insurance Managers'] },
    { name: 'Hippo', code: 'HIPP', aliases: ['Hippo Insurance', 'Hippo Home Insurance'] },
    { name: 'Bamboo', code: 'BAMB', aliases: ['Bamboo Insurance'] },
  ];

  for (const c of carrierData) {
    const existing = await db.select({ id: commissionCarriers.id })
      .from(commissionCarriers)
      .where(eq(commissionCarriers.name, c.name))
      .limit(1);

    if (existing.length > 0) {
      console.log(`  SKIP ${c.name} — already exists`);
      continue;
    }

    const [carrier] = await db.insert(commissionCarriers).values({
      tenantId,
      name: c.name,
      carrierCode: c.code,
      isActive: true,
    }).returning();

    console.log(`  CREATED ${c.name} (${c.code}) → ${carrier.id}`);

    // Create aliases
    for (const alias of c.aliases) {
      await db.insert(commissionCarrierAliases).values({
        tenantId,
        carrierId: carrier.id,
        alias,
      });
    }
    console.log(`         aliases: ${c.aliases.join(', ')}`);
  }

  // Summary
  const agentCount = await db.select({ id: commissionAgents.id }).from(commissionAgents);
  const codeCount = await db.select({ id: commissionAgentCodes.id }).from(commissionAgentCodes);
  const carrierCount = await db.select({ id: commissionCarriers.id }).from(commissionCarriers);
  const aliasCount = await db.select({ id: commissionCarrierAliases.id }).from(commissionCarrierAliases);

  console.log('\n=== Summary ===');
  console.log(`  Agents: ${agentCount.length}`);
  console.log(`  Agent codes: ${codeCount.length}`);
  console.log(`  Carriers: ${carrierCount.length}`);
  console.log(`  Carrier aliases: ${aliasCount.length}`);

  process.exit(0);
}
main();
