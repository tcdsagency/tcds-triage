/**
 * API Route: /api/ai/assistant
 * Streaming chat completion for AI Assistant
 */

import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/db";
import { assistantSessions, assistantMessages, assistantDocuments } from "@/db/schema";
import { eq, and, asc, inArray } from "drizzle-orm";
import { redactPII } from "@/lib/format-ticket-description";
import { getVectorService } from "@/lib/ai/vector-service";
import { buildSystemPrompt } from "@/lib/ai/assistant-prompts";

const anthropic = new Anthropic();

interface ChatRequest {
  sessionId: string;
  message: string;
  mode: "general" | "document";
  documentIds?: string[];
}

export async function POST(request: NextRequest) {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return new Response(
        JSON.stringify({ error: "Tenant not configured" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const userId = request.headers.get("x-user-id") || "default";
    const body: ChatRequest = await request.json();
    const { sessionId, message, mode, documentIds } = body;

    if (!sessionId || !message) {
      return new Response(
        JSON.stringify({ error: "sessionId and message are required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Verify session exists and belongs to user
    const [session] = await db
      .select()
      .from(assistantSessions)
      .where(
        and(
          eq(assistantSessions.id, sessionId),
          eq(assistantSessions.tenantId, tenantId),
          eq(assistantSessions.userId, userId)
        )
      )
      .limit(1);

    if (!session) {
      return new Response(
        JSON.stringify({ error: "Session not found" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    // Redact PII from user message
    const sanitizedMessage = redactPII(message);

    // Save user message
    await db.insert(assistantMessages).values({
      sessionId,
      role: "user",
      content: sanitizedMessage,
      documentIds: documentIds || null,
    });

    // Build document context if in document mode
    let documentContext = "";
    let documentNames: string[] = [];
    let citationSources: { documentId: string; documentName: string; chunkIndex: number; excerpt: string }[] = [];

    if (mode === "document" && documentIds && documentIds.length > 0) {
      // Get document names
      const docs = await db
        .select({ id: assistantDocuments.id, filename: assistantDocuments.filename })
        .from(assistantDocuments)
        .where(
          and(
            eq(assistantDocuments.tenantId, tenantId),
            inArray(assistantDocuments.id, documentIds)
          )
        );

      documentNames = docs.map((d) => d.filename);
      const docNameMap = Object.fromEntries(docs.map((d) => [d.id, d.filename]));

      // Search for relevant chunks
      const vectorService = getVectorService();
      const searchResults = await vectorService.search(sanitizedMessage, tenantId, {
        type: "document",
        limit: 20,
      });

      // Filter to only requested documents
      const relevantResults = searchResults
        .filter((r) => {
          const meta = r.metadata as { documentId?: string } | null;
          return meta?.documentId && documentIds.includes(meta.documentId);
        })
        .slice(0, 8);

      if (relevantResults.length > 0) {
        documentContext = "\n\n---\nDOCUMENT CONTEXT:\n\n";
        for (const result of relevantResults) {
          const meta = result.metadata as {
            documentId: string;
            documentName: string;
            chunkIndex: number;
          };
          documentContext += `[${meta.documentName}, Chunk ${meta.chunkIndex + 1}]:\n${result.content}\n\n`;
          citationSources.push({
            documentId: meta.documentId,
            documentName: meta.documentName,
            chunkIndex: meta.chunkIndex,
            excerpt: result.content.slice(0, 200),
          });
        }
      }
    }

    // Load conversation history (last 20 messages)
    const history = await db
      .select({
        role: assistantMessages.role,
        content: assistantMessages.content,
      })
      .from(assistantMessages)
      .where(eq(assistantMessages.sessionId, sessionId))
      .orderBy(asc(assistantMessages.createdAt))
      .limit(20);

    // Build messages array for Anthropic
    const conversationMessages: { role: "user" | "assistant"; content: string }[] =
      history.map((m) => ({
        role: m.role,
        content: m.role === "user" && documentContext && m.content === sanitizedMessage
          ? m.content + documentContext
          : m.content,
      }));

    // Build system prompt
    const systemPrompt = buildSystemPrompt(mode, { documentNames });

    // Auto-title: check if this is the first user message
    const isFirstMessage = history.filter((m) => m.role === "user").length === 1;

    // Stream response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const anthropicStream = await anthropic.messages.create({
            model: "claude-sonnet-4-20250514",
            max_tokens: 2048,
            system: systemPrompt,
            messages: conversationMessages,
            stream: true,
          });

          let fullResponse = "";

          for await (const event of anthropicStream) {
            if (event.type === "content_block_delta") {
              const delta = event.delta;
              if ("text" in delta) {
                fullResponse += delta.text;
                const chunk = JSON.stringify({ type: "chunk", text: delta.text });
                controller.enqueue(encoder.encode(`data: ${chunk}\n\n`));
              }
            }
          }

          // Save assistant message
          const citations = citationSources.length > 0 ? citationSources : null;
          await db.insert(assistantMessages).values({
            sessionId,
            role: "assistant",
            content: fullResponse,
            citations,
          });

          // Update session updatedAt
          await db
            .update(assistantSessions)
            .set({ updatedAt: new Date() })
            .where(eq(assistantSessions.id, sessionId));

          // Auto-title if first message
          if (isFirstMessage) {
            const autoTitle = sanitizedMessage.slice(0, 50) + (sanitizedMessage.length > 50 ? "..." : "");
            await db
              .update(assistantSessions)
              .set({ title: autoTitle })
              .where(eq(assistantSessions.id, sessionId));
          }

          // Send done event
          const doneEvent = JSON.stringify({
            type: "done",
            citations: citationSources.map((c) => c.documentName),
          });
          controller.enqueue(encoder.encode(`data: ${doneEvent}\n\n`));
          controller.close();
        } catch (error: any) {
          console.error("[Assistant Chat] Stream error:", error);
          const errorEvent = JSON.stringify({
            type: "error",
            message: error.message || "An error occurred",
          });
          controller.enqueue(encoder.encode(`data: ${errorEvent}\n\n`));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("[Assistant Chat] Error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to process chat" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
