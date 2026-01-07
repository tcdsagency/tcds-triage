/**
 * API Route: /api/ai/call-qa
 * Automated quality assurance review for completed calls
 */

import { NextRequest, NextResponse } from "next/server";
import { getAIOrchestrator } from "@/lib/ai/orchestrator";

interface CallQARequest {
  callId: string;
  transcript: string;
  outcome?: string;
}

export async function POST(request: NextRequest) {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    const body: CallQARequest = await request.json();
    const { callId, transcript, outcome } = body;

    if (!callId || !transcript) {
      return NextResponse.json(
        { success: false, error: "callId and transcript are required" },
        { status: 400 }
      );
    }

    const orchestrator = getAIOrchestrator();
    const result = await orchestrator.reviewCall(
      callId,
      transcript,
      outcome || "unknown",
      tenantId
    );

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      review: result.data,
      model: result.model,
      tokensUsed: result.tokensUsed,
      latencyMs: result.latencyMs,
      cached: result.cached,
    });
  } catch (error: any) {
    console.error("[AI Call QA] Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to review call", details: error.message },
      { status: 500 }
    );
  }
}
