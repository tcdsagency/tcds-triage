/**
 * Related Tickets Detection Module
 *
 * Finds tickets related to a call for smart triage recommendations.
 * Uses keyword matching with optional AI fallback for borderline cases.
 */

import { getAgencyZoomClient, ServiceTicket } from "@/lib/api/agencyzoom";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic();

export interface RelatedTicket {
  id: number;
  azTicketId: number;
  subject: string;
  description: string | null;
  status: "active" | "completed" | "removed";
  stageName: string | null;
  categoryName: string | null;
  csrName: string | null;
  createdAt: string;
  lastActivity: string;
  similarity: number;
  matchReason: string;
}

export interface TriageRecommendation {
  recommendation: "APPEND" | "CREATE" | "DISMISS";
  confidence: number;
  relatedTicketId?: number;
  reason: string;
}

/**
 * Find tickets related to a call for a specific customer
 */
export async function findRelatedTickets(
  householdId: number,
  callSummary: string,
  options: { days?: number; includeCompleted?: boolean } = {}
): Promise<RelatedTicket[]> {
  const { days = 60, includeCompleted = true } = options;

  if (!householdId || !callSummary) {
    return [];
  }

  const azClient = getAgencyZoomClient();

  // Get customer's tickets from AgencyZoom
  // We fetch both active and completed if includeCompleted is true
  const statuses = includeCompleted ? [1, 2] : [1]; // 1=active, 2=completed
  const allTickets: ServiceTicket[] = [];

  for (const status of statuses) {
    try {
      const result = await azClient.getServiceTickets({
        status,
        limit: 50,
      });

      // Filter to this customer's tickets
      const customerTickets = result.data.filter(
        (t) => t.householdId === householdId
      );
      allTickets.push(...customerTickets);
    } catch (error) {
      console.error(
        `[RelatedTickets] Failed to fetch tickets with status ${status}:`,
        error
      );
    }
  }

  if (allTickets.length === 0) {
    return [];
  }

  // Filter to recent tickets
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

  const recentTickets = allTickets.filter((t) => {
    const createDate = new Date(t.createDate);
    const lastActivity = new Date(t.lastActivityDate);
    return createDate >= cutoffDate || lastActivity >= cutoffDate;
  });

  if (recentTickets.length === 0) {
    return [];
  }

  // Calculate similarity for each ticket
  const scoredTickets = await Promise.all(
    recentTickets.map(async (ticket) => {
      const similarity = await calculateSimilarity(
        callSummary,
        ticket.subject,
        ticket.serviceDesc
      );

      let matchReason = "";
      if (similarity >= 80) {
        matchReason = "High similarity - likely same issue";
      } else if (similarity >= 60) {
        matchReason = "Moderate similarity - possibly related";
      } else if (similarity >= 40) {
        matchReason = "Some overlap - review recommended";
      } else {
        matchReason = "Low similarity";
      }

      // Boost for same category detected
      const categoryBoost = detectSameCategory(callSummary, ticket.subject)
        ? 10
        : 0;

      // Boost for recent activity (more relevant if actively being worked)
      const daysSinceActivity = Math.floor(
        (Date.now() - new Date(ticket.lastActivityDate).getTime()) /
          (1000 * 60 * 60 * 24)
      );
      const recencyBoost =
        daysSinceActivity <= 7 ? 10 : daysSinceActivity <= 14 ? 5 : 0;

      // Boost for active tickets (prefer appending to active vs completed)
      const activeBoost = ticket.status === 1 ? 5 : 0;

      const finalSimilarity = Math.min(
        100,
        similarity + categoryBoost + recencyBoost + activeBoost
      );

      const statusMap: Record<number, "active" | "completed" | "removed"> = {
        0: "removed",
        1: "active",
        2: "completed",
      };

      return {
        id: ticket.id,
        azTicketId: ticket.id,
        subject: ticket.subject,
        description: ticket.serviceDesc || null,
        status: statusMap[ticket.status] || "active",
        stageName: ticket.workflowStageName || null,
        categoryName: ticket.categoryName || null,
        csrName:
          ticket.csrFirstname && ticket.csrLastname
            ? `${ticket.csrFirstname} ${ticket.csrLastname}`
            : null,
        createdAt: ticket.createDate,
        lastActivity: ticket.lastActivityDate,
        similarity: finalSimilarity,
        matchReason,
      } as RelatedTicket;
    })
  );

  // Return tickets with similarity >= 30%, sorted by score
  return scoredTickets
    .filter((t) => t.similarity >= 30)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 5);
}

/**
 * Calculate similarity between call summary and ticket
 */
async function calculateSimilarity(
  callSummary: string,
  ticketSubject: string,
  ticketDescription?: string | null
): Promise<number> {
  // First try quick keyword matching
  const keywordScore = keywordSimilarity(
    callSummary,
    `${ticketSubject} ${ticketDescription || ""}`
  );

  // If clearly low or clearly high, skip AI
  if (keywordScore < 20 || keywordScore > 85) {
    return keywordScore;
  }

  // Use AI for borderline cases
  try {
    const prompt = `Rate similarity 0-100 between a new call and an existing service ticket.
80+ = same issue (customer calling back about same thing)
50-79 = related (similar topic but may be separate issue)
<50 = different topics

NEW CALL SUMMARY:
${callSummary}

EXISTING TICKET:
Subject: ${ticketSubject}
${ticketDescription ? `Description: ${ticketDescription.slice(0, 300)}` : ""}

Respond with just the number:`;

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 10,
      messages: [{ role: "user", content: prompt }],
    });

    const content = response.content[0];
    if (content.type === "text") {
      const score = parseInt(content.text.trim());
      if (!isNaN(score) && score >= 0 && score <= 100) {
        return score;
      }
    }
  } catch (error) {
    console.error("[RelatedTickets] AI similarity failed, using keyword score:", error);
  }

  return keywordScore;
}

