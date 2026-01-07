/**
 * AI Orchestrator
 * ================
 * Central coordinator for all AI operations
 * Manages context, caching, model selection, and logging
 */

import { getContextManager, ContextManager } from "./context-manager";
import { getModelRouter, ModelRouter } from "./model-router";
import {
  AIRequest,
  AIResponse,
  AIContext,
  AITaskType,
  AIModel,
  ChurnPrediction,
  CrossSellPrediction,
  ComposedMessage,
  MessageCompositionRequest,
  CallAnalysis,
  CallQAReview,
  PredictedTask,
  DailyTaskList,
} from "./types";

// Simple in-memory cache (use Redis in production)
const cache = new Map<string, { data: any; expires: number }>();

export class AIOrchestrator {
  private contextManager: ContextManager;
  private modelRouter: ModelRouter;

  constructor() {
    this.contextManager = getContextManager();
    this.modelRouter = getModelRouter();
  }

  // ===========================================================================
  // CORE METHODS
  // ===========================================================================

  /**
   * Execute an AI request with full context
   */
  async execute<T = any>(request: AIRequest): Promise<AIResponse<T>> {
    const startTime = Date.now();

    try {
      // Build cache key
      const cacheKey = this.buildCacheKey(request);

      // Check cache
      if (!request.options?.forceRefresh) {
        const cached = this.getFromCache<T>(cacheKey);
        if (cached) {
          return {
            success: true,
            data: cached,
            model: "gpt-4o-mini" as AIModel,
            tokensUsed: 0,
            latencyMs: Date.now() - startTime,
            cached: true,
          };
        }
      }

      // Execute based on task type
      const result = await this.modelRouter.executeWithFallback(
        request.type,
        this.buildMessages(request),
        {
          temperature: request.options?.temperature,
          maxTokens: request.options?.maxTokens,
          forceModel: request.options?.model,
        }
      );

      // Parse response
      const data = this.parseResponse<T>(result.content, request.type);

      // Cache result
      this.setCache(cacheKey, data, 3600); // 1 hour TTL

      return {
        success: true,
        data,
        model: result.model,
        tokensUsed: result.tokensUsed,
        latencyMs: Date.now() - startTime,
        cached: false,
      };
    } catch (error: any) {
      console.error("[AIOrchestrator] Error:", error);
      return {
        success: false,
        error: error.message,
        model: "gpt-4o-mini",
        tokensUsed: 0,
        latencyMs: Date.now() - startTime,
        cached: false,
      };
    }
  }

  // ===========================================================================
  // CHURN PREDICTION
  // ===========================================================================

  /**
   * Predict churn risk for a customer
   */
  async predictChurn(
    customerId: string,
    tenantId: string
  ): Promise<AIResponse<ChurnPrediction>> {
    const context = await this.contextManager.build({ customerId, tenantId });

    if (!context.customer) {
      return {
        success: false,
        error: "Customer not found",
        model: "gpt-4o-mini",
        tokensUsed: 0,
        latencyMs: 0,
        cached: false,
      };
    }

    const systemPrompt = `You are an insurance retention analyst. Analyze customer data to predict churn risk.

Return JSON with this structure:
{
  "score": 0.0-1.0 (probability of churning in next 90 days),
  "confidence": 0.0-1.0,
  "riskLevel": "low" | "medium" | "high" | "critical",
  "factors": [{ "factor": "string", "impact": -1 to 1, "description": "string" }],
  "recommendation": "string",
  "suggestedActions": ["string"],
  "retentionScript": "string (what to say to retain this customer)"
}`;

    const userPrompt = `Analyze this customer's churn risk:

${this.contextManager.summarizeContext(context)}

Customer Details:
- Name: ${context.customer.name}
- Client Level: ${context.customer.clientLevel}${context.customer.isOG ? " (OG Customer)" : ""}
- Customer Since: ${context.customer.customerSince || "Unknown"}
- Total Premium: $${context.customer.totalPremium}/year
- Policies: ${context.customer.policies.length}
- Engagement Score: ${context.customer.engagementScore?.toFixed(2) || "Unknown"}
- Last Contact: ${context.customer.lastContact || "Unknown"}

Policies:
${context.customer.policies
  .map((p) => `- ${p.type}: ${p.carrier} - $${p.premium}/yr (expires ${p.expirationDate})`)
  .join("\n")}

Recent Interactions (last 30 days): ${context.customer.recentInteractions?.length || 0}

Consider these churn factors:
- Policy expiration timing
- Rate increases
- Claim activity
- Engagement decline
- Competitor shopping signals
- Life events (moving, etc.)

Return the churn analysis JSON.`;

    return this.execute<ChurnPrediction>({
      type: "complex_reasoning",
      input: userPrompt,
      context,
      options: {
        model: "gpt-4o",
        temperature: 0.3,
        maxTokens: 1000,
      },
    });
  }

