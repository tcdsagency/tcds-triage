/**
 * Agent Resolver
 * Resolves agent codes from CSV data against the commission agent codes table.
 */

import { db } from '@/db';
import { commissionAgents, commissionAgentCodes } from '@/db/schema';
import { eq } from 'drizzle-orm';

interface ResolvedAgent {
  id: string;
  name: string;
  code: string;
  matchType: 'code' | 'name' | 'none';
}

/**
 * Resolve an agent code to a commission agent record.
 */
export async function resolveAgent(
  tenantId: string,
  agentCode: string
): Promise<ResolvedAgent> {
  if (!agentCode?.trim()) {
    return { id: '', name: '', code: agentCode || '', matchType: 'none' };
  }

  const trimmed = agentCode.trim().toUpperCase();

  // 1. Code match
  const codes = await db
    .select()
    .from(commissionAgentCodes)
    .where(eq(commissionAgentCodes.tenantId, tenantId));

  const codeMatch = codes.find(
    (c) => c.code.toUpperCase() === trimmed
  );
  if (codeMatch) {
    const agents = await db
      .select()
      .from(commissionAgents)
      .where(eq(commissionAgents.id, codeMatch.agentId));

    if (agents[0]) {
      return {
        id: agents[0].id,
        name: `${agents[0].firstName} ${agents[0].lastName}`,
        code: codeMatch.code,
        matchType: 'code',
      };
    }
  }

  // 2. Name match (try "First Last" or "Last, First")
  const agents = await db
    .select()
    .from(commissionAgents)
    .where(eq(commissionAgents.tenantId, tenantId));

  const nameMatch = agents.find((a) => {
    const fullName = `${a.firstName} ${a.lastName}`.toLowerCase();
    const reversed = `${a.lastName}, ${a.firstName}`.toLowerCase();
    const input = agentCode.trim().toLowerCase();
    return fullName === input || reversed === input;
  });

  if (nameMatch) {
    return {
      id: nameMatch.id,
      name: `${nameMatch.firstName} ${nameMatch.lastName}`,
      code: agentCode,
      matchType: 'name',
    };
  }

  return { id: '', name: '', code: agentCode, matchType: 'none' };
}

/**
 * Batch resolve agent codes.
 */
export async function resolveAgents(
  tenantId: string,
  agentCodes: string[]
): Promise<Map<string, ResolvedAgent>> {
  const results = new Map<string, ResolvedAgent>();
  const unique = [...new Set(agentCodes.filter(Boolean))];

  // Load all codes and agents once
  const codes = await db
    .select()
    .from(commissionAgentCodes)
    .where(eq(commissionAgentCodes.tenantId, tenantId));

  const agents = await db
    .select()
    .from(commissionAgents)
    .where(eq(commissionAgents.tenantId, tenantId));

  for (const code of unique) {
    const trimmed = code.trim().toUpperCase();

    const codeMatch = codes.find((c) => c.code.toUpperCase() === trimmed);
    if (codeMatch) {
      const agent = agents.find((a) => a.id === codeMatch.agentId);
      if (agent) {
        results.set(code, {
          id: agent.id,
          name: `${agent.firstName} ${agent.lastName}`,
          code: codeMatch.code,
          matchType: 'code',
        });
        continue;
      }
    }

    const nameMatch = agents.find((a) => {
      const fullName = `${a.firstName} ${a.lastName}`.toLowerCase();
      const reversed = `${a.lastName}, ${a.firstName}`.toLowerCase();
      const input = code.trim().toLowerCase();
      return fullName === input || reversed === input;
    });

    if (nameMatch) {
      results.set(code, {
        id: nameMatch.id,
        name: `${nameMatch.firstName} ${nameMatch.lastName}`,
        code,
        matchType: 'name',
      });
      continue;
    }

    results.set(code, { id: '', name: '', code, matchType: 'none' });
  }

  return results;
}
