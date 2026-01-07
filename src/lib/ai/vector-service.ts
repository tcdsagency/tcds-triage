/**
 * Vector Service for Semantic Search
 * ====================================
 * Handles embeddings generation and similarity search
 */

import { db } from "@/db";
import { embeddings, customers, policies, calls } from "@/db/schema";
import { eq, and, sql, desc } from "drizzle-orm";
import { createHash } from "crypto";
import { SemanticSearchResult, SearchQuery } from "./types";

// =============================================================================
// TYPES
// =============================================================================

export type EmbeddingType = "customer" | "policy" | "call" | "document" | "note" | "knowledge";

interface IndexRequest {
  tenantId: string;
  type: EmbeddingType;
  sourceId: string;
  sourceTable: string;
  content: string;
  metadata?: Record<string, any>;
}

// =============================================================================
// VECTOR SERVICE
// =============================================================================

export class VectorService {
  private openaiApiKey: string | undefined;

  constructor() {
    this.openaiApiKey = process.env.OPENAI_API_KEY;
  }

  // ===========================================================================
  // EMBEDDING GENERATION
  // ===========================================================================

  /**
   * Generate embedding for text using OpenAI
   */
  async generateEmbedding(text: string): Promise<number[]> {
    if (!this.openaiApiKey) {
      throw new Error("OPENAI_API_KEY not configured");
    }

    const response = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.openaiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "text-embedding-3-small",
        input: text.slice(0, 8000), // Limit input length
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI embeddings error: ${response.status} ${error}`);
    }

    const data = await response.json();
    return data.data[0].embedding;
  }

  /**
   * Generate content hash for deduplication
   */
  private hashContent(content: string): string {
    return createHash("sha256").update(content).digest("hex").slice(0, 32);
  }

  // ===========================================================================
  // INDEXING
  // ===========================================================================

  /**
   * Index a piece of content for semantic search
   */
  async index(request: IndexRequest): Promise<string> {
    const contentHash = this.hashContent(request.content);

    // Check if already indexed
    const existing = await db
      .select({ id: embeddings.id })
      .from(embeddings)
      .where(
        and(
          eq(embeddings.tenantId, request.tenantId),
          eq(embeddings.contentHash, contentHash)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      return existing[0].id;
    }

    // Generate embedding
    const embedding = await this.generateEmbedding(request.content);

    // Store in database
    const [result] = await db
      .insert(embeddings)
      .values({
        tenantId: request.tenantId,
        type: request.type,
        sourceId: request.sourceId,
        sourceTable: request.sourceTable,
        content: request.content,
        contentHash,
        metadata: request.metadata,
        embeddingJson: embedding,
        model: "text-embedding-3-small",
        dimensions: 1536,
      })
      .returning({ id: embeddings.id });

    return result.id;
  }

  /**
   * Index a customer for semantic search
   */
  async indexCustomer(customerId: string, tenantId: string): Promise<string | null> {
    try {
      const [customer] = await db
        .select()
        .from(customers)
        .where(and(eq(customers.id, customerId), eq(customers.tenantId, tenantId)))
        .limit(1);

      if (!customer) return null;

      // Build searchable content
      const address = customer.address as { street?: string; city?: string; state?: string; zip?: string } | null;
      const content = [
        `Customer: ${customer.firstName} ${customer.lastName}`,
        customer.email ? `Email: ${customer.email}` : "",
        customer.phone ? `Phone: ${customer.phone}` : "",
        address?.street ? `Address: ${address.street}` : "",
        address?.city && address?.state ? `Location: ${address.city}, ${address.state}` : "",
      ]
        .filter(Boolean)
        .join("\n");

      return this.index({
        tenantId,
        type: "customer",
        sourceId: customerId,
        sourceTable: "customers",
        content,
        metadata: {
          name: `${customer.firstName} ${customer.lastName}`,
          email: customer.email,
          phone: customer.phone,
        },
      });
    } catch (error) {
      console.error("[VectorService] Error indexing customer:", error);
      return null;
    }
  }

  /**
   * Index a call transcript for semantic search
   */
  async indexCall(callId: string, tenantId: string): Promise<string | null> {
    try {
      const [call] = await db
        .select()
        .from(calls)
        .where(eq(calls.id, callId))
        .limit(1);

      if (!call || !call.transcription) return null;

      const content = [
        `Call on ${call.createdAt?.toLocaleDateString()}`,
        call.aiSummary ? `Summary: ${call.aiSummary}` : "",
        `Transcript: ${call.transcription.slice(0, 5000)}`,
      ]
        .filter(Boolean)
        .join("\n");

      return this.index({
        tenantId,
        type: "call",
        sourceId: callId,
        sourceTable: "calls",
        content,
        metadata: {
          date: call.createdAt?.toISOString(),
          duration: call.durationSeconds,
          direction: call.direction,
        },
      });
    } catch (error) {
      console.error("[VectorService] Error indexing call:", error);
      return null;
    }
  }

  // ===========================================================================
  // SEARCH
  // ===========================================================================

  /**
   * Semantic search across indexed content
   */
  async search(
    query: string,
    tenantId: string,
    options?: {
      type?: EmbeddingType;
      limit?: number;
    }
  ): Promise<SemanticSearchResult[]> {
    // Generate query embedding
    const queryEmbedding = await this.generateEmbedding(query);

    // Build conditions
    const conditions = [eq(embeddings.tenantId, tenantId)];
    if (options?.type) {
      conditions.push(eq(embeddings.type, options.type));
    }

    // For now, use a simple cosine similarity calculation in SQL
    // In production, use pgvector's <=> operator for better performance
    const limit = options?.limit || 10;

    // Get all embeddings (in production, use pgvector index)
    const results = await db
      .select({
        id: embeddings.id,
        type: embeddings.type,
        sourceId: embeddings.sourceId,
        content: embeddings.content,
        metadata: embeddings.metadata,
        embeddingJson: embeddings.embeddingJson,
      })
      .from(embeddings)
      .where(and(...conditions))
      .limit(100); // Get more than needed for filtering

    // Calculate similarity scores
    const scoredResults = results
      .map((r) => {
        const embedding = r.embeddingJson as number[] | null;
        if (!embedding) return null;

        const similarity = this.cosineSimilarity(queryEmbedding, embedding);
        return {
          ...r,
          relevance: similarity,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null && r.relevance > 0.3)
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, limit);

    // Format results
    return scoredResults.map((r) => ({
      id: r.sourceId,
      type: r.type,
      title: this.extractTitle(r.content, r.type),
      content: r.content.slice(0, 500),
      relevance: r.relevance,
      metadata: (r.metadata as Record<string, any>) || {},
      quickActions: this.getQuickActions(r.type),
    }));
  }

  /**
   * Answer a question using RAG (Retrieval Augmented Generation)
   */
  async answerQuestion(
    question: string,
    tenantId: string
  ): Promise<{ answer: string; sources: SemanticSearchResult[] }> {
    // Search for relevant context
    const sources = await this.search(question, tenantId, { limit: 5 });

    if (sources.length === 0) {
      return {
        answer: "I couldn't find any relevant information to answer your question.",
        sources: [],
      };
    }

    // Build context from sources
    const context = sources.map((s) => s.content).join("\n\n---\n\n");

    // Generate answer with LLM
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      return {
        answer: "AI service not configured.",
        sources,
      };
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are a helpful insurance agency assistant. Answer questions based on the provided context. Be concise and accurate. If you're not sure, say so.`,
          },
          {
            role: "user",
            content: `Context:\n${context}\n\nQuestion: ${question}`,
          },
        ],
        max_tokens: 500,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      return {
        answer: "Failed to generate answer.",
        sources,
      };
    }

    const data = await response.json();
    return {
      answer: data.choices[0]?.message?.content || "No answer generated.",
      sources,
    };
  }

  // ===========================================================================
  // HELPERS
  // ===========================================================================

  /**
   * Calculate cosine similarity between two vectors
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
    return magnitude === 0 ? 0 : dotProduct / magnitude;
  }

  /**
   * Extract a title from content
   */
  private extractTitle(content: string, type: EmbeddingType): string {
    const firstLine = content.split("\n")[0];
    if (firstLine.length > 100) {
      return firstLine.slice(0, 100) + "...";
    }
    return firstLine;
  }

  /**
   * Get quick actions based on type
   */
  private getQuickActions(type: EmbeddingType): string[] {
    switch (type) {
      case "customer":
        return ["View Profile", "Call", "Send Email"];
      case "policy":
        return ["View Policy", "Generate ID Card"];
      case "call":
        return ["View Transcript", "Listen to Recording"];
      case "document":
        return ["View Document", "Download"];
      default:
        return ["View"];
    }
  }
}

// Singleton instance
let vectorService: VectorService | null = null;

export function getVectorService(): VectorService {
  if (!vectorService) {
    vectorService = new VectorService();
  }
  return vectorService;
}
