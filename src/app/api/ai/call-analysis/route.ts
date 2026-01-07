/**
 * API Route: /api/ai/call-analysis
 * Real-time call transcript analysis for sentiment, intent, and suggestions
 */

import { NextRequest, NextResponse } from "next/server";
import { getAIOrchestrator } from "@/lib/ai/orchestrator";

interface CallAnalysisRequest {
  transcript: string;
  customerId?: string;
}

export async function POST(request: NextRequest) {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    const body: CallAnalysisRequest = await request.json();
    const { transcript, customerId } = body;

    if (!transcript) {
      return NextResponse.json(
        { success: false, error: "transcript is required" },
        { status: 400 }
      );
    }

    // Limit transcript length for real-time analysis
    const limitedTranscript = transcript.slice(-2000);

    const orchestrator = getAIOrchestrator();
    const result = await orchestrator.analyzeCallSegment(
      limitedTranscript,
      customerId || null,
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
      analysis: result.data,
      model: result.model,
      tokensUsed: result.tokensUsed,
      latencyMs: result.latencyMs,
      cached: result.cached,
    });
  } catch (error: any) {
    console.error("[AI Call Analysis] Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to analyze call", details: error.message },
      { status: 500 }
    );
  }
}