  // ===========================================================================
  // CROSS-SELL PREDICTION
  // ===========================================================================

  /**
   * Predict cross-sell opportunities for a customer
   */
  async predictCrossSell(
    customerId: string,
    tenantId: string
  ): Promise<AIResponse<CrossSellPrediction[]>> {
    const context = await this.contextManager.build({ customerId, tenantId });

    if (!context.customer) {
      return {
        success: false,
        error: "Customer not found",
        model: "gpt-4o-mini",
        tokensUsed: 0,
        latencyMs: 0,
        cached: false,
      };
    }

    const currentPolicyTypes = context.customer.policies.map((p) => p.type);

    const systemPrompt = `You are an insurance cross-sell analyst. Identify products the customer doesn't have but would benefit from.

Return JSON array with structure:
[{
  "product": "string",
  "probability": 0.0-1.0,
  "expectedRevenue": number,
  "confidence": 0.0-1.0,
  "reasoning": "string",
  "timing": "immediate" | "renewal" | "next_contact" | "future",
  "approach": "string",
  "talkingPoints": ["string"]
}]`;

    const userPrompt = `Identify cross-sell opportunities:

${this.contextManager.summarizeContext(context)}

Current Policies: ${currentPolicyTypes.join(", ")}
Total Premium: $${context.customer.totalPremium}/year
Client Level: ${context.customer.clientLevel}

Consider these products:
- Umbrella (if has auto + home, premium > $3K)
- Life (if has family indicators)
- Flood (if has home in flood zone)
- Renters (if renting)
- Motorcycle/RV/Boat (recreational)
- Commercial (if business indicators)

Only suggest products they don't have. Return JSON array.`;

    return this.execute<CrossSellPrediction[]>({
      type: "structured_output",
      input: userPrompt,
      context,
      options: {
        model: "gpt-4o",
        temperature: 0.3,
        maxTokens: 1500,
      },
    });
  }

  // ===========================================================================
  // MESSAGE COMPOSITION
  // ===========================================================================

  /**
   * Compose a personalized message
   */
  async composeMessage(
    request: MessageCompositionRequest,
    tenantId: string
  ): Promise<AIResponse<ComposedMessage>> {
    const context = await this.contextManager.build({
      customerId: request.customerId,
      tenantId,
    });

    if (!context.customer) {
      return {
        success: false,
        error: "Customer not found",
        model: "gpt-4o-mini",
        tokensUsed: 0,
        latencyMs: 0,
        cached: false,
      };
    }

    const systemPrompt = `You are an insurance agency communication specialist. Write personalized, professional messages.

Return JSON:
{
  "subject": "string (for email only)",
  "body": "string",
  "tone": "formal" | "friendly" | "brief",
  "personalization": ["what made it personal"],
  "callsToAction": ["actions customer should take"],
  "alternatives": [{ "tone": "string", "body": "string" }]
}`;

    const purposeInstructions: Record<string, string> = {
      renewal_reminder: "Remind about upcoming renewal, mention any savings found",
      claim_update: "Provide claim status update, empathetic tone",
      welcome: "Welcome new customer, introduce yourself and services",
      followup: "Follow up on previous conversation",
      quote_followup: "Follow up on quote provided, ask if questions",
      payment_reminder: "Gentle payment reminder, offer assistance",
      general: "Professional general communication",
    };

    const userPrompt = `Compose a ${request.type} message for ${request.purpose}:

Customer: ${context.customer.name}
${context.customer.clientLevel} Customer${context.customer.isOG ? " (OG Member)" : ""}
Premium: $${context.customer.totalPremium}/year
Last Contact: ${context.customer.lastContact || "Unknown"}

Purpose: ${purposeInstructions[request.purpose] || request.purpose}

${request.context ? `Additional Context: ${JSON.stringify(request.context)}` : ""}

Tone: ${request.tone || "friendly"}

Requirements:
- Keep ${request.type === "sms" ? "under 160 characters" : "concise but complete"}
- Be warm but professional
- Include clear call to action
- Personalize based on customer data

Return the message JSON.`;

    return this.execute<ComposedMessage>({
      type: "creative_writing",
      input: userPrompt,
      context,
      options: {
        model: "claude-3-5-sonnet",
        temperature: 0.7,
        maxTokens: 1000,
      },
    });
  }

