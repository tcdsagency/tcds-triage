/**
 * API Route: /api/ai/index
 * Index content for semantic search
 */

import { NextRequest, NextResponse } from "next/server";
import { getVectorService, EmbeddingType } from "@/lib/ai/vector-service";

interface IndexRequest {
  type: "customer" | "call";
  id: string;
}

interface BulkIndexRequest {
  customers?: string[];
  calls?: string[];
}

// Index a single item
export async function POST(request: NextRequest) {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    const body: IndexRequest = await request.json();
    const { type, id } = body;

    if (!type || !id) {
      return NextResponse.json(
        { success: false, error: "type and id are required" },
        { status: 400 }
      );
    }

    const vectorService = getVectorService();
    let embeddingId: string | null = null;

    switch (type) {
      case "customer":
        embeddingId = await vectorService.indexCustomer(id, tenantId);
        break;
      case "call":
        embeddingId = await vectorService.indexCall(id, tenantId);
        break;
      default:
        return NextResponse.json(
          { success: false, error: `Unknown type: ${type}` },
          { status: 400 }
        );
    }

    if (!embeddingId) {
      return NextResponse.json(
        { success: false, error: `Failed to index ${type}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      embeddingId,
      type,
      sourceId: id,
    });
  } catch (error: any) {
    console.error("[AI Index] Error:", error);
    return NextResponse.json(
      { success: false, error: "Indexing failed", details: error.message },
      { status: 500 }
    );
  }
}

// Bulk index multiple items
export async function PUT(request: NextRequest) {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    const body: BulkIndexRequest = await request.json();
    const vectorService = getVectorService();
    const results: { type: string; id: string; success: boolean; embeddingId?: string }[] = [];

    // Index customers
    if (body.customers) {
      for (const id of body.customers.slice(0, 100)) {
        try {
          const embeddingId = await vectorService.indexCustomer(id, tenantId);
          results.push({ type: "customer", id, success: !!embeddingId, embeddingId: embeddingId || undefined });
        } catch (error) {
          results.push({ type: "customer", id, success: false });
        }
      }
    }

    // Index calls
    if (body.calls) {
      for (const id of body.calls.slice(0, 100)) {
        try {
          const embeddingId = await vectorService.indexCall(id, tenantId);
          results.push({ type: "call", id, success: !!embeddingId, embeddingId: embeddingId || undefined });
        } catch (error) {
          results.push({ type: "call", id, success: false });
        }
      }
    }

    const successCount = results.filter((r) => r.success).length;

    return NextResponse.json({
      success: true,
      indexed: successCount,
      total: results.length,
      results,
    });
  } catch (error: any) {
    console.error("[AI Bulk Index] Error:", error);
    return NextResponse.json(
      { success: false, error: "Bulk indexing failed", details: error.message },
      { status: 500 }
    );
  }
}
