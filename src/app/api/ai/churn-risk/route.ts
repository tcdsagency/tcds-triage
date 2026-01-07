/**
 * API Route: /api/ai/churn-risk
 * Predict churn risk for a customer using AI
 */

import { NextRequest, NextResponse } from "next/server";
import { getAIOrchestrator } from "@/lib/ai/orchestrator";

interface ChurnRiskRequest {
  customerId: string;
}

export async function POST(request: NextRequest) {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    const body: ChurnRiskRequest = await request.json();
    const { customerId } = body;

    if (!customerId) {
      return NextResponse.json(
        { success: false, error: "customerId is required" },
        { status: 400 }
      );
    }

    const orchestrator = getAIOrchestrator();
    const result = await orchestrator.predictChurn(customerId, tenantId);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      prediction: result.data,
      model: result.model,
      tokensUsed: result.tokensUsed,
      latencyMs: result.latencyMs,
      cached: result.cached,
    });
  } catch (error: any) {
    console.error("[AI Churn Risk] Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to predict churn risk", details: error.message },
      { status: 500 }
    );
  }
}
