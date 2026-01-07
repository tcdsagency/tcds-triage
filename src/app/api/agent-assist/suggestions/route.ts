// API Route: /api/agent-assist/suggestions
// Generate AI-powered suggestions based on call context

import { NextRequest, NextResponse } from 'next/server';
import { getModelRouter } from '@/lib/ai/model-router';
import type { SuggestionsRequest, SuggestionsResponse, AgentSuggestion } from '@/lib/agent-assist/types';
import { PLAYBOOKS_BY_ID } from '@/lib/agent-assist/playbooks';

const SYSTEM_PROMPT = `You are an AI assistant helping insurance agency staff during customer calls. 
Analyze the conversation and provide helpful suggestions.

Generate 2-4 actionable suggestions from these categories:
- knowledge: Carrier-specific rules, coverage details, or policy information
- compliance: Required verifications, disclosures, or documentation
- upsell: Cross-sell opportunities or coverage enhancements 
- next_action: Specific next steps to take

For each suggestion:
1. Be specific and actionable
2. Keep it concise (1-2 sentences max)
3. Focus on what would help RIGHT NOW
4. Consider the customer's apparent needs

Respond in JSON format:
{
  "suggestions": [
    {
      "type": "knowledge|compliance|upsell|next_action",
      "title": "Short title (3-5 words)",
      "content": "The actionable suggestion",
      "confidence": 0.0-1.0
    }
  ]
}`;

export async function POST(request: NextRequest) {
  try {
    const body: SuggestionsRequest = await request.json();

    if (!body.transcript || body.transcript.length < 20) {
      return NextResponse.json({
        success: true,
        suggestions: [],
        tokensUsed: 0,
      });
    }

    // Build context for the AI
    let context = "CALL TRANSCRIPT (last portion):\n" + body.transcript.slice(-1500) + "\n\n";

    if (body.customerName) {
      context += "CUSTOMER: " + body.customerName + "\n";
    }

    if (body.policyInfo) {
      context += "POLICY INFO:\n";
      if (body.policyInfo.carrier) context += "- Carrier: " + body.policyInfo.carrier + "\n";
      if (body.policyInfo.policyNumber) context += "- Policy #: " + body.policyInfo.policyNumber + "\n";
      if (body.policyInfo.expirationDate) context += "- Expires: " + body.policyInfo.expirationDate + "\n";
    }

    if (body.currentPlaybook) {
      const playbook = PLAYBOOKS_BY_ID[body.currentPlaybook];
      if (playbook) {
        context += "\nCURRENT PLAYBOOK: " + playbook.title + "\n";
        context += "Key do items: " + playbook.do.slice(0, 3).join(", ") + "\n";
        context += "Key dont items: " + playbook.dont.slice(0, 2).join(", ") + "\n";
      }
    }

    const router = getModelRouter();
    const model = router.select('simple_classification');

    const result = await router.execute(
      model,
      [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: context },
      ],
      {
        temperature: 0.7,
        maxTokens: 800,
        responseFormat: 'json',
        endpoint: '/api/agent-assist/suggestions',
      }
    );

    // Parse AI response
    let suggestions: AgentSuggestion[] = [];
    try {
      const parsed = JSON.parse(result.content);
      suggestions = (parsed.suggestions || []).map((s: any, i: number) => ({
        id: "sug-" + Date.now() + "-" + i,
        type: s.type || 'next_action',
        title: s.title || 'Suggestion',
        content: s.content || '',
        confidence: Math.min(Math.max(s.confidence || 0.7, 0), 1),
        source: 'ai',
      }));
    } catch (parseErr) {
      console.error('[Agent Assist] Failed to parse AI response:', result.content);
      suggestions = [];
    }

    return NextResponse.json({
      success: true,
      suggestions,
      tokensUsed: result.tokensUsed,
    } as SuggestionsResponse);
  } catch (error: any) {
    console.error('[Agent Assist] Suggestions error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate suggestions', details: error.message, suggestions: [] },
      { status: 500 }
    );
  }
}
