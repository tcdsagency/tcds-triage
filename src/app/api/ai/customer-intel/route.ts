// API Route: /api/ai/customer-intel
// Extracts and stores customer intelligence from call transcripts
// Builds long-term customer profile for personalized interactions

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { customerIntel, customerPersonality, customers } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";

// =============================================================================
// TYPES
// =============================================================================

interface IntelExtractionRequest {
  customerId: string;
  transcript: string;
  sourceType: "call" | "note" | "email" | "historical";
  sourceId?: string;
  sourceDate?: string;
}

interface ExtractedFact {
  category: "family" | "occupation" | "life_event" | "vehicle" | "property" | "interest" | "preference" | "personality" | "concern" | "plan" | "other";
  fact: string;
  keywords: string[];
  confidence: number;
}

interface PersonalityIndicators {
  dominance: number; // 0-100: assertive, results-oriented
  influence: number; // 0-100: enthusiastic, collaborative
  steadiness: number; // 0-100: patient, reliable
  conscientiousness: number; // 0-100: analytical, detail-oriented
}

// =============================================================================
// AI EXTRACTION
// =============================================================================

async function extractIntelWithAI(
  transcript: string,
  customerName?: string
): Promise<{ facts: ExtractedFact[]; personality: PersonalityIndicators }> {
  if (!process.env.OPENAI_API_KEY) {
    return { facts: [], personality: { dominance: 50, influence: 50, steadiness: 50, conscientiousness: 50 } };
  }

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are an AI assistant that extracts personal information and personality indicators from customer conversations for CRM enrichment.

Extract ANY personal facts mentioned including:
- Family: spouse names, children (names, ages, schools), parents, siblings, pets (names, breeds)
- Occupation: job title, employer, industry, career changes
- Life Events: weddings, births, graduations, retirements, moves, deaths in family
- Vehicles: make, model, year of any cars, boats, motorcycles, RVs mentioned
- Property: homes owned/rented, vacation homes, rentals, recent purchases
- Interests: hobbies, sports, travel destinations, activities
- Preferences: communication style, best times to call, likes/dislikes
- Concerns: worries about coverage, budget, claims experience
- Plans: upcoming trips, purchases, life changes they're planning
- Other: anything notable about the customer

Also analyze personality based on DISC model:
- D (Dominance): Direct, results-oriented, decisive, competitive
- I (Influence): Enthusiastic, optimistic, collaborative, talkative
- S (Steadiness): Patient, reliable, team player, calm
- C (Conscientiousness): Analytical, detail-oriented, quality-focused

Return JSON:
{
  "facts": [
    {
      "category": "family|occupation|life_event|vehicle|property|interest|preference|personality|concern|plan|other",
      "fact": "Clear statement of the fact",
      "keywords": ["searchable", "terms"],
      "confidence": 0.9
    }
  ],
  "personality": {
    "dominance": 50,
    "influence": 50,
    "steadiness": 50,
    "conscientiousness": 50
  }
}

Be thorough - extract EVERY piece of personal information. Even small details help personalize future interactions.`
          },
          {
            role: "user",
            content: `Extract customer intelligence from this conversation${customerName ? ` with ${customerName}` : ""}:\n\n${transcript.substring(0, 4000)}`
          }
        ],
        max_tokens: 1500,
        temperature: 0.2
      })
    });

    if (response.ok) {
      const data = await response.json();
      const content = data.choices[0]?.message?.content || "{}";

      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          facts: parsed.facts || [],
          personality: parsed.personality || { dominance: 50, influence: 50, steadiness: 50, conscientiousness: 50 }
        };
      }
    }
  } catch (error) {
    console.error("[Customer Intel] AI extraction error:", error);
  }

  return { facts: [], personality: { dominance: 50, influence: 50, steadiness: 50, conscientiousness: 50 } };
}

// =============================================================================
// MAIN HANDLER
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    const body: IntelExtractionRequest = await request.json();
    const { customerId, transcript, sourceType, sourceId, sourceDate } = body;

    if (!customerId || !transcript) {
      return NextResponse.json({ success: false, error: "customerId and transcript required" }, { status: 400 });
    }

    const tenantId = process.env.DEFAULT_TENANT_ID || "00000000-0000-0000-0000-000000000001";

    // Get customer name for context
    const [customer] = await db
      .select({ firstName: customers.firstName, lastName: customers.lastName })
      .from(customers)
      .where(eq(customers.id, customerId))
      .limit(1);

    const customerName = customer ? `${customer.firstName} ${customer.lastName}`.trim() : undefined;

    console.log(`[Customer Intel] Extracting intelligence for ${customerName || customerId}`);

    // Extract with AI
    const { facts, personality } = await extractIntelWithAI(transcript, customerName);

    console.log(`[Customer Intel] Found ${facts.length} facts`);

    // Store extracted facts (avoid duplicates)
    let newFactsCount = 0;
    for (const fact of facts) {
      // Check if similar fact already exists
      const existing = await db
        .select({ id: customerIntel.id })
        .from(customerIntel)
        .where(
          and(
            eq(customerIntel.customerId, customerId),
            eq(customerIntel.category, fact.category),
            sql`LOWER(${customerIntel.fact}) = LOWER(${fact.fact})`
          )
        )
        .limit(1);

      if (existing.length === 0) {
        await db.insert(customerIntel).values({
          tenantId,
          customerId,
          category: fact.category,
          fact: fact.fact,
          keywords: fact.keywords,
          confidence: fact.confidence.toString(),
          sourceType,
          sourceId,
          sourceDate: sourceDate ? new Date(sourceDate) : new Date(),
        });
        newFactsCount++;
      }
    }

    // Update or create personality profile
    const [existingPersonality] = await db
      .select()
      .from(customerPersonality)
      .where(eq(customerPersonality.customerId, customerId))
      .limit(1);

    if (existingPersonality) {
      // Weighted average with existing scores (new data gets 30% weight)
      const weight = 0.3;
      const newDominance = Math.round((existingPersonality.dominance || 50) * (1 - weight) + personality.dominance * weight);
      const newInfluence = Math.round((existingPersonality.influence || 50) * (1 - weight) + personality.influence * weight);
      const newSteadiness = Math.round((existingPersonality.steadiness || 50) * (1 - weight) + personality.steadiness * weight);
      const newConscientiousness = Math.round((existingPersonality.conscientiousness || 50) * (1 - weight) + personality.conscientiousness * weight);

      // Determine primary/secondary types
      const scores = [
        { type: "Dominant", score: newDominance },
        { type: "Influential", score: newInfluence },
        { type: "Steady", score: newSteadiness },
        { type: "Conscientious", score: newConscientiousness }
      ].sort((a, b) => b.score - a.score);

      await db
        .update(customerPersonality)
        .set({
          dominance: newDominance,
          influence: newInfluence,
          steadiness: newSteadiness,
          conscientiousness: newConscientiousness,
          communicationStyle: scores[0].type,
          analysisCallCount: (existingPersonality.analysisCallCount || 0) + 1,
          updatedAt: new Date()
        })
        .where(eq(customerPersonality.customerId, customerId));
    } else {
      // Create new personality profile
      const scores = [
        { type: "Dominant", score: personality.dominance },
        { type: "Influential", score: personality.influence },
        { type: "Steady", score: personality.steadiness },
        { type: "Conscientious", score: personality.conscientiousness }
      ].sort((a, b) => b.score - a.score);

      await db.insert(customerPersonality).values({
        tenantId,
        customerId,
        dominance: personality.dominance,
        influence: personality.influence,
        steadiness: personality.steadiness,
        conscientiousness: personality.conscientiousness,
        communicationStyle: scores[0].type,
        analysisCallCount: 1
      });
    }

    return NextResponse.json({
      success: true,
      factsExtracted: facts.length,
      newFactsStored: newFactsCount,
      personalityUpdated: true
    });

  } catch (error) {
    console.error("[Customer Intel] Error:", error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Extraction failed"
    }, { status: 500 });
  }
}

// =============================================================================
// GET - Retrieve customer intelligence
// =============================================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get("customerId");

    if (!customerId) {
      return NextResponse.json({ success: false, error: "customerId required" }, { status: 400 });
    }

    // Get all intel facts
    const facts = await db
      .select()
      .from(customerIntel)
      .where(and(
        eq(customerIntel.customerId, customerId),
        eq(customerIntel.isActive, true)
      ))
      .orderBy(customerIntel.createdAt);

    // Get personality profile
    const [personality] = await db
      .select()
      .from(customerPersonality)
      .where(eq(customerPersonality.customerId, customerId))
      .limit(1);

    // Group facts by category
    const groupedFacts: Record<string, Array<{ fact: string; keywords: string[]; sourceDate?: string }>> = {};
    for (const f of facts) {
      if (!groupedFacts[f.category]) {
        groupedFacts[f.category] = [];
      }
      groupedFacts[f.category].push({
        fact: f.fact,
        keywords: (f.keywords as string[]) || [],
        sourceDate: f.sourceDate?.toISOString().split('T')[0]
      });
    }

    // Determine primary/secondary types from scores
    let primaryType = "";
    let secondaryType = "";
    if (personality) {
      const scores = [
        { type: "Dominant", score: personality.dominance || 50 },
        { type: "Influential", score: personality.influence || 50 },
        { type: "Steady", score: personality.steadiness || 50 },
        { type: "Conscientious", score: personality.conscientiousness || 50 }
      ].sort((a, b) => b.score - a.score);
      primaryType = scores[0].type;
      secondaryType = scores[1].type;
    }

    // Format personality for display
    const personalityProfile = personality ? {
      primaryType,
      secondaryType,
      scores: {
        dominance: personality.dominance || 50,
        influence: personality.influence || 50,
        steadiness: personality.steadiness || 50,
        conscientiousness: personality.conscientiousness || 50
      },
      description: getPersonalityDescription(primaryType),
      communicationTips: getCommunicationTips(primaryType),
      analysisCount: personality.analysisCallCount || 0
    } : null;

    return NextResponse.json({
      success: true,
      customerId,
      factCount: facts.length,
      facts: groupedFacts,
      personality: personalityProfile
    });

  } catch (error) {
    console.error("[Customer Intel] GET Error:", error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Retrieval failed"
    }, { status: 500 });
  }
}

// =============================================================================
// HELPER: Personality descriptions
// =============================================================================

function getPersonalityDescription(type: string): string {
  const descriptions: Record<string, string> = {
    "Dominant": "Direct, results-oriented person who values efficiency. Prefers quick, to-the-point conversations.",
    "Influential": "Enthusiastic and social person who enjoys building relationships. Appreciates friendly, personal interactions.",
    "Steady": "Patient and reliable person who values stability. Prefers a calm, supportive approach.",
    "Conscientious": "Analytical and detail-oriented person who values accuracy. Appreciates thorough explanations and data."
  };
  return descriptions[type] || "Balanced communication style.";
}

function getCommunicationTips(type: string): string[] {
  const tips: Record<string, string[]> = {
    "Dominant": [
      "Be direct and get to the point quickly",
      "Focus on results and bottom line",
      "Give them options and let them decide",
      "Respect their time"
    ],
    "Influential": [
      "Be friendly and personable",
      "Allow time for small talk",
      "Share enthusiasm about solutions",
      "Give public recognition when appropriate"
    ],
    "Steady": [
      "Be patient and allow time for decisions",
      "Provide reassurance and support",
      "Avoid rushing or pressuring",
      "Emphasize stability and reliability"
    ],
    "Conscientious": [
      "Provide detailed information",
      "Be prepared with facts and data",
      "Allow time for analysis",
      "Follow up in writing"
    ]
  };
  return tips[type] || ["Adapt communication style to their needs"];
}
