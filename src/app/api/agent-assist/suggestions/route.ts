// API Route: /api/agent-assist/suggestions
// Generate AI-powered suggestions based on call context

import { NextRequest, NextResponse } from "next/server";
import { getPlaybookById } from "@/lib/agent-assist/playbooks";
import {
  AgentSuggestion,
  SuggestionsRequest,
  SuggestionsResponse,
  SuggestionType,
} from "@/lib/agent-assist/types";

// =============================================================================
// POST - Generate AI Suggestions
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    const body: SuggestionsRequest = await request.json();
    const { transcript, customerProfile, currentPlaybook } = body;

    if (!transcript || transcript.trim().length === 0) {
      return NextResponse.json<SuggestionsResponse>({
        success: false,
        suggestions: [],
        error: "Transcript is required",
      }, { status: 400 });
    }

    // Get playbook context if available
    const playbook = currentPlaybook ? getPlaybookById(currentPlaybook) : null;

    // Check if we have OpenAI API key
    if (!process.env.OPENAI_API_KEY) {
      // Return contextual suggestions without AI
      const mockSuggestions = generateContextualSuggestions(transcript, customerProfile, playbook?.name);
      return NextResponse.json<SuggestionsResponse>({
        success: true,
        suggestions: mockSuggestions,
        tokensUsed: 0,
      });
    }

    // Generate AI suggestions using OpenAI
    const suggestions = await generateAISuggestions(transcript, customerProfile, playbook);

    return NextResponse.json<SuggestionsResponse>({
      success: true,
      suggestions,
      tokensUsed: 0, // Will be populated from API response
    });

  } catch (error: any) {
    console.error("[Agent Assist] Suggestions error:", error);
    return NextResponse.json<SuggestionsResponse>({
      success: false,
      suggestions: [],
      error: error.message || "Failed to generate suggestions",
    }, { status: 500 });
  }
}

// =============================================================================
// AI SUGGESTION GENERATION
// =============================================================================

async function generateAISuggestions(
  transcript: string,
  customerProfile?: SuggestionsRequest["customerProfile"],
  playbook?: { name: string; domain: string } | null
): Promise<AgentSuggestion[]> {
  const recentTranscript = transcript.slice(-1500); // Last 1500 chars

  const prompt = `You are an AI assistant helping an insurance agency CSR during a live call. Based on the conversation context, provide helpful suggestions.

CALL CONTEXT:
${playbook ? `Current Scenario: ${playbook.name}` : ""}
${customerProfile?.name ? `Customer: ${customerProfile.name}` : ""}
${customerProfile?.policyTypes?.length ? `Their Policies: ${customerProfile.policyTypes.join(", ")}` : ""}
${customerProfile?.tenure ? `Customer Since: ${customerProfile.tenure}` : ""}

RECENT CONVERSATION:
${recentTranscript}

Provide 2-4 helpful suggestions in JSON array format. Each suggestion should have:
- id: unique string
- type: one of "knowledge", "compliance", "upsell", "next_action"
- title: short 3-7 word title
- content: helpful tip or information (1-2 sentences)
- confidence: 0.0 to 1.0
- source: where this info comes from (optional)
- actionLabel: button label if action available (optional)

Types explained:
- knowledge: carrier rules, coverage info, policy details
- compliance: verification reminders, regulatory requirements
- upsell: cross-sell or coverage upgrade opportunities
- next_action: suggested next steps in the conversation

Important:
- Be specific and actionable
- Avoid generic suggestions
- Focus on what's relevant NOW in the call
- Consider the customer's existing policies for cross-sell

Respond with ONLY a JSON array, no other text.`;

  try {
    const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are an expert insurance agency AI assistant. Always respond with valid JSON arrays only.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.5,
        max_tokens: 800,
      }),
    });

    const completion = await openaiResponse.json();
    const responseText = completion.choices?.[0]?.message?.content || "";

    // Parse the JSON response
    try {
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const suggestions = JSON.parse(jsonMatch[0]) as AgentSuggestion[];
        // Ensure each suggestion has required fields
        return suggestions.map((s, i) => ({
          id: s.id || `ai-suggestion-${i}`,
          type: validateSuggestionType(s.type),
          title: s.title || "Suggestion",
          content: s.content || "",
          confidence: typeof s.confidence === "number" ? s.confidence : 0.7,
          source: s.source,
          actionLabel: s.actionLabel,
        }));
      }
    } catch (parseError) {
      console.error("[Agent Assist] Failed to parse AI suggestions:", parseError);
    }

    // Fallback to contextual suggestions
    return generateContextualSuggestions(transcript, customerProfile, playbook?.name);

  } catch (error) {
    console.error("[Agent Assist] OpenAI API error:", error);
    return generateContextualSuggestions(transcript, customerProfile, playbook?.name);
  }
}

