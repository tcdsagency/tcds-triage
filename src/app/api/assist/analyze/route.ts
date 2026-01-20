/**
 * AI Assist Analysis API Endpoint
 *
 * Analyzes live call transcripts using Claude to provide:
 * - Intent detection
 * - Script suggestions
 * - Compliance warnings
 * - Knowledge base recommendations
 * - Questions to ask
 */

import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { db } from '@/db';
import { knowledgeArticles } from '@/db/schema';
import { ilike, or, sql } from 'drizzle-orm';

// =============================================================================
// TYPES
// =============================================================================

interface AnalyzeRequest {
  callId: string;
  agentId: string;
  transcript: string;
  customerId?: string;
  customerContext?: {
    name?: string;
    isExisting?: boolean;
  };
  customerNotes?: string[];
  quickPrompt?: 'handle_objection' | 'close_sale' | 'find_upsell';
}

interface Suggestion {
  id: string;
  type: 'script' | 'question' | 'action' | 'upsell';
  priority: 'high' | 'medium' | 'low';
  title: string;
  content: string;
  context?: string;
}

interface ComplianceWarning {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  message: string;
  regulation?: string;
}

interface KnowledgeItem {
  id: string;
  title: string;
  summary: string;
  url?: string;
  category?: string;
}

interface AnalysisResult {
  intent: {
    label: string;
    confidence: number;
    reasoning?: string;
  } | null;
  suggestions: Suggestion[];
  compliance: ComplianceWarning[];
  knowledge: KnowledgeItem[];
  questionsToAsk: string[];
  detectedNeeds: string[];
}

// =============================================================================
// SYSTEM PROMPT
// =============================================================================

const SYSTEM_PROMPT = `You are an expert insurance customer service representative (CSR) assistant for TCDS Insurance, a licensed P&C agency in Alabama with 10+ years of experience. Your role is to analyze live call transcripts and provide real-time assistance to agents.

## Your Expertise
- **Alabama Insurance Regulations**: Minimum liability (25/50/25), MVR requirements, state-specific rules
- **Product Knowledge**: Personal auto, homeowners, umbrella, life, commercial lines
- **Sales Skills**: Consultative selling, objection handling, cross-selling, upselling
- **Compliance**: DOI regulations, E&O risk mitigation, proper disclosures

## Your Task
Analyze the conversation and provide actionable assistance:

1. **Intent Detection**: Identify what the customer is calling about
   - Common intents: add_vehicle, add_driver, quote_request, billing_inquiry, claim_report, policy_change, payment, id_cards, general_inquiry

2. **Suggested Responses**: Provide natural, conversational scripts
   - Keep scripts brief (1-3 sentences)
   - Use customer's name if known
   - Focus on solving their problem first

3. **Compliance Warnings**: Flag potential issues
   - Only flag real concerns (not every call needs warnings)
   - Be specific about what needs to be said/done

4. **Questions to Ask**: Identify information gaps
   - Only include questions relevant to the current situation
   - Prioritize by importance

5. **Cross-sell/Upsell**: Identify opportunities naturally
   - Only suggest when appropriate
   - Focus on customer value, not just sales

## Response Format
Respond with valid JSON only. Do not include any text outside the JSON object.

{
  "intent": {
    "label": "intent_name",
    "confidence": 0.95,
    "reasoning": "Brief explanation"
  },
  "suggestions": [
    {
      "id": "unique-id",
      "type": "script|question|action|upsell",
      "priority": "high|medium|low",
      "title": "Brief title",
      "content": "The actual script/question/action",
      "context": "Why this is relevant now"
    }
  ],
  "compliance": [
    {
      "id": "unique-id",
      "severity": "critical|warning|info",
      "title": "Issue title",
      "message": "What to do about it",
      "regulation": "Relevant regulation if applicable"
    }
  ],
  "questionsToAsk": ["Question 1?", "Question 2?"],
  "detectedNeeds": ["Need 1", "Need 2"]
}

## Guidelines
- Be concise and actionable
- Prioritize high-impact suggestions
- Don't overwhelm with too many suggestions (max 3-5 total)
- Use natural, conversational language in scripts
- Consider the customer's emotional state
- Remember: you're helping the agent, not talking to the customer directly`;

// =============================================================================
// QUICK PROMPT ADDITIONS
// =============================================================================

const QUICK_PROMPTS = {
  handle_objection: `
The agent needs help handling an objection from the customer. Based on the conversation, identify any objections and provide:
1. What the objection appears to be
2. Empathetic acknowledgment phrase
3. Value-focused response
4. Bridge to continue the conversation

Focus on understanding the customer's concern and addressing it directly.`,

  close_sale: `
The agent is ready to close the sale. Based on the conversation, provide:
1. Summary of what was discussed/quoted
2. Natural closing script that confirms the customer wants to proceed
3. Clear next steps to communicate
4. Any final questions to ask before binding

Keep it warm and assumptive, not pushy.`,

  find_upsell: `
Look for cross-sell and upsell opportunities in this conversation. Consider:
1. Policy types the customer doesn't have
2. Coverage gaps based on their situation
3. Natural ways to mention additional products
4. Value propositions for each opportunity

Only suggest genuinely valuable additions, not just sales opportunities.`,
};