  // ===========================================================================
  // CALL ANALYSIS
  // ===========================================================================

  /**
   * Analyze a call transcript segment in real-time
   */
  async analyzeCallSegment(
    transcript: string,
    customerId: string | null,
    tenantId: string
  ): Promise<AIResponse<CallAnalysis>> {
    const context = customerId
      ? await this.contextManager.build({ customerId, tenantId })
      : { temporal: this.contextManager["getTemporalContext"]() };

    const systemPrompt = `You are a real-time call analysis assistant. Analyze transcript segments for sentiment, intent, and provide guidance.

Return JSON:
{
  "sentiment": { "score": -1 to 1, "label": "negative"|"neutral"|"positive", "confidence": 0-1 },
  "intent": { "primary": "string", "confidence": 0-1, "secondary": ["string"] },
  "urgency": "low" | "medium" | "high" | "critical",
  "suggestedResponses": [{ "response": "string", "reasoning": "string", "tone": "string" }],
  "alerts": [{ "type": "string", "message": "string", "severity": "info"|"warning"|"critical", "action": "string" }],
  "escalation": { "shouldEscalate": boolean, "reason": "string", "escalateTo": "string", "escalateIf": "string" }
}`;

    const userPrompt = `Analyze this call transcript segment:

"${transcript}"

${context.customer ? `Customer Context:\n${this.contextManager.summarizeContext(context as AIContext)}` : "No customer context available."}

Identify:
1. Customer sentiment and emotional state
2. Primary intent (quote_request, claim_inquiry, policy_change, cancellation, complaint, general_question)
3. Any urgent issues requiring immediate attention
4. Suggested responses for the agent
5. Any alerts (retention risk, compliance issues, escalation needs)

Return the analysis JSON.`;

    return this.execute<CallAnalysis>({
      type: "sentiment_analysis",
      input: userPrompt,
      context: context as AIContext,
      options: {
        model: "gpt-4o-mini",
        temperature: 0.2,
        maxTokens: 800,
      },
    });
  }

  // ===========================================================================
  // CALL QA
  // ===========================================================================

  /**
   * Review a completed call for quality assurance
   */
  async reviewCall(
    callId: string,
    transcript: string,
    outcome: string,
    tenantId: string
  ): Promise<AIResponse<CallQAReview>> {
    const systemPrompt = `You are an insurance call center QA analyst. Review calls for quality, compliance, and coaching opportunities.

Return JSON:
{
  "callId": "string",
  "scores": {
    "overall": 1-10,
    "greeting": 1-10,
    "activeListening": 1-10,
    "productKnowledge": 1-10,
    "objectionHandling": 1-10,
    "closing": 1-10,
    "compliance": 1-10
  },
  "strengths": ["string"],
  "improvements": [{ "area": "string", "issue": "string", "example": "string", "suggestion": "string", "trainingResource": "string" }],
  "compliance": { "passed": boolean, "checks": [{ "item": "string", "passed": boolean, "note": "string" }] },
  "coachingOpportunities": ["string"],
  "flaggedForReview": boolean,
  "managerSummary": "string"
}`;

    const userPrompt = `Review this call for quality:

Call ID: ${callId}
Outcome: ${outcome}

Transcript:
${transcript}

Evaluate:
1. Greeting and rapport building
2. Active listening and empathy
3. Product/process knowledge
4. Objection handling
5. Closing technique
6. Compliance (identity verification, disclosures)

Provide constructive feedback for agent improvement.
Return the QA review JSON.`;

    return this.execute<CallQAReview>({
      type: "complex_reasoning",
      input: userPrompt,
      options: {
        model: "gpt-4o",
        temperature: 0.3,
        maxTokens: 1500,
      },
    });
  }

  // ===========================================================================
  // TASK GENERATION
  // ===========================================================================

