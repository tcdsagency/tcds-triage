/**
 * Context Builder
 * ================
 * Builds complete context for agent assist by combining customer data,
 * policies, notes, call history, and AI-extracted personal context.
 */

import { db } from '@/db';
import { customers, policies, calls, users } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { extractPersonalContext, type PersonalContext } from './note-extractor';

// =============================================================================
// TYPES
// =============================================================================

export interface PolicySummary {
  id: string;
  policyNumber: string;
  type: string;
  carrier: string;
  premium?: number;
  effectiveDate?: string;
  expirationDate?: string;
  status: string;
  coverages?: string[];
}

export interface ClaimSummary {
  id: string;
  claimNumber?: string;
  type: string;
  status: string;
  dateOfLoss: string;
  description?: string;
}

export interface TaskSummary {
  id: string;
  title: string;
  status: string;
  dueDate?: string;
  assignedTo?: string;
}

export interface AgentAssistContext {
  customer: {
    id: string;
    name: string;
    preferredName?: string;
    phone: string;
    email?: string;
    address?: string;
    state: string;
    customerSince?: string;
    yearsAsCustomer?: number;
    clientLevel?: 'A' | 'AA' | 'AAA';
    producer?: string;
    csr?: string;
  };

  personal: PersonalContext;

  policies: PolicySummary[];
  totalPremium?: number;
  coverageGaps?: string[];

  call: {
    id: string;
    direction: 'inbound' | 'outbound';
    duration: number;
    reason?: string;
  };

  history: {
    lastContact?: {
      date: string;
      agent: string;
      summary: string;
    };
    totalCalls: number;
    recentClaims: ClaimSummary[];
    openTasks: TaskSummary[];
  };

  agent: {
    id: string;
    name: string;
    extension: string;
  };
}

export interface BuildContextOptions {
  customerId: string;
  callId: string;
  agentId: string;
  notes?: string[];
  callDirection?: 'inbound' | 'outbound';
  callDuration?: number;
}

// =============================================================================
// MAIN FUNCTION
// =============================================================================

/**
 * Build complete context for agent assist
 *
 * Fetches customer data, policies, notes, and extracts personal context
 * all in parallel for optimal performance.
 */