/**
 * Quick keyword-based similarity using Jaccard index
 */
function keywordSimilarity(text1: string, text2: string): number {
  const stopWords = new Set([
    "the",
    "a",
    "an",
    "is",
    "are",
    "was",
    "were",
    "to",
    "for",
    "and",
    "or",
    "but",
    "in",
    "on",
    "at",
    "by",
    "with",
    "about",
    "called",
    "call",
    "customer",
    "wants",
    "need",
    "needs",
    "would",
    "like",
    "please",
    "thank",
    "thanks",
    "you",
    "your",
    "their",
    "they",
    "have",
    "has",
    "had",
    "this",
    "that",
    "these",
    "those",
    "from",
  ]);

  const getWords = (text: string) =>
    text
      .toLowerCase()
      .split(/\W+/)
      .filter((w) => w.length > 2 && !stopWords.has(w));

  const words1 = new Set(getWords(text1));
  const words2 = new Set(getWords(text2));

  if (words1.size === 0 || words2.size === 0) {
    return 0;
  }

  const intersection = [...words1].filter((w) => words2.has(w)).length;
  const union = new Set([...words1, ...words2]).size;

  if (union === 0) return 0;
  return Math.round((intersection / union) * 100);
}

/**
 * Detect if call and ticket are in the same service category
 */
function detectSameCategory(text1: string, text2: string): boolean {
  const categories: Record<string, string[]> = {
    billing: [
      "bill",
      "billing",
      "payment",
      "pay",
      "charge",
      "invoice",
      "premium",
      "due",
      "owe",
      "balance",
      "autopay",
      "draft",
    ],
    claim: [
      "claim",
      "accident",
      "damage",
      "collision",
      "hit",
      "wreck",
      "total",
      "totaled",
      "loss",
      "theft",
      "stolen",
      "vandalism",
    ],
    quote: [
      "quote",
      "price",
      "rate",
      "cost",
      "bundle",
      "shop",
      "compare",
      "cheaper",
      "expensive",
      "new policy",
    ],
    cancel: [
      "cancel",
      "cancellation",
      "non-renew",
      "nonrenew",
      "stop",
      "terminate",
      "end coverage",
    ],
    change: [
      "change",
      "update",
      "add",
      "remove",
      "modify",
      "endorsement",
      "vehicle",
      "driver",
      "address",
      "lien",
      "lienholder",
    ],
    id_card: [
      "id card",
      "proof",
      "insurance card",
      "verification",
      "evidence",
      "certificate",
    ],
    document: [
      "document",
      "dec page",
      "declaration",
      "copy",
      "paperwork",
      "form",
      "fax",
      "email",
      "send",
    ],
    reinstate: [
      "reinstate",
      "reinstatement",
      "lapsed",
      "expired",
      "reactivate",
    ],
  };

  const lower1 = text1.toLowerCase();
  const lower2 = text2.toLowerCase();

  for (const [, keywords] of Object.entries(categories)) {
    const match1 = keywords.some((k) => lower1.includes(k));
    const match2 = keywords.some((k) => lower2.includes(k));
    if (match1 && match2) return true;
  }

  return false;
}

/**
 * Determine triage recommendation based on related tickets
 */
export function determineTriageRecommendation(
  relatedTickets: RelatedTicket[]
): TriageRecommendation {
  if (relatedTickets.length === 0) {
    return {
      recommendation: "CREATE",
      confidence: 90,
      reason: "No related tickets found - new issue",
    };
  }

  const bestMatch = relatedTickets[0];

  // Only recommend APPEND for active tickets with high similarity
  if (bestMatch.similarity >= 80 && bestMatch.status === "active") {
    return {
      recommendation: "APPEND",
      confidence: bestMatch.similarity,
      relatedTicketId: bestMatch.id,
      reason: `${bestMatch.similarity}% similar to "${bestMatch.subject}"`,
    };
  }

  // For completed tickets with high similarity, suggest CREATE with context
  if (bestMatch.similarity >= 80 && bestMatch.status === "completed") {
    return {
      recommendation: "CREATE",
      confidence: 75,
      relatedTicketId: bestMatch.id,
      reason: `Similar to completed ticket "${bestMatch.subject}" - may be follow-up`,
    };
  }

  // Moderate similarity - could go either way
  if (bestMatch.similarity >= 60 && bestMatch.status === "active") {
    return {
      recommendation: "CREATE",
      confidence: 70,
      relatedTicketId: bestMatch.id,
      reason: `Possibly related to "${bestMatch.subject}" but may be new issue`,
    };
  }

  // Low similarity - create new
  return {
    recommendation: "CREATE",
    confidence: 85,
    reason: "Low similarity to existing tickets - likely new issue",
  };
}
