// Commission Tracker - Auth helpers for per-user data restriction
// Admin users (owner/admin roles) see all data; agents see only their own

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { users, commissionAgents, commissionAgentCodes, commissionTransactions } from "@/db/schema";
import { eq, and, like, or, SQL } from "drizzle-orm";

export interface CommissionUser {
  userId: string;
  tenantId: string;
  isAdmin: boolean;
  agentId: string | null;
  agentCodes: string[];
}

/**
 * Get the current user's commission context.
 * Returns user info, admin status, and agent codes for filtering.
 * Returns null if not authenticated.
 */
export async function getCommissionUser(): Promise<CommissionUser | null> {
  const tenantId = process.env.DEFAULT_TENANT_ID;
  if (!tenantId) return null;

  const supabase = await createClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser?.email) return null;

  // Look up DB user
  const [dbUser] = await db
    .select({ id: users.id, role: users.role })
    .from(users)
    .where(eq(users.email, authUser.email))
    .limit(1);

  if (!dbUser) return null;

  const isAdmin = dbUser.role === "owner" || dbUser.role === "admin";

  // Look up commission agent linked to this user
  let agentId: string | null = null;
  let agentCodes: string[] = [];

  if (!isAdmin) {
    const [agent] = await db
      .select({ id: commissionAgents.id })
      .from(commissionAgents)
      .where(
        and(
          eq(commissionAgents.tenantId, tenantId),
          eq(commissionAgents.userId, dbUser.id)
        )
      )
      .limit(1);

    if (agent) {
      agentId = agent.id;
      const codes = await db
        .select({ code: commissionAgentCodes.code })
        .from(commissionAgentCodes)
        .where(
          and(
            eq(commissionAgentCodes.tenantId, tenantId),
            eq(commissionAgentCodes.agentId, agent.id)
          )
        );
      agentCodes = codes.map((c) => c.code);
    }
  }

  return { userId: dbUser.id, tenantId, isAdmin, agentId, agentCodes };
}

/**
 * Build a Drizzle WHERE condition that filters commissionTransactions.notes
 * by the agent's codes. Uses the proven pattern: LIKE '%Agent 1: CODE %'
 * Returns undefined if no codes (caller should handle as "no results").
 */
export function getAgentTransactionFilter(agentCodes: string[]): SQL | undefined {
  if (agentCodes.length === 0) return undefined;

  const conditions = agentCodes.map((code) =>
    like(commissionTransactions.notes, `%Agent 1: ${code} %`)
  );

  return conditions.length === 1 ? conditions[0] : or(...conditions)!;
}

/**
 * Gate an API route to admin-only access.
 * Returns the CommissionUser if admin, or a 401/403 NextResponse.
 */
export async function requireAdmin(): Promise<CommissionUser | NextResponse> {
  const commUser = await getCommissionUser();
  if (!commUser) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (!commUser.isAdmin) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }
  return commUser;
}
