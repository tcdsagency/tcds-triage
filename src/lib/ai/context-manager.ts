/**
 * AI Context Manager
 * ===================
 * Builds rich context for AI operations from multiple data sources
 */

import { db } from "@/db";
import { customers, policies, calls, messages, activities } from "@/db/schema";
import { eq, desc, and, gte } from "drizzle-orm";
import {
  AIContext,
  UserContext,
  CustomerContext,
  OrganizationContext,
  TemporalContext,
  PolicyContext,
  InteractionContext,
} from "./types";

export class ContextManager {
  /**
   * Build full context for an AI request
   */
  async build(params: {
    userId?: string;
    customerId?: string;
    tenantId: string;
    includeHistory?: boolean;
  }): Promise<AIContext> {
    const [user, customer, organization, temporal] = await Promise.all([
      params.userId ? this.getUserContext(params.userId, params.tenantId) : null,
      params.customerId ? this.getCustomerContext(params.customerId, params.tenantId) : null,
      this.getOrganizationContext(params.tenantId),
      this.getTemporalContext(),
    ]);

    return {
      user: user || undefined,
      customer: customer || undefined,
      organization,
      temporal,
    };
  }

  /**
   * Get user/agent context
   */
  private async getUserContext(userId: string, tenantId: string): Promise<UserContext | null> {
    try {
      // In a real implementation, fetch from users table
      // For now, return basic context
      return {
        userId,
        name: "Agent",
        role: "csr",
        experience: "mid",
      };
    } catch (error) {
      console.error("[ContextManager] Error getting user context:", error);
      return null;
    }
  }