// =============================================================================
// HELPER: Search knowledge base
// =============================================================================

async function searchKnowledgeBase(query: string): Promise<KnowledgeItem[]> {
  try {
    // Extract key terms from the query
    const terms = query
      .toLowerCase()
      .split(/\s+/)
      .filter((t) => t.length > 3)
      .slice(0, 5);

    if (terms.length === 0) return [];

    // Build search conditions
    const searchConditions = terms.map(
      (term) =>
        or(
          ilike(knowledgeArticles.title, `%${term}%`),
          ilike(knowledgeArticles.content, `%${term}%`),
          ilike(knowledgeArticles.tags, `%${term}%`)
        )
    );

    // Query knowledge base
    const articles = await db
      .select({
        id: knowledgeArticles.id,
        title: knowledgeArticles.title,
        content: knowledgeArticles.content,
        category: knowledgeArticles.category,
      })
      .from(knowledgeArticles)
      .where(or(...searchConditions))
      .limit(3);

    return articles.map((a) => ({
      id: a.id,
      title: a.title,
      summary: a.content?.slice(0, 200) + '...' || '',
      category: a.category || undefined,
    }));
  } catch (error) {
    console.error('[Assist] Knowledge base search error:', error);
    return [];
  }
}

// =============================================================================
// POST /api/assist/analyze
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    const body: AnalyzeRequest = await request.json();
    const { callId, agentId, transcript, customerContext, customerNotes, quickPrompt } = body;

    // Validate required fields
    if (!transcript || transcript.length < 20) {
      return NextResponse.json({
        success: true,
        analysis: {
          intent: null,
          suggestions: [],
          compliance: [],
          knowledge: [],
          questionsToAsk: [],
          detectedNeeds: [],
        },
      });
    }

    // Check for Anthropic API key
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      console.error('[Assist] ANTHROPIC_API_KEY not configured');
      return NextResponse.json(
        { success: false, error: 'AI service not configured' },
        { status: 500 }
      );
    }

    // Initialize Anthropic client
    const anthropic = new Anthropic({ apiKey });

    // Build user message
    let userMessage = `## Current Conversation\n${transcript}\n`;

    // Add customer context if available
    if (customerContext) {
      userMessage += `\n## Customer Context\n`;
      if (customerContext.name) {
        userMessage += `- Name: ${customerContext.name}\n`;
      }
      userMessage += `- Status: ${customerContext.isExisting ? 'Existing Customer' : 'New Prospect'}\n`;
    }

    // Add customer notes for personalization
    if (customerNotes && customerNotes.length > 0) {
      userMessage += `\n## Recent Notes from CRM (for personalization)\n`;
      customerNotes.slice(0, 5).forEach((note, i) => {
        userMessage += `${i + 1}. ${note.slice(0, 200)}\n`;
      });
    }

    // Add quick prompt if specified
    if (quickPrompt && QUICK_PROMPTS[quickPrompt]) {
      userMessage += `\n## Special Focus\n${QUICK_PROMPTS[quickPrompt]}`;
    }

    userMessage += `\n\nAnalyze this conversation and provide assistance. Respond with valid JSON only.`;

    // Call Claude API
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: userMessage,
        },
      ],
    });

    // Extract text content
    const textContent = response.content.find((c) => c.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text response from Claude');
    }

    // Parse JSON response
    let analysis: AnalysisResult;
    try {
      // Try to extract JSON from the response (in case there's extra text)
      const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }
      analysis = JSON.parse(jsonMatch[0]);
    } catch (parseError) {
      console.error('[Assist] Failed to parse Claude response:', textContent.text);
      throw new Error('Failed to parse AI response');
    }

    // Ensure all fields exist
    analysis = {
      intent: analysis.intent || null,
      suggestions: analysis.suggestions || [],
      compliance: analysis.compliance || [],
      knowledge: analysis.knowledge || [],
      questionsToAsk: analysis.questionsToAsk || [],
      detectedNeeds: analysis.detectedNeeds || [],
    };

    // Add IDs to suggestions if missing
    analysis.suggestions = analysis.suggestions.map((s, i) => ({
      ...s,
      id: s.id || `suggestion-${i}-${Date.now()}`,
    }));

    analysis.compliance = analysis.compliance.map((c, i) => ({
      ...c,
      id: c.id || `compliance-${i}-${Date.now()}`,
    }));

    // Search knowledge base for relevant articles
    if (analysis.intent?.label) {
      const kbResults = await searchKnowledgeBase(analysis.intent.label + ' ' + transcript.slice(-200));
      if (kbResults.length > 0) {
        analysis.knowledge = [...kbResults, ...analysis.knowledge].slice(0, 3);
      }
    }

    return NextResponse.json({
      success: true,
      analysis,
    });
  } catch (error) {
    console.error('[Assist] Analysis error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Analysis failed',
      },
      { status: 500 }
    );
  }
}
