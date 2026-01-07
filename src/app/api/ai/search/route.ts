/**
 * API Route: /api/ai/search
 * Semantic search using embeddings and RAG
 */

import { NextRequest, NextResponse } from "next/server";
import { getVectorService } from "@/lib/ai/vector-service";

interface SearchRequest {
  query: string;
  type?: "customer" | "policy" | "call" | "document" | "note" | "knowledge";
  limit?: number;
  answerQuestion?: boolean;
}

export async function POST(request: NextRequest) {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    const body: SearchRequest = await request.json();
    const { query, type, limit = 10, answerQuestion = false } = body;

    if (!query) {
      return NextResponse.json(
        { success: false, error: "query is required" },
        { status: 400 }
      );
    }

    const vectorService = getVectorService();

    // If answerQuestion is true, use RAG to generate an answer
    if (answerQuestion) {
      const result = await vectorService.answerQuestion(query, tenantId);
      return NextResponse.json({
        success: true,
        answer: result.answer,
        sources: result.sources,
      });
    }

    // Otherwise, just perform semantic search
    const results = await vectorService.search(query, tenantId, { type, limit });

    return NextResponse.json({
      success: true,
      results,
      count: results.length,
    });
  } catch (error: any) {
    console.error("[AI Search] Error:", error);
    return NextResponse.json(
      { success: false, error: "Search failed", details: error.message },
      { status: 500 }
    );
  }
}

// GET endpoint for quick searches
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q") || searchParams.get("query");
  const type = searchParams.get("type") as SearchRequest["type"];
  const limit = parseInt(searchParams.get("limit") || "10");

  if (!query) {
    return NextResponse.json(
      { success: false, error: "query parameter (q) is required" },
      { status: 400 }
    );
  }

  return POST(
    new NextRequest(request.url, {
      method: "POST",
      body: JSON.stringify({ query, type, limit }),
      headers: { "Content-Type": "application/json" },
    })
  );
}
