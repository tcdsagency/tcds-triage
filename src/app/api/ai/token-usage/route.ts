import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { aiTokenUsage, aiTokenUsageDaily } from "@/db/schema";
import { eq, and, gte, lte, desc, sql, sum, count } from "drizzle-orm";

// =============================================================================
// TYPES
// =============================================================================

interface TokenUsageRecord {
  provider: "openai" | "anthropic" | "google";
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCostCents?: number;
  endpoint?: string;
  userId?: string;
  requestDurationMs?: number;
  success?: boolean;
  errorMessage?: string;
}

// Cost per 1K tokens (in cents) - Updated pricing
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
  const costs = TOKEN_COSTS[model] || { input: 0.1, output: 0.3 }; // Default fallback
  const inputCost = (promptTokens / 1000) * costs.input;
  const outputCost = (completionTokens / 1000) * costs.output;
  return Math.round((inputCost + outputCost) * 100); // Convert to cents
}

// =============================================================================
// GET /api/ai/token-usage - Get token usage stats
// =============================================================================
export async function GET(request: NextRequest) {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID || "00000000-0000-0000-0000-000000000001";
    const { searchParams } = new URL(request.url);

    const period = searchParams.get("period") || "30d"; // 7d, 30d, 90d, all
    const provider = searchParams.get("provider"); // openai, anthropic, google
    const groupBy = searchParams.get("groupBy") || "day"; // day, model, provider

    // Calculate date range
    const now = new Date();
    let startDate: Date;
    switch (period) {
      case "7d":
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "30d":
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case "90d":
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(0); // All time
    }

    // Build conditions
    const conditions = [
      eq(aiTokenUsageDaily.tenantId, tenantId),
      gte(aiTokenUsageDaily.date, startDate.toISOString().split("T")[0]),
    ];

    if (provider && ["openai", "anthropic", "google"].includes(provider)) {
      conditions.push(eq(aiTokenUsageDaily.provider, provider as "openai" | "anthropic" | "google"));
    }

    // Get daily aggregates
    const dailyStats = await db
      .select({
        date: aiTokenUsageDaily.date,
        provider: aiTokenUsageDaily.provider,
        model: aiTokenUsageDaily.model,
        requestCount: aiTokenUsageDaily.requestCount,
        promptTokens: aiTokenUsageDaily.promptTokens,
        completionTokens: aiTokenUsageDaily.completionTokens,
        totalTokens: aiTokenUsageDaily.totalTokens,
        estimatedCostCents: aiTokenUsageDaily.estimatedCostCents,
        errorCount: aiTokenUsageDaily.errorCount,
        avgDurationMs: aiTokenUsageDaily.avgDurationMs,
      })
      .from(aiTokenUsageDaily)
      .where(and(...conditions))
      .orderBy(desc(aiTokenUsageDaily.date));

    // Calculate totals
    const totals = {
      requests: 0,
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      estimatedCostCents: 0,
      errors: 0,
    };

    const byProvider: Record<string, typeof totals> = {};
    const byModel: Record<string, typeof totals> = {};
    const byDay: Record<string, typeof totals> = {};

    dailyStats.forEach((row) => {
      // Overall totals
      totals.requests += row.requestCount || 0;
      totals.promptTokens += row.promptTokens || 0;
      totals.completionTokens += row.completionTokens || 0;
      totals.totalTokens += row.totalTokens || 0;
      totals.estimatedCostCents += row.estimatedCostCents || 0;
      totals.errors += row.errorCount || 0;

      // By provider
      if (!byProvider[row.provider]) {
        byProvider[row.provider] = { requests: 0, promptTokens: 0, completionTokens: 0, totalTokens: 0, estimatedCostCents: 0, errors: 0 };
      }
      byProvider[row.provider].requests += row.requestCount || 0;
      byProvider[row.provider].promptTokens += row.promptTokens || 0;
      byProvider[row.provider].completionTokens += row.completionTokens || 0;
      byProvider[row.provider].totalTokens += row.totalTokens || 0;
      byProvider[row.provider].estimatedCostCents += row.estimatedCostCents || 0;
      byProvider[row.provider].errors += row.errorCount || 0;

      // By model
      if (!byModel[row.model]) {
        byModel[row.model] = { requests: 0, promptTokens: 0, completionTokens: 0, totalTokens: 0, estimatedCostCents: 0, errors: 0 };
      }
      byModel[row.model].requests += row.requestCount || 0;
      byModel[row.model].promptTokens += row.promptTokens || 0;
      byModel[row.model].completionTokens += row.completionTokens || 0;
      byModel[row.model].totalTokens += row.totalTokens || 0;
      byModel[row.model].estimatedCostCents += row.estimatedCostCents || 0;
      byModel[row.model].errors += row.errorCount || 0;

      // By day
      const dateStr = row.date;
      if (!byDay[dateStr]) {
        byDay[dateStr] = { requests: 0, promptTokens: 0, completionTokens: 0, totalTokens: 0, estimatedCostCents: 0, errors: 0 };
      }
      byDay[dateStr].requests += row.requestCount || 0;
      byDay[dateStr].promptTokens += row.promptTokens || 0;
      byDay[dateStr].completionTokens += row.completionTokens || 0;
      byDay[dateStr].totalTokens += row.totalTokens || 0;
      byDay[dateStr].estimatedCostCents += row.estimatedCostCents || 0;
      byDay[dateStr].errors += row.errorCount || 0;
    });

    // Format daily data for charts
    const chartData = Object.entries(byDay)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, data]) => ({
        date,
        ...data,
        estimatedCost: data.estimatedCostCents / 100,
      }));

    return NextResponse.json({
      success: true,
      period,
      totals: {
        ...totals,
        estimatedCost: totals.estimatedCostCents / 100, // Convert to dollars
      },
      byProvider: Object.entries(byProvider).map(([provider, data]) => ({
        provider,
        ...data,
        estimatedCost: data.estimatedCostCents / 100,
      })),
      byModel: Object.entries(byModel)
        .sort((a, b) => b[1].totalTokens - a[1].totalTokens)
        .map(([model, data]) => ({
          model,
          ...data,
          estimatedCost: data.estimatedCostCents / 100,
        })),
      chartData,
    });
  } catch (error) {
    console.error("Error fetching token usage:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch token usage" },
      { status: 500 }
    );
  }
}

