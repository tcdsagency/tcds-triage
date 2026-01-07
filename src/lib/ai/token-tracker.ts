/**
 * AI Token Usage Tracker
 * Helper functions to track token usage across all AI providers
 */

type AIProvider = "openai" | "anthropic" | "google";

interface TokenUsageParams {
  provider: AIProvider;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens?: number;
  endpoint?: string;
  userId?: string;
  requestDurationMs?: number;
  success?: boolean;
  errorMessage?: string;
}

/**
 * Track AI token usage - fire and forget
 * This function is non-blocking and won't throw errors
 */
export async function trackTokenUsage(params: TokenUsageParams): Promise<void> {
  try {
    // Fire and forget - don't await in production to avoid blocking
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "";

    // Only track if we're in a server context with a valid base URL
    if (typeof window === "undefined" && baseUrl) {
      fetch(`${baseUrl}/api/ai/token-usage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...params,
          totalTokens: params.totalTokens ?? params.promptTokens + params.completionTokens,
        }),
      }).catch((err) => {
        console.error("[TokenTracker] Failed to record usage:", err.message);
      });
    } else {
      // In dev/local, use relative URL with internal fetch
      const url = "/api/ai/token-usage";
      // Queue for later if needed
      console.log("[TokenTracker] Usage:", params.provider, params.model, params.totalTokens ?? params.promptTokens + params.completionTokens, "tokens");
    }
  } catch (error) {
    // Never throw - this is fire-and-forget
    console.error("[TokenTracker] Error:", error);
  }
}

/**
 * Track token usage directly to database (for server-side use)
 * Use this when you have direct DB access
 */
export async function trackTokenUsageDirect(
  db: any,
  tenantId: string,
  params: TokenUsageParams
): Promise<void> {
  try {
    const { aiTokenUsage, aiTokenUsageDaily } = await import("@/db/schema");
    const { sql } = await import("drizzle-orm");

    const totalTokens = params.totalTokens ?? params.promptTokens + params.completionTokens;
    const estimatedCostCents = calculateCost(params.model, params.promptTokens, params.completionTokens);
    const today = new Date().toISOString().split("T")[0];

    // Insert individual record
    await db.insert(aiTokenUsage).values({
      tenantId,
      provider: params.provider,
      model: params.model,
      promptTokens: params.promptTokens || 0,
      completionTokens: params.completionTokens || 0,
      totalTokens,
      estimatedCostCents,
      endpoint: params.endpoint,
      userId: params.userId,
      requestDurationMs: params.requestDurationMs,
      success: params.success ?? true,
      errorMessage: params.errorMessage,
    });

    // Update daily aggregate
    await db
      .insert(aiTokenUsageDaily)
      .values({
        tenantId,
        date: today,
        provider: params.provider,
        model: params.model,
        requestCount: 1,
        promptTokens: params.promptTokens || 0,
        completionTokens: params.completionTokens || 0,
        totalTokens,
        estimatedCostCents,
        errorCount: params.success === false ? 1 : 0,
        avgDurationMs: params.requestDurationMs,
      })
      .onConflictDoUpdate({
        target: [aiTokenUsageDaily.tenantId, aiTokenUsageDaily.date, aiTokenUsageDaily.provider, aiTokenUsageDaily.model],
        set: {
          requestCount: sql`${aiTokenUsageDaily.requestCount} + 1`,
          promptTokens: sql`${aiTokenUsageDaily.promptTokens} + ${params.promptTokens || 0}`,
          completionTokens: sql`${aiTokenUsageDaily.completionTokens} + ${params.completionTokens || 0}`,
          totalTokens: sql`${aiTokenUsageDaily.totalTokens} + ${totalTokens}`,
          estimatedCostCents: sql`${aiTokenUsageDaily.estimatedCostCents} + ${estimatedCostCents}`,
          errorCount: params.success === false ? sql`${aiTokenUsageDaily.errorCount} + 1` : aiTokenUsageDaily.errorCount,
          updatedAt: new Date(),
        },
      });
  } catch (error) {
    console.error("[TokenTracker] DB Error:", error);
  }
}

// Cost per 1K tokens (in cents)
const TOKEN_COSTS: Record<string, { input: number; output: number }> = {
  // OpenAI
  "gpt-4o": { input: 0.25, output: 1.0 },
  "gpt-4o-mini": { input: 0.015, output: 0.06 },
  "gpt-4-turbo": { input: 1.0, output: 3.0 },
  "gpt-4": { input: 3.0, output: 6.0 },
  "gpt-3.5-turbo": { input: 0.05, output: 0.15 },
  // Anthropic
  "claude-3-5-sonnet-20241022": { input: 0.3, output: 1.5 },
  "claude-3-opus-20240229": { input: 1.5, output: 7.5 },
  "claude-3-haiku-20240307": { input: 0.025, output: 0.125 },
  // Google
  "gemini-1.5-pro": { input: 0.125, output: 0.5 },
  "gemini-1.5-flash": { input: 0.0075, output: 0.03 },
};

function calculateCost(model: string, promptTokens: number, completionTokens: number): number {
  const costs = TOKEN_COSTS[model] || { input: 0.1, output: 0.3 };
  const inputCost = (promptTokens / 1000) * costs.input;
  const outputCost = (completionTokens / 1000) * costs.output;
  return Math.round((inputCost + outputCost) * 100);
}
