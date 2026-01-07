/**
 * API Route: /api/ai/daily-tasks
 * Generate AI-powered daily task list for an agent
 * "Who should I call today?"
 */

import { NextRequest, NextResponse } from "next/server";
import { getAIOrchestrator } from "@/lib/ai/orchestrator";
import { db } from "@/db";
import { customers } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

interface DailyTasksRequest {
  agentId?: string;
  limit?: number;
}

export async function POST(request: NextRequest) {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    const body: DailyTasksRequest = await request.json();
    const agentId = body.agentId || "default";
    const limit = Math.min(body.limit || 50, 100);

    // Get customers to analyze
    const customerList = await db
      .select({ id: customers.id })
      .from(customers)
      .where(eq(customers.tenantId, tenantId))
      .orderBy(desc(customers.updatedAt))
      .limit(limit);

    const customerIds = customerList.map((c) => c.id);

    if (customerIds.length === 0) {
      return NextResponse.json({
        success: true,
        tasks: {
          date: new Date().toISOString().split("T")[0],
          agentId,
          tasks: [],
          summary: {
            totalTasks: 0,
            estimatedTime: 0,
            expectedRevenue: 0,
            retentionImpact: "No customers to analyze",
          },
        },
      });
    }

    const orchestrator = getAIOrchestrator();
    const result = await orchestrator.generateDailyTasks(agentId, tenantId, customerIds);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      tasks: result.data,
      model: result.model,
      tokensUsed: result.tokensUsed,
      latencyMs: result.latencyMs,
      cached: result.cached,
    });
  } catch (error: any) {
    console.error("[AI Daily Tasks] Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to generate daily tasks", details: error.message },
      { status: 500 }
    );
  }
}

// GET endpoint for quick access
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const agentId = searchParams.get("agentId") || "default";
  const limit = parseInt(searchParams.get("limit") || "50");

  // Redirect to POST with body
  return POST(
    new NextRequest(request.url, {
      method: "POST",
      body: JSON.stringify({ agentId, limit }),
      headers: { "Content-Type": "application/json" },
    })
  );
}