  /**
   * Generate prioritized task list for an agent
   */
  async generateDailyTasks(
    agentId: string,
    tenantId: string,
    customerIds: string[]
  ): Promise<AIResponse<DailyTaskList>> {
    // Build context for multiple customers
    const customerContexts = await Promise.all(
      customerIds.slice(0, 50).map((id) =>
        this.contextManager.getCustomerContext(id, tenantId)
      )
    );

    const validCustomers = customerContexts.filter((c) => c !== null);

    const systemPrompt = `You are an insurance agency task prioritization AI. Generate an optimized daily task list based on customer data.

Return JSON:
{
  "date": "YYYY-MM-DD",
  "agentId": "string",
  "tasks": [{
    "type": "retention_call" | "cross_sell" | "claim_followup" | "renewal_review" | "general_outreach",
    "customerId": "string",
    "customerName": "string",
    "priority": "urgent" | "high" | "medium" | "low",
    "reasoning": "string",
    "estimatedDuration": number (minutes),
    "expectedOutcome": { "success": 0-1, "revenue": number, "retention": 0-1 },
    "preparation": ["string"],
    "script": "string",
    "dueBy": "YYYY-MM-DD"
  }],
  "summary": {
    "totalTasks": number,
    "estimatedTime": number (minutes),
    "expectedRevenue": number,
    "retentionImpact": "string"
  }
}`;

    const customerSummaries = validCustomers.map((c) => ({
      id: c!.customerId,
      name: c!.name,
      clientLevel: c!.clientLevel,
      premium: c!.totalPremium,
      lastContact: c!.lastContact,
      policyCount: c!.policies.length,
      expiringPolicies: c!.policies.filter((p) => {
        const exp = new Date(p.expirationDate);
        const daysUntil = (exp.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
        return daysUntil > 0 && daysUntil <= 60;
      }).length,
    }));

    const userPrompt = `Generate today's task list for agent ${agentId}.

Date: ${new Date().toISOString().split("T")[0]}

Customers to consider (${validCustomers.length}):
${customerSummaries
  .map(
    (c) =>
      `- ${c.name} (${c.clientLevel}): $${c.premium}/yr, ${c.policyCount} policies, ${c.expiringPolicies} expiring, last contact: ${c.lastContact || "never"}`
  )
  .join("\n")}

Prioritize:
1. Retention risks (expiring policies, no recent contact)
2. High-value customers (AAA, high premium)
3. Cross-sell opportunities
4. Follow-ups needed

Generate 10-15 prioritized tasks with scripts and preparation steps.
Return the task list JSON.`;

    return this.execute<DailyTaskList>({
      type: "complex_reasoning",
      input: userPrompt,
      options: {
        model: "gpt-4o",
        temperature: 0.3,
        maxTokens: 3000,
      },
    });
  }

  // ===========================================================================
  // HELPER METHODS
  // ===========================================================================

  private buildCacheKey(request: AIRequest): string {
    const inputStr = typeof request.input === "string" ? request.input : JSON.stringify(request.input);
    const hash = this.simpleHash(inputStr);
    return `ai:${request.type}:${hash}`;
  }

  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  private getFromCache<T>(key: string): T | null {
    const cached = cache.get(key);
    if (cached && cached.expires > Date.now()) {
      return cached.data as T;
    }
    cache.delete(key);
    return null;
  }

  private setCache(key: string, data: any, ttlSeconds: number): void {
    cache.set(key, {
      data,
      expires: Date.now() + ttlSeconds * 1000,
    });
  }

  private buildMessages(
    request: AIRequest
  ): Array<{ role: "system" | "user" | "assistant"; content: string }> {
    return [
      {
        role: "system",
        content: `You are an AI assistant for an insurance agency. Always return valid JSON when requested.`,
      },
      {
        role: "user",
        content: typeof request.input === "string" ? request.input : JSON.stringify(request.input),
      },
    ];
  }

  private parseResponse<T>(content: string, taskType: AITaskType): T {
    // Try to extract JSON from the response
    try {
      // Look for JSON in the response
      const jsonMatch = content.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]) as T;
      }
      // If no JSON found, return content as-is
      return content as unknown as T;
    } catch (error) {
      console.error("[AIOrchestrator] JSON parse error:", error);
      return content as unknown as T;
    }
  }
}

// Singleton instance
let orchestrator: AIOrchestrator | null = null;

export function getAIOrchestrator(): AIOrchestrator {
  if (!orchestrator) {
    orchestrator = new AIOrchestrator();
  }
  return orchestrator;
}
