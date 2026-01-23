/**
 * AI Triage Recommendation Endpoint
 * ==================================
 * Generates AI-powered triage recommendations for pending items
 *
 * POST /api/triage/ai-recommend
 *
 * Returns: Suggested action (append/create/dismiss), confidence, related tickets,
 *          intent classification, entities, sentiment
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { wrapupDrafts, messages, customers, calls } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { getAgencyZoomClient } from "@/lib/api/agencyzoom";
import { VectorService } from "@/lib/ai/vector-service";
import Anthropic from "@anthropic-ai/sdk";

// =============================================================================
// TYPES
// =============================================================================

interface TriageRecommendRequest {
  itemId: string;
  itemType: "wrapup" | "message";
  customerId?: string;
  forceRefresh?: boolean;
}

interface RelatedTicket {
  ticketId: number;
  subject: string;
  similarity: number;
  csrName: string | null;
  stageName: string | null;
  createdAt: string;
  matchReasons: string[];
}

interface TriageRecommendation {
  suggestedAction: "append" | "create" | "dismiss";
  confidence: number;
  reasoning: string;
  relatedTickets: RelatedTicket[];
  intent: {
    primary: string;
    confidence: number;
    categoryId?: number;
  };
  entities: {
    policyNumbers: string[];
    vins: string[];
    amounts: string[];
    dates: string[];
    names: string[];
  };
  sentiment: {
    label: "positive" | "neutral" | "frustrated";
    urgency: "low" | "medium" | "high" | "critical";
    escalationNeeded: boolean;
    escalationReason?: string;
  };
  suggestedTicket?: {
    subject: string;
    categoryId: number;
    priorityId: number;
    description: string;
  };
}

// =============================================================================
// CLAUDE PROMPT
// =============================================================================

const TRIAGE_SYSTEM_PROMPT = `You are an insurance agency triage assistant analyzing incoming calls and messages.

Your task is to recommend ONE of three actions:
1. APPEND - This is a follow-up to an existing open ticket (same customer, same issue, additional information)
2. CREATE - This is a new distinct service request requiring a new ticket
3. DISMISS - No action needed (spam, wrong number, already resolved, informational only)

For your analysis, provide:
1. PRIMARY INTENT: What the caller wants (billing, claims, policy_change, quote, general_inquiry, payment, cancellation, add_vehicle, add_driver, certificate_request, id_card, endorsement, renewal, new_business)
2. ENTITIES: Extract any policy numbers, VINs, dollar amounts, dates mentioned
3. SENTIMENT: Is the caller positive, neutral, or frustrated? What's the urgency level?
4. RECOMMENDATION: Based on the summary and any existing open tickets provided, what action should be taken?

When comparing to existing tickets:
- If the summary mentions the same topic as an open ticket AND is from the same customer, recommend APPEND
- If the customer explicitly says "new issue" or the topic is clearly different, recommend CREATE
- If it's spam, wrong number, or already resolved on the call, recommend DISMISS

Return valid JSON only:
{
  "suggestedAction": "append" | "create" | "dismiss",
  "confidence": 0.0-1.0,
  "reasoning": "Brief explanation of your recommendation",
  "intent": {
    "primary": "category_name",
    "confidence": 0.0-1.0
  },
  "entities": {
    "policyNumbers": ["HO-123456"],
    "vins": ["1HGCM82633A004352"],
    "amounts": ["$150"],
    "dates": ["January 15"],
    "names": ["John Smith"]
  },
  "sentiment": {
    "label": "positive" | "neutral" | "frustrated",
    "urgency": "low" | "medium" | "high" | "critical",
    "escalationNeeded": boolean,
    "escalationReason": "optional reason if escalation needed"
  },
  "suggestedTicket": {
    "subject": "Brief ticket subject",
    "categoryId": 37341,
    "priorityId": 27902,
    "description": "Full description for ticket"
  }
}`;

// Category ID mapping for common intents
const INTENT_TO_CATEGORY: Record<string, number> = {
  billing: 37341,
  payment: 37341,
  claims: 37333,
  policy_change: 37340,
  add_vehicle: 82565,
  add_driver: 37337,
  cancellation: 53649,
  certificate_request: 37345,
  id_card: 37346,
  endorsement: 37340,
  renewal: 37349,
  general_inquiry: 37344,
  quote: 37352,
  new_business: 37352,
};

const PRIORITY_IDS = {
  urgent: 27900,
  high: 27901,
  standard: 27902,
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// =============================================================================
// POST HANDLER
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    const body: TriageRecommendRequest = await request.json();
    const { itemId, itemType, customerId, forceRefresh } = body;

    if (!itemId || !itemType) {
      return NextResponse.json(
        { success: false, error: "itemId and itemType are required" },
        { status: 400 }
      );
    }

    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json(
        { success: false, error: "Tenant not configured" },
        { status: 500 }
      );
    }

    // =========================================================================
    // 1. FETCH ITEM DETAILS
    // =========================================================================

    let itemSummary = "";
    let itemTranscript = "";
    let customerPhone = "";
    let customerName = "";
    let existingRecommendation: TriageRecommendation | null = null;
    let azCustomerId: string | null = customerId || null;

    if (itemType === "wrapup") {
      const [wrapup] = await db
        .select({
          id: wrapupDrafts.id,
          summary: wrapupDrafts.summary,
          aiCleanedSummary: wrapupDrafts.aiCleanedSummary,
          customerPhone: wrapupDrafts.customerPhone,
          customerName: wrapupDrafts.customerName,
          aiExtraction: wrapupDrafts.aiExtraction,
          aiTriageRecommendation: wrapupDrafts.aiTriageRecommendation,
          similarityComputedAt: wrapupDrafts.similarityComputedAt,
          callId: wrapupDrafts.callId,
        })
        .from(wrapupDrafts)
        .where(eq(wrapupDrafts.id, itemId))
        .limit(1);

      if (!wrapup) {
        return NextResponse.json(
          { success: false, error: "Wrapup not found" },
          { status: 404 }
        );
      }

      // Check if we have a cached recommendation and it's recent (< 1 hour)
      if (
        !forceRefresh &&
        wrapup.aiTriageRecommendation &&
        wrapup.similarityComputedAt &&
        Date.now() - new Date(wrapup.similarityComputedAt).getTime() < 3600000
      ) {
        existingRecommendation = wrapup.aiTriageRecommendation as TriageRecommendation;
      }

      itemSummary = wrapup.aiCleanedSummary || wrapup.summary || "";
      customerPhone = wrapup.customerPhone || "";
      customerName = wrapup.customerName || "";

      // Get transcript from call if available
      if (wrapup.callId) {
        const [call] = await db
          .select({ transcription: calls.transcription })
          .from(calls)
          .where(eq(calls.id, wrapup.callId))
          .limit(1);
        if (call?.transcription) {
          itemTranscript = call.transcription;
        }
      }

      // Extract agencyzoom customer ID from aiExtraction if present
      const extraction = wrapup.aiExtraction as Record<string, any> | null;
      if (extraction?.agencyzoomCustomerId) {
        azCustomerId = extraction.agencyzoomCustomerId;
      }
    } else if (itemType === "message") {
      const [message] = await db
        .select({
          id: messages.id,
          body: messages.body,
          fromNumber: messages.fromNumber,
          contactName: messages.contactName,
          contactId: messages.contactId,
        })
        .from(messages)
        .where(eq(messages.id, itemId))
        .limit(1);

      if (!message) {
        return NextResponse.json(
          { success: false, error: "Message not found" },
          { status: 404 }
        );
      }

      itemSummary = message.body || "";
      customerPhone = message.fromNumber || "";
      customerName = message.contactName || "";

      // Get customer if linked
      if (message.contactId) {
        const [customer] = await db
          .select({ agencyzoomId: customers.agencyzoomId })
          .from(customers)
          .where(eq(customers.id, message.contactId))
          .limit(1);
        if (customer?.agencyzoomId) {
          azCustomerId = customer.agencyzoomId;
        }
      }
    }

    // Return cached recommendation if available
    if (existingRecommendation) {
      return NextResponse.json({
        success: true,
        recommendation: existingRecommendation,
        cached: true,
        processingTimeMs: 0,
      });
    }

    // =========================================================================
    // 2. FETCH CUSTOMER'S OPEN TICKETS
    // =========================================================================

    const relatedTickets: RelatedTicket[] = [];
    let openTickets: any[] = [];

    if (azCustomerId) {
      try {
        const azClient = getAgencyZoomClient();
        const ticketsResponse = await azClient.getServiceTickets({
          status: 1, // Active tickets only
          limit: 20,
        });

        // Filter to tickets for this customer (by household ID or search)
        // AgencyZoom doesn't have a direct customerId filter, so we fetch and filter
        openTickets = ticketsResponse.data || [];
      } catch (error) {
        console.error("[AI Recommend] Error fetching tickets:", error);
      }
    }

    // =========================================================================
    // 3. CALCULATE SIMILARITY SCORES
    // =========================================================================

    let highestSimilarity = 0;

    if (openTickets.length > 0 && itemSummary) {
      try {
        const vectorService = new VectorService();
        const itemEmbedding = await vectorService.generateEmbedding(itemSummary);

        for (const ticket of openTickets) {
          const ticketText = `${ticket.subject || ""} ${ticket.serviceDesc || ""}`.trim();
          if (!ticketText) continue;

          const ticketEmbedding = await vectorService.generateEmbedding(ticketText);
          const similarity = cosineSimilarity(itemEmbedding, ticketEmbedding);

          if (similarity > 0.4) {
            const matchReasons: string[] = [];
            if (similarity >= 0.8) matchReasons.push("High topic similarity");
            else if (similarity >= 0.6) matchReasons.push("Moderate topic similarity");

            // Check if same category keywords
            const summaryLower = itemSummary.toLowerCase();
            const ticketLower = ticketText.toLowerCase();
            if (
              (summaryLower.includes("billing") && ticketLower.includes("billing")) ||
              (summaryLower.includes("payment") && ticketLower.includes("payment"))
            ) {
              matchReasons.push("Same category: billing");
            }
            if (
              (summaryLower.includes("claim") && ticketLower.includes("claim"))
            ) {
              matchReasons.push("Same category: claims");
            }

            relatedTickets.push({
              ticketId: ticket.id,
              subject: ticket.subject || "No subject",
              similarity: Math.round(similarity * 100) / 100,
              csrName: ticket.csrName || null,
              stageName: ticket.stageName || null,
              createdAt: ticket.createdAt || new Date().toISOString(),
              matchReasons,
            });

            if (similarity > highestSimilarity) {
              highestSimilarity = similarity;
            }
          }
        }

        // Sort by similarity descending
        relatedTickets.sort((a, b) => b.similarity - a.similarity);
      } catch (error) {
        console.error("[AI Recommend] Error calculating similarity:", error);
      }
    }

    // =========================================================================
    // 4. RUN CLAUDE ANALYSIS
    // =========================================================================

    const startTime = Date.now();
    let recommendation: TriageRecommendation;

    try {
      const anthropic = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY,
      });

      // Build context for Claude
      const ticketContext = relatedTickets.length > 0
        ? `\n\nEXISTING OPEN TICKETS FOR THIS CUSTOMER:\n${relatedTickets
            .slice(0, 5)
            .map((t, i) => `${i + 1}. Ticket #${t.ticketId}: "${t.subject}" (${Math.round(t.similarity * 100)}% similarity)`)
            .join("\n")}`
        : "\n\nNo existing open tickets found for this customer.";

      const userMessage = `INCOMING ${itemType.toUpperCase()}:
Customer: ${customerName || "Unknown"}
Phone: ${customerPhone || "Unknown"}

SUMMARY:
${itemSummary}

${itemTranscript ? `TRANSCRIPT EXCERPT:\n${itemTranscript.slice(0, 2000)}` : ""}
${ticketContext}

HIGHEST SIMILARITY SCORE: ${Math.round(highestSimilarity * 100)}%

Analyze this and provide your recommendation as JSON.`;

      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        system: TRIAGE_SYSTEM_PROMPT,
        messages: [{ role: "user", content: userMessage }],
      });

      // Parse Claude's response
      const responseText = response.content[0].type === "text"
        ? response.content[0].text
        : "";

      // Extract JSON from response (handle markdown code blocks)
      let jsonStr = responseText;
      const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1].trim();
      }

      const aiResult = JSON.parse(jsonStr);

      // Build final recommendation
      recommendation = {
        suggestedAction: aiResult.suggestedAction || "create",
        confidence: aiResult.confidence || 0.7,
        reasoning: aiResult.reasoning || "AI analysis completed",
        relatedTickets,
        intent: {
          primary: aiResult.intent?.primary || "general_inquiry",
          confidence: aiResult.intent?.confidence || 0.7,
          categoryId: INTENT_TO_CATEGORY[aiResult.intent?.primary] || 37344,
        },
        entities: {
          policyNumbers: aiResult.entities?.policyNumbers || [],
          vins: aiResult.entities?.vins || [],
          amounts: aiResult.entities?.amounts || [],
          dates: aiResult.entities?.dates || [],
          names: aiResult.entities?.names || [],
        },
        sentiment: {
          label: aiResult.sentiment?.label || "neutral",
          urgency: aiResult.sentiment?.urgency || "medium",
          escalationNeeded: aiResult.sentiment?.escalationNeeded || false,
          escalationReason: aiResult.sentiment?.escalationReason,
        },
        suggestedTicket: aiResult.suggestedTicket ? {
          subject: aiResult.suggestedTicket.subject || itemSummary.slice(0, 100),
          categoryId: aiResult.suggestedTicket.categoryId || INTENT_TO_CATEGORY[aiResult.intent?.primary] || 37344,
          priorityId: aiResult.suggestedTicket.priorityId || PRIORITY_IDS.standard,
          description: aiResult.suggestedTicket.description || itemSummary,
        } : undefined,
      };

      // Override AI suggestion based on similarity thresholds
      if (highestSimilarity >= 0.8 && relatedTickets.length > 0) {
        recommendation.suggestedAction = "append";
        recommendation.confidence = Math.max(recommendation.confidence, highestSimilarity);
        recommendation.reasoning = `High similarity (${Math.round(highestSimilarity * 100)}%) to existing ticket - likely a follow-up.`;
      } else if (highestSimilarity < 0.5 && recommendation.suggestedAction === "append") {
        // Don't suggest append if similarity is low
        recommendation.suggestedAction = "create";
        recommendation.reasoning = "Low similarity to existing tickets - this appears to be a new issue.";
      }

    } catch (error) {
      console.error("[AI Recommend] Claude error:", error);

      // Fallback recommendation based on similarity alone
      recommendation = {
        suggestedAction: highestSimilarity >= 0.8 ? "append" : "create",
        confidence: highestSimilarity >= 0.8 ? highestSimilarity : 0.6,
        reasoning: highestSimilarity >= 0.8
          ? "High similarity to existing ticket detected"
          : "No strong matches found - recommend creating new ticket",
        relatedTickets,
        intent: {
          primary: "general_inquiry",
          confidence: 0.5,
          categoryId: 37344,
        },
        entities: {
          policyNumbers: [],
          vins: [],
          amounts: [],
          dates: [],
          names: [],
        },
        sentiment: {
          label: "neutral",
          urgency: "medium",
          escalationNeeded: false,
        },
      };
    }

    const processingTimeMs = Date.now() - startTime;

    // =========================================================================
    // 5. CACHE RECOMMENDATION
    // =========================================================================

    if (itemType === "wrapup") {
      await db
        .update(wrapupDrafts)
        .set({
          aiTriageRecommendation: recommendation,
          similarityComputedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(wrapupDrafts.id, itemId));
    }

    return NextResponse.json({
      success: true,
      recommendation,
      cached: false,
      processingTimeMs,
    });

  } catch (error) {
    console.error("[AI Recommend] Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to generate recommendation" },
      { status: 500 }
    );
  }
}
