// API Route: /api/messages/stream
// Server-Sent Events stream for real-time SMS notifications

import { NextRequest } from "next/server";
import { db } from "@/db";
import { messages } from "@/db/schema";
import { desc, eq, and, isNull } from "drizzle-orm";

// Store connected clients for broadcasting
const clients = new Map<string, ReadableStreamDefaultController>();

// Broadcast a new message to all connected clients
export function broadcastNewMessage(message: any) {
  const data = JSON.stringify({
    type: "new_message",
    message,
    timestamp: Date.now(),
  });

  clients.forEach((controller, clientId) => {
    try {
      controller.enqueue(`data: ${data}\n\n`);
    } catch (error) {
      console.error(`[SSE] Error sending to client ${clientId}:`, error);
      clients.delete(clientId);
    }
  });
}

// GET - SSE stream for messages
export async function GET(request: NextRequest) {
  const tenantId = process.env.DEFAULT_TENANT_ID;

  if (!tenantId) {
    return new Response(JSON.stringify({ error: "Tenant not configured" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Generate unique client ID
  const clientId = `${Date.now()}-${Math.random().toString(36).substring(7)}`;

  // Create SSE stream
  const stream = new ReadableStream({
    start(controller) {
      // Store controller for broadcasting
      clients.set(clientId, controller);
      console.log(`[SSE] Client connected: ${clientId} (total: ${clients.size})`);

      // Send initial connection event
      controller.enqueue(`data: ${JSON.stringify({ type: "connected", clientId })}\n\n`);

      // Set up heartbeat to keep connection alive
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(`: heartbeat\n\n`);
        } catch {
          clearInterval(heartbeat);
        }
      }, 30000);

      // Poll for new messages every 5 seconds and send updates
      let lastCheckTime = new Date();
      const pollInterval = setInterval(async () => {
        try {
          // Check for new messages since last check
          const newMessages = await db
            .select({
              id: messages.id,
              fromNumber: messages.fromNumber,
              toNumber: messages.toNumber,
              body: messages.body,
              contactId: messages.contactId,
              contactName: messages.contactName,
              direction: messages.direction,
              isAcknowledged: messages.isAcknowledged,
              createdAt: messages.createdAt,
            })
            .from(messages)
            .where(
              and(
                eq(messages.tenantId, tenantId),
                eq(messages.direction, "inbound"),
                eq(messages.isAcknowledged, false)
              )
            )
            .orderBy(desc(messages.createdAt))
            .limit(5);

          // Send update with current unread count and messages
          const unreadCount = newMessages.length;
          controller.enqueue(
            `data: ${JSON.stringify({
              type: "messages_update",
              messages: newMessages.map((m) => ({
                id: m.id,
                fromNumber: m.fromNumber,
                body: m.body,
                contactName: m.contactName,
                createdAt: m.createdAt?.toISOString(),
                isAcknowledged: m.isAcknowledged,
              })),
              unreadCount,
              timestamp: Date.now(),
            })}\n\n`
          );

          lastCheckTime = new Date();
        } catch (error) {
          console.error("[SSE] Error polling messages:", error);
        }
      }, 5000);

      // Clean up on close
      request.signal.addEventListener("abort", () => {
        clearInterval(heartbeat);
        clearInterval(pollInterval);
        clients.delete(clientId);
        console.log(`[SSE] Client disconnected: ${clientId} (total: ${clients.size})`);
      });
    },

    cancel() {
      clients.delete(clientId);
      console.log(`[SSE] Stream cancelled: ${clientId}`);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // Disable nginx buffering
    },
  });
}
