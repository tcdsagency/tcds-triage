/**
 * API Route: /api/ai/compose-message
 * Compose personalized emails and SMS using AI
 */

import { NextRequest, NextResponse } from "next/server";
import { getAIOrchestrator } from "@/lib/ai/orchestrator";
import { MessageCompositionRequest } from "@/lib/ai/types";

export async function POST(request: NextRequest) {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    const body: MessageCompositionRequest = await request.json();

    if (!body.customerId || !body.type || !body.purpose) {
      return NextResponse.json(
        { success: false, error: "customerId, type, and purpose are required" },
        { status: 400 }
      );
    }

    const orchestrator = getAIOrchestrator();
    const result = await orchestrator.composeMessage(body, tenantId);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: result.data,
      model: result.model,
      tokensUsed: result.tokensUsed,
      latencyMs: result.latencyMs,
      cached: result.cached,
    });
  } catch (error: any) {
    console.error("[AI Compose Message] Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to compose message", details: error.message },
      { status: 500 }
    );
  }
}