// =============================================================================
// POST /api/ai/token-usage - Record token usage (internal use)
// =============================================================================
export async function POST(request: NextRequest) {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID || "00000000-0000-0000-0000-000000000001";
    const body: TokenUsageRecord = await request.json();

    const {
      provider,
      model,
      promptTokens,
      completionTokens,
      totalTokens,
      endpoint,
      userId,
      requestDurationMs,
      success = true,
      errorMessage,
    } = body;

    if (!provider || !model) {
      return NextResponse.json(
        { success: false, error: "Provider and model are required" },
        { status: 400 }
      );
    }

    // Calculate cost if not provided
    const estimatedCostCents = body.estimatedCostCents ?? calculateCost(model, promptTokens, completionTokens);

    // Insert individual record
    await db.insert(aiTokenUsage).values({
      tenantId,
      provider,
      model,
      promptTokens: promptTokens || 0,
      completionTokens: completionTokens || 0,
      totalTokens: totalTokens || promptTokens + completionTokens || 0,
      estimatedCostCents,
      endpoint,
      userId,
      requestDurationMs,
      success,
      errorMessage,
    });

    // Update daily aggregate (upsert)
    const today = new Date().toISOString().split("T")[0];

    await db
      .insert(aiTokenUsageDaily)
      .values({
        tenantId,
        date: today,
        provider,
        model,
        requestCount: 1,
        promptTokens: promptTokens || 0,
        completionTokens: completionTokens || 0,
        totalTokens: totalTokens || promptTokens + completionTokens || 0,
        estimatedCostCents,
        errorCount: success ? 0 : 1,
        avgDurationMs: requestDurationMs,
      })
      .onConflictDoUpdate({
        target: [aiTokenUsageDaily.tenantId, aiTokenUsageDaily.date, aiTokenUsageDaily.provider, aiTokenUsageDaily.model],
        set: {
          requestCount: sql`${aiTokenUsageDaily.requestCount} + 1`,
          promptTokens: sql`${aiTokenUsageDaily.promptTokens} + ${promptTokens || 0}`,
          completionTokens: sql`${aiTokenUsageDaily.completionTokens} + ${completionTokens || 0}`,
          totalTokens: sql`${aiTokenUsageDaily.totalTokens} + ${totalTokens || promptTokens + completionTokens || 0}`,
          estimatedCostCents: sql`${aiTokenUsageDaily.estimatedCostCents} + ${estimatedCostCents}`,
          errorCount: success ? aiTokenUsageDaily.errorCount : sql`${aiTokenUsageDaily.errorCount} + 1`,
          avgDurationMs: requestDurationMs
            ? sql`(COALESCE(${aiTokenUsageDaily.avgDurationMs}, 0) * ${aiTokenUsageDaily.requestCount} + ${requestDurationMs}) / (${aiTokenUsageDaily.requestCount} + 1)`
            : aiTokenUsageDaily.avgDurationMs,
          updatedAt: new Date(),
        },
      });

    return NextResponse.json({
      success: true,
      message: "Token usage recorded",
    });
  } catch (error) {
    console.error("Error recording token usage:", error);
    return NextResponse.json(
      { success: false, error: "Failed to record token usage" },
      { status: 500 }
    );
  }
}
