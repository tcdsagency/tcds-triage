import { useEffect, useState, useRef, useCallback } from "react";

// Types
export interface SMSMessage {
  id: string;
  fromNumber: string;
  body: string;
  contactName: string | null;
  createdAt: string;
  isAcknowledged: boolean;
}

interface SSEEvent {
  type: string;
  messages?: SMSMessage[];
  message?: SMSMessage;
  unreadCount?: number;
  timestamp?: number;
  clientId?: string;
}

/**
 * Custom hook for real-time SMS notifications via Server-Sent Events
 *
 * @param enabled - Whether to establish SSE connection
 * @returns Unread messages, count, and connection status
 */
export function useSMSStream(enabled: boolean = true) {
  const [messages, setMessages] = useState<SMSMessage[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;

  // Acknowledge a message (called from UI)
  const acknowledgeMessage = useCallback(async (messageId: string) => {
    try {
      await fetch(`/api/messages/${messageId}/read`, { method: "POST" });
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (error) {
      console.error("[useSMSStream] Error acknowledging message:", error);
    }
  }, []);

  // Acknowledge all messages
  const acknowledgeAll = useCallback(async () => {
    try {
      await fetch("/api/messages/acknowledge-all", { method: "POST" });
      setMessages([]);
      setUnreadCount(0);
    } catch (error) {
      console.error("[useSMSStream] Error acknowledging all messages:", error);
    }
  }, []);

  // Connect to SSE stream
  const connect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    try {
      console.log("[useSMSStream] Connecting to SSE stream...");
      const es = new EventSource("/api/messages/stream");
      eventSourceRef.current = es;

      es.onopen = () => {
        console.log("[useSMSStream] SSE connected");
        setIsConnected(true);
        setError(null);
        reconnectAttemptsRef.current = 0;
      };

      es.onmessage = (event) => {
        try {
          const data: SSEEvent = JSON.parse(event.data);

          switch (data.type) {
            case "connected":
              console.log(`[useSMSStream] Client ID: ${data.clientId}`);
              break;

            case "messages_update":
              if (data.messages) {
                setMessages(data.messages);
              }
              if (data.unreadCount !== undefined) {
                setUnreadCount(data.unreadCount);
              }
              break;

            case "new_message":
              if (data.message) {
                // Add new message to the list
                setMessages((prev) => {
                  // Avoid duplicates
                  if (prev.some((m) => m.id === data.message!.id)) {
                    return prev;
                  }
                  return [data.message!, ...prev].slice(0, 5);
                });
                setUnreadCount((prev) => prev + 1);

                // Play notification sound if available
                try {
                  const audio = new Audio("/notification.mp3");
                  audio.volume = 0.3;
                  audio.play().catch(() => {});
                } catch {}
              }
              break;

            default:
              console.log(`[useSMSStream] Unknown event type: ${data.type}`);
          }
        } catch (error) {
          console.error("[useSMSStream] Error parsing SSE message:", error);
        }
      };

      es.onerror = (event) => {
        console.error("[useSMSStream] SSE error:", event);
        setIsConnected(false);
        setError("Connection lost");

        // Close current connection
        es.close();
        eventSourceRef.current = null;

        // Attempt reconnection with exponential backoff
        if (reconnectAttemptsRef.current < maxReconnectAttempts) {
          reconnectAttemptsRef.current++;
          const delay = Math.min(
            1000 * Math.pow(2, reconnectAttemptsRef.current),
            30000
          );

          console.log(
            `[useSMSStream] Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current})`
          );

          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, delay);
        } else {
          console.error("[useSMSStream] Max reconnection attempts reached");
          setError("Unable to connect. Please refresh the page.");
        }
      };
    } catch (error) {
      console.error("[useSMSStream] Error creating EventSource:", error);
      setError("Failed to connect");
    }
  }, []);

  // Disconnect from SSE stream
  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    setIsConnected(false);
  }, []);

  // Connect on mount, disconnect on unmount
  useEffect(() => {
    if (!enabled) {
      disconnect();
      return;
    }

    connect();

    return () => {
      disconnect();
    };
  }, [enabled, connect, disconnect]);

  // Refresh messages manually
  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/messages?filter=unread&limit=5");
      const data = await res.json();
      if (data.success) {
        setMessages(data.messages);
        setUnreadCount(data.unreadCount);
      }
    } catch (error) {
      console.error("[useSMSStream] Error refreshing messages:", error);
    }
  }, []);

  return {
    messages,
    unreadCount,
    isConnected,
    error,
    acknowledgeMessage,
    acknowledgeAll,
    refresh,
    reconnect: connect,
  };
}