export async function buildAgentAssistContext(
  options: BuildContextOptions
): Promise<AgentAssistContext | null> {
  const { customerId, callId, agentId, notes, callDirection, callDuration } = options;

  try {
    // Fetch data in parallel
    const [customer, customerPolicies, recentCalls, agent, personalContext] = await Promise.all([
      // Get customer
      db.query.customers.findFirst({
        where: eq(customers.id, customerId),
      }),

      // Get policies
      db
        .select()
        .from(policies)
        .where(eq(policies.customerId, customerId))
        .limit(20),

      // Get recent calls for history
      db
        .select()
        .from(calls)
        .where(eq(calls.customerId, customerId))
        .orderBy(desc(calls.startedAt))
        .limit(10),

      // Get agent info
      db.query.users.findFirst({
        where: eq(users.id, agentId),
      }),

      // Extract personal context from notes
      notes && notes.length > 0
        ? extractPersonalContext(notes)
        : Promise.resolve(getEmptyPersonalContext()),
    ]);

    if (!customer) {
      console.warn('[ContextBuilder] Customer not found:', customerId);
      return null;
    }

    // Calculate years as customer
    let yearsAsCustomer: number | undefined;
    if (customer.createdAt) {
      const years = Math.floor(
        (Date.now() - new Date(customer.createdAt).getTime()) / (365.25 * 24 * 60 * 60 * 1000)
      );
      yearsAsCustomer = years;
    }

    // Build policy summaries
    const policySummaries: PolicySummary[] = customerPolicies.map((p) => ({
      id: p.id,
      policyNumber: p.policyNumber || 'Unknown',
      type: p.lineOfBusiness || 'Unknown',
      carrier: p.carrier || 'Unknown',
      premium: p.premium ? Number(p.premium) : undefined,
      effectiveDate: p.effectiveDate?.toISOString().split('T')[0],
      expirationDate: p.expirationDate?.toISOString().split('T')[0],
      status: p.status || 'active',
    }));

    // Calculate total premium
    const totalPremium = policySummaries.reduce((sum, p) => sum + (p.premium || 0), 0);

    // Identify coverage gaps
    const coverageGaps = identifyCoverageGaps(policySummaries);

    // Build address string
    const address = customer.address
      ? typeof customer.address === 'object'
        ? formatAddress(customer.address as Record<string, string>)
        : String(customer.address)
      : undefined;

    // Find last contact
    const lastCall = recentCalls.find((c) => c.id !== callId);
    const lastContact = lastCall
      ? {
          date: lastCall.startedAt?.toISOString() || 'Unknown',
          agent: lastCall.agentId || 'Unknown',
          summary: lastCall.aiSummary || 'No summary available',
        }
      : undefined;

    // Build the context object
    const context: AgentAssistContext = {
      customer: {
        id: customer.id,
        name: `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || 'Unknown',
        preferredName: personalContext.preferredName,
        phone: customer.phone || 'Unknown',
        email: customer.email || undefined,
        address,
        state: extractState(address) || 'AL', // Default to Alabama
        customerSince: customer.createdAt?.toISOString().split('T')[0],
        yearsAsCustomer,
        clientLevel: undefined, // Would come from external system
        producer: undefined,
        csr: undefined,
      },

      personal: personalContext,

      policies: policySummaries,
      totalPremium: totalPremium > 0 ? totalPremium : undefined,
      coverageGaps,

      call: {
        id: callId,
        direction: callDirection || 'inbound',
        duration: callDuration || 0,
        reason: undefined, // Determined during call
      },

      history: {
        lastContact,
        totalCalls: recentCalls.length,
        recentClaims: [], // Would come from claims table
        openTasks: [], // Would come from tasks table
      },

      agent: {
        id: agentId,
        name: agent ? `${agent.firstName || ''} ${agent.lastName || ''}`.trim() : 'Agent',
        extension: agent?.extension || 'Unknown',
      },
    };

    return context;
  } catch (err) {
    console.error('[ContextBuilder] Error building context:', err);
    return null;
  }
}

// =============================================================================
// LIGHTWEIGHT VERSION (for quick updates)
// =============================================================================

/**
 * Build a lightweight context summary for the UI
 * Used when full context is already available but we need a summary
 */
export function buildContextSummary(context: AgentAssistContext) {
  return {
    preferredName: context.personal.preferredName || context.customer.name.split(' ')[0],
    communicationPrefs: context.personal.communicationPrefs,
    sentiment: context.personal.sentiment,
    pendingItemsCount: context.personal.pendingItems.length,
    lifeEventsCount: context.personal.lifeEvents.length,
    customerSince: context.customer.customerSince,
    yearsAsCustomer: context.customer.yearsAsCustomer,
    authorizedContacts: context.personal.authorizedContacts.map((c) => c.name),
    totalPolicies: context.policies.length,
    totalPremium: context.totalPremium,
    coverageGaps: context.coverageGaps,
  };
}

// =============================================================================
// HELPERS
// =============================================================================

function getEmptyPersonalContext(): PersonalContext {
  return {
    communicationPrefs: [],
    authorizedContacts: [],
    familyMembers: [],
    lifeEvents: [],
    recentTopics: [],
    pendingItems: [],
    preferences: [],
    concerns: [],
    sentiment: 'neutral',
    loyaltyIndicators: [],
    painPoints: [],
    personalInterests: [],
    smallTalkTopics: [],
  };
}

function formatAddress(addr: Record<string, string>): string {
  const parts = [addr.street, addr.city, addr.state, addr.zip].filter(Boolean);
  return parts.join(', ');
}

function extractState(address: string | undefined): string | undefined {
  if (!address) return undefined;
  // Look for 2-letter state code
  const match = address.match(/\b([A-Z]{2})\b/);
  return match ? match[1] : undefined;
}

function identifyCoverageGaps(policies: PolicySummary[]): string[] {
  const gaps: string[] = [];
  const policyTypes = policies.map((p) => p.type.toLowerCase());

  // Check for common coverage gaps
  const hasAuto = policyTypes.some((t) => t.includes('auto') || t.includes('vehicle'));
  const hasHome = policyTypes.some((t) => t.includes('home') || t.includes('dwelling') || t.includes('ho3'));
  const hasUmbrella = policyTypes.some((t) => t.includes('umbrella'));
  const hasLife = policyTypes.some((t) => t.includes('life'));

  // If they have both auto and home but no umbrella
  if (hasAuto && hasHome && !hasUmbrella) {
    gaps.push('No umbrella policy - consider for additional liability protection');
  }

  // If they have dependents but no life insurance (would need more context)
  if (!hasLife) {
    gaps.push('No life insurance on file');
  }

  return gaps;
}

// =============================================================================
// EXPORTS
// =============================================================================

export { type PersonalContext } from './note-extractor';
