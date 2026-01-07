"use client";

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import CallPopup from "@/components/features/CallPopup";

interface ActiveCall {
  sessionId: string;
  phoneNumber: string;
  direction: "inbound" | "outbound";
  status: "ringing" | "connected" | "on_hold" | "wrap_up" | "ended";
  startTime: number;
  customerId?: string;
}

interface CallContextType {
  activeCall: ActiveCall | null;
  isPopupVisible: boolean;
  isPopupMinimized: boolean;
  openPopup: (call: ActiveCall) => void;
  closePopup: () => void;
  minimizePopup: () => void;
  restorePopup: () => void;
}

const CallContext = createContext<CallContextType | null>(null);

export function useCall() {
  const context = useContext(CallContext);
  if (!context) {
    throw new Error("useCall must be used within CallProvider");
  }
  return context;
}

interface CallProviderProps {
  children: ReactNode;
}

export function CallProvider({ children }: CallProviderProps) {
  const [activeCall, setActiveCall] = useState<ActiveCall | null>(null);
  const [isPopupVisible, setIsPopupVisible] = useState(false);
  const [isPopupMinimized, setIsPopupMinimized] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);

  // WebSocket connection for global call events
  useEffect(() => {
    const wsUrl = process.env.NEXT_PUBLIC_REALTIME_WS_URL || 'wss://realtime.tcdsagency.com/ws/calls';
    let ws: WebSocket | null = null;
    let reconnectTimeout: NodeJS.Timeout | null = null;
    let reconnectAttempts = 0;

    const connect = () => {
      try {
        console.log("[CallProvider] Connecting to", wsUrl);
        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          console.log("[CallProvider] WebSocket connected");
          setWsConnected(true);
          reconnectAttempts = 0;

          // Subscribe to all call events (no specific session)
          ws?.send(JSON.stringify({ type: "subscribe_all" }));
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            handleCallEvent(data);
          } catch (e) {
            console.error("[CallProvider] Parse error:", e);
          }
        };

        ws.onclose = () => {
          console.log("[CallProvider] WebSocket closed");
          setWsConnected(false);

          // Reconnect with backoff
          if (reconnectAttempts < 5) {
            reconnectAttempts++;
            const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 10000);
            console.log(`[CallProvider] Reconnecting in ${delay}ms`);
            reconnectTimeout = setTimeout(connect, delay);
          }
        };

        ws.onerror = (error) => {
          console.error("[CallProvider] WebSocket error:", error);
        };
      } catch (e) {
        console.error("[CallProvider] Connection error:", e);
      }
    };

    connect();

    return () => {
      if (ws) ws.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, []);

  const handleCallEvent = useCallback((data: any) => {
    console.log("[CallProvider] Event:", data.type, data);

    switch (data.type) {
      case "call_ringing":
      case "call_started":
        // New incoming/outgoing call - auto-open popup
        const newCall: ActiveCall = {
          sessionId: data.sessionId,
          phoneNumber: data.phoneNumber || data.callerNumber || "Unknown",
          direction: data.direction || "inbound",
          status: data.type === "call_ringing" ? "ringing" : "connected",
          startTime: Date.now(),
          customerId: data.customerId,
        };
        setActiveCall(newCall);
        setIsPopupVisible(true);
        setIsPopupMinimized(false);
        console.log("[CallProvider] Auto-opened popup for call:", newCall.sessionId);
        break;

      case "call_updated":
        if (activeCall && data.sessionId === activeCall.sessionId) {
          setActiveCall((prev) =>
            prev ? { ...prev, status: data.status } : null
          );
        }
        break;

      case "call_ended":
        if (activeCall && data.sessionId === activeCall.sessionId) {
          setActiveCall((prev) =>
            prev ? { ...prev, status: "ended" } : null
          );
          // Keep popup visible for wrap-up, auto-close after 60s
          setTimeout(() => {
            setIsPopupVisible(false);
            setActiveCall(null);
          }, 60000);
        }
        break;
    }
  }, [activeCall]);

  const openPopup = useCallback((call: ActiveCall) => {
    setActiveCall(call);
    setIsPopupVisible(true);
    setIsPopupMinimized(false);
  }, []);

  const closePopup = useCallback(() => {
    setIsPopupVisible(false);
    setIsPopupMinimized(false);
    // Keep activeCall for a bit in case they want to reopen
    setTimeout(() => setActiveCall(null), 5000);
  }, []);

  const minimizePopup = useCallback(() => {
    setIsPopupMinimized(true);
  }, []);

  const restorePopup = useCallback(() => {
    setIsPopupMinimized(false);
  }, []);

  return (
    <CallContext.Provider
      value={{
        activeCall,
        isPopupVisible,
        isPopupMinimized,
        openPopup,
        closePopup,
        minimizePopup,
        restorePopup,
      }}
    >
      {children}

      {/* Global Call Popup */}
      {activeCall && isPopupVisible && (
        <CallPopup
          sessionId={activeCall.sessionId}
          phoneNumber={activeCall.phoneNumber}
          direction={activeCall.direction}
          isVisible={isPopupVisible && !isPopupMinimized}
          onClose={closePopup}
          onMinimize={minimizePopup}
        />
      )}

      {/* Minimized Call Bar */}
      {activeCall && isPopupVisible && isPopupMinimized && (
        <div
          onClick={restorePopup}
          className="fixed bottom-4 right-4 bg-gray-900 text-white rounded-lg shadow-xl p-3 cursor-pointer hover:bg-gray-800 z-50"
        >
          <div className="flex items-center gap-3">
            <span className="text-green-400 animate-pulse">📞</span>
            <div>
              <div className="font-medium">{activeCall.phoneNumber}</div>
              <div className="text-xs text-gray-400">{activeCall.status}</div>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                closePopup();
              }}
              className="ml-2 p-1 hover:bg-gray-700 rounded"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Connection indicator (dev only) */}
      {process.env.NODE_ENV === "development" && (
        <div className="fixed bottom-4 left-4 text-xs">
          <span className={wsConnected ? "text-green-500" : "text-red-500"}>
            ● WS {wsConnected ? "Connected" : "Disconnected"}
          </span>
        </div>
      )}
    </CallContext.Provider>
  );
}