  /**
   * Get rich customer context
   */
  async getCustomerContext(customerId: string, tenantId: string): Promise<CustomerContext | null> {
    try {
      // Get customer
      const [customer] = await db
        .select()
        .from(customers)
        .where(and(eq(customers.id, customerId), eq(customers.tenantId, tenantId)))
        .limit(1);

      if (!customer) return null;

      // Get policies
      const customerPolicies = await db
        .select()
        .from(policies)
        .where(eq(policies.customerId, customerId));

      // Get recent interactions (calls + messages)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const recentCalls = await db
        .select()
        .from(calls)
        .where(and(eq(calls.customerId, customerId), gte(calls.createdAt, thirtyDaysAgo)))
        .orderBy(desc(calls.createdAt))
        .limit(10);

      const recentMessages = await db
        .select()
        .from(messages)
        .where(and(eq(messages.customerId, customerId), gte(messages.createdAt, thirtyDaysAgo)))
        .orderBy(desc(messages.createdAt))
        .limit(10);

      // Calculate engagement metrics
      const totalInteractions = recentCalls.length + recentMessages.length;
      const engagementScore = Math.min(totalInteractions / 10, 1); // Normalize to 0-1

      // Format policies
      const policyContexts: PolicyContext[] = customerPolicies.map((p) => ({
        policyId: p.id,
        type: p.lineOfBusiness || "unknown",
        carrier: p.carrier || "Unknown",
        premium: typeof p.premium === "number" ? p.premium : parseFloat(String(p.premium)) || 0,
        effectiveDate: p.effectiveDate instanceof Date ? p.effectiveDate.toISOString() : String(p.effectiveDate || ""),
        expirationDate: p.expirationDate instanceof Date ? p.expirationDate.toISOString() : String(p.expirationDate || ""),
        status: p.status || "active",
      }));

      // Format recent interactions
      const interactions: InteractionContext[] = [
        ...recentCalls.map((c) => ({
          type: "call" as const,
          date: c.createdAt?.toISOString() || "",
          summary: c.aiSummary || undefined,
          outcome: c.disposition || undefined,
        })),
        ...recentMessages.map((m) => ({
          type: (m.direction === "inbound" ? "text" : "text") as "call" | "email" | "text" | "chat",
          date: m.createdAt?.toISOString() || "",
        })),
      ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      // Calculate total premium
      const totalPremium = policyContexts
        .filter((p) => p.status === "active")
        .reduce((sum, p) => sum + (p.premium || 0), 0);

      // Determine client level
      const activePolicyCount = policyContexts.filter((p) => p.status === "active").length;
      let clientLevel: "A" | "AA" | "AAA" = "A";
      if (activePolicyCount >= 3 || totalPremium >= 10000) {
        clientLevel = "AAA";
      } else if (activePolicyCount >= 2 || totalPremium >= 5000) {
        clientLevel = "AA";
      }

      // Check OG status
      const customerSince = customer.createdAt;
      const isOG = customerSince ? new Date(customerSince) < new Date("2021-01-01") : false;

      return {
        customerId: customer.id,
        name: `${customer.firstName || ""} ${customer.lastName || ""}`.trim(),
        email: customer.email || undefined,
        phone: customer.phone || undefined,
        customerSince: customerSince?.toISOString(),
        clientLevel,
        isOG,
        policies: policyContexts,
        totalPremium,
        engagementScore,
        lastContact: interactions[0]?.date,
        recentInteractions: interactions.slice(0, 5),
      };
    } catch (error) {
      console.error("[ContextManager] Error getting customer context:", error);
      return null;
    }
  }

  /**
   * Get organization context
   */
  private async getOrganizationContext(tenantId: string): Promise<OrganizationContext> {
    return {
      tenantId,
      name: "Agency",
      goals: {
        retentionTarget: 0.95,
        crossSellTarget: 0.15,
        newBusinessTarget: 50,
      },
    };
  }

  /**
   * Get temporal context
   */
  private getTemporalContext(): TemporalContext {
    const now = new Date();
    const hour = now.getHours();
    const dayOfWeek = now.getDay();
    const dayOfMonth = now.getDate();
    const month = now.getMonth();

    // Determine if business hours (9am-5pm weekdays)
    const isBusinessHours = dayOfWeek >= 1 && dayOfWeek <= 5 && hour >= 9 && hour < 17;

    // End of month (last 5 days)
    const daysInMonth = new Date(now.getFullYear(), month + 1, 0).getDate();
    const isEndOfMonth = dayOfMonth > daysInMonth - 5;

    // End of quarter
    const isEndOfQuarter = [2, 5, 8, 11].includes(month) && isEndOfMonth;

    // Season
    let season: "spring" | "summer" | "fall" | "winter";
    if (month >= 2 && month <= 4) season = "spring";
    else if (month >= 5 && month <= 7) season = "summer";
    else if (month >= 8 && month <= 10) season = "fall";
    else season = "winter";

    return {
      currentTime: now,
      dayOfWeek,
      isBusinessHours,
      isEndOfMonth,
      isEndOfQuarter,
      season,
    };
  }

  /**
   * Get a quick context summary for prompts
   */
  summarizeContext(context: AIContext): string {
    const parts: string[] = [];

    if (context.customer) {
      const c = context.customer;
      parts.push(`Customer: ${c.name} (${c.clientLevel}${c.isOG ? "/OG" : ""})`);
      parts.push(`Premium: $${c.totalPremium.toLocaleString()}/year`);
      parts.push(`Policies: ${c.policies.length}`);
      if (c.churnRisk !== undefined) {
        parts.push(`Churn Risk: ${(c.churnRisk * 100).toFixed(0)}%`);
      }
      if (c.lastContact) {
        const daysSince = Math.floor(
          (Date.now() - new Date(c.lastContact).getTime()) / (1000 * 60 * 60 * 24)
        );
        parts.push(`Last Contact: ${daysSince} days ago`);
      }
    }

    if (context.temporal) {
      const t = context.temporal;
      if (!t.isBusinessHours) parts.push("After Hours");
      if (t.isEndOfMonth) parts.push("End of Month");
      if (t.isEndOfQuarter) parts.push("End of Quarter");
    }

    return parts.join(" | ");
  }
}

// Singleton instance
let contextManager: ContextManager | null = null;

export function getContextManager(): ContextManager {
  if (!contextManager) {
    contextManager = new ContextManager();
  }
  return contextManager;
}