function validateSuggestionType(type: any): SuggestionType {
  const validTypes: SuggestionType[] = ["knowledge", "compliance", "upsell", "next_action"];
  if (validTypes.includes(type)) {
    return type;
  }
  return "knowledge";
}

// =============================================================================
// CONTEXTUAL SUGGESTIONS (Fallback when no AI)
// =============================================================================

function generateContextualSuggestions(
  transcript: string,
  customerProfile?: SuggestionsRequest["customerProfile"],
  playbookName?: string
): AgentSuggestion[] {
  const suggestions: AgentSuggestion[] = [];
  const lowerTranscript = transcript.toLowerCase();

  // Always add compliance reminder
  suggestions.push({
    id: "compliance-verify",
    type: "compliance",
    title: "Verify Customer Identity",
    content: "Remember to verify the caller's identity before discussing account details.",
    confidence: 0.9,
  });

  // Quote-related suggestions
  if (lowerTranscript.includes("quote") || lowerTranscript.includes("rate") || lowerTranscript.includes("price")) {
    suggestions.push({
      id: "knowledge-quote",
      type: "knowledge",
      title: "Quote Best Practices",
      content: "Gather VIN, driver info, and desired coverage limits before running quotes.",
      confidence: 0.85,
    });
  }

  // Payment-related suggestions
  if (lowerTranscript.includes("payment") || lowerTranscript.includes("pay") || lowerTranscript.includes("bill")) {
    suggestions.push({
      id: "next-action-payment",
      type: "next_action",
      title: "Offer Payment Options",
      content: "Remind customer about autopay option for convenience and to avoid missed payments.",
      confidence: 0.8,
      actionLabel: "Open Payment Portal",
    });
  }

  // Claim-related suggestions
  if (lowerTranscript.includes("claim") || lowerTranscript.includes("accident") || lowerTranscript.includes("damage")) {
    suggestions.push({
      id: "compliance-claims",
      type: "compliance",
      title: "Claims Documentation",
      content: "Collect incident date, location, police report number (if applicable), and photos.",
      confidence: 0.9,
    });
  }

  // Cross-sell opportunities based on customer profile
  if (customerProfile?.policyTypes) {
    const policies = customerProfile.policyTypes.map(p => p.toLowerCase());

    if (policies.includes("auto") && !policies.includes("umbrella")) {
      suggestions.push({
        id: "upsell-umbrella",
        type: "upsell",
        title: "Umbrella Coverage",
        content: "Customer has auto but no umbrella policy. Consider mentioning extra liability protection.",
        confidence: 0.75,
      });
    }

    if (policies.includes("homeowners") && !policies.includes("flood")) {
      suggestions.push({
        id: "upsell-flood",
        type: "upsell",
        title: "Flood Insurance",
        content: "Homeowners insurance doesn't cover flood damage. Ask if they're in a flood zone.",
        confidence: 0.7,
      });
    }

    if (!policies.includes("auto") && !policies.includes("homeowners")) {
      suggestions.push({
        id: "upsell-bundle",
        type: "upsell",
        title: "Multi-Policy Discount",
        content: "Bundling auto and home insurance could save the customer 10-25%.",
        confidence: 0.8,
      });
    }
  }

  // Policy change suggestions
  if (
    lowerTranscript.includes("add") ||
    lowerTranscript.includes("remove") ||
    lowerTranscript.includes("change") ||
    lowerTranscript.includes("update")
  ) {
    suggestions.push({
      id: "compliance-changes",
      type: "compliance",
      title: "Document All Changes",
      content: "Confirm changes verbally and note the effective date. Some changes may require signatures.",
      confidence: 0.85,
    });
  }

  // Frustrated customer detection
  if (
    lowerTranscript.includes("frustrated") ||
    lowerTranscript.includes("upset") ||
    lowerTranscript.includes("ridiculous") ||
    lowerTranscript.includes("terrible") ||
    lowerTranscript.includes("cancel")
  ) {
    suggestions.push({
      id: "next-action-deescalate",
      type: "next_action",
      title: "De-escalation Needed",
      content: "Customer seems frustrated. Acknowledge their concerns and focus on finding a resolution.",
      confidence: 0.9,
    });
  }

  // Renewal suggestions
  if (lowerTranscript.includes("renew") || lowerTranscript.includes("renewal") || lowerTranscript.includes("expir")) {
    suggestions.push({
      id: "knowledge-renewal",
      type: "knowledge",
      title: "Renewal Review",
      content: "Review any changes in coverage or premium. Check for new discounts they may qualify for.",
      confidence: 0.85,
    });
  }

  // Limit to 4 suggestions
  return suggestions.slice(0, 4);
}
