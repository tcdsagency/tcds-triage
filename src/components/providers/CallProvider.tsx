"use client";

import { createContext, useContext, useState, useEffect, useCallback, ReactNode, useRef } from "react";
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
  myExtension: string | null;
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
  const [myExtension, setMyExtension] = useState<string | null>(null);
  const myExtensionRef = useRef<string | null>(null);

  // Fetch current user's extension on mount
  useEffect(() => {
    fetch('/api/auth/me')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.user?.extension) {
          const ext = data.user.extension;
          setMyExtension(ext);
          myExtensionRef.current = ext;
          localStorage.setItem('myExtension', ext);
          console.log('[CallProvider] Agent extension:', ext);
        } else {
          // Try localStorage fallback
          const stored = localStorage.getItem('myExtension');
          if (stored) {
            setMyExtension(stored);
            myExtensionRef.current = stored;
          }
        }
      })
      .catch(err => {
        console.error('[CallProvider] Failed to get agent extension:', err);
        // Try localStorage fallback
        const stored = localStorage.getItem('myExtension');
        if (stored) {
          setMyExtension(stored);
          myExtensionRef.current = stored;
        }
      });
  }, []);

  // WebSocket connection for call events
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

  // Polling DISABLED - relying on WebSocket bridge + webhooks
  // The 3CX WebSocket bridge on G Cloud PC posts to /api/webhook/call-started
  // which creates the call record and pushes to realtime server
  // useEffect(() => {
  //   const currentExt = myExtensionRef.current || localStorage.getItem('myExtension');
  //   if (!currentExt) return;
  //   console.log("[CallProvider] 3CX polling disabled - using WebSocket bridge");
  // }, [activeCall]);

  const handleCallEvent = useCallback((data: any) => {
    console.log("[CallProvider] Event:", data.type, data);

    // Get extension from event (supports both formats from 3CX)
    const callExtension = data.extension || data.data?.extension || data.agentExtension;
    const currentExt = myExtensionRef.current || localStorage.getItem('myExtension');

    switch (data.type) {
      case "call_ringing":
      case "call_started":
        // Filter by extension - only show popup for THIS agent's calls
        const isMyCall = !callExtension || (currentExt && callExtension === currentExt);

        if (!isMyCall) {
          console.log(`[CallProvider] Ignoring call for extension ${callExtension} (my extension: ${currentExt})`);
          return;
        }

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
        console.log("[CallProvider] Auto-opened popup for call:", newCall.sessionId, "extension:", callExtension);
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

  // Expose test function to window for debugging (dev only)
  useEffect(() => {
    if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
      (window as any).__triggerTestCall = (phoneNumber?: string, direction?: "inbound" | "outbound", extension?: string) => {
        const testEvent = {
          type: "call_ringing",
          sessionId: `test_${Date.now()}`,
          phoneNumber: phoneNumber || "+12059990360",
          direction: direction || "inbound",
          extension: extension || myExtensionRef.current, // Use agent's extension by default
          customerId: null,
        };
        console.log("[CallProvider] Triggering test call:", testEvent);
        handleCallEvent(testEvent);
      };

      (window as any).__endTestCall = () => {
        if (activeCall) {
          handleCallEvent({ type: "call_ended", sessionId: activeCall.sessionId });
        }
      };

      console.log("[CallProvider] Test functions available:");
      console.log("  __triggerTestCall(phoneNumber?, direction?) - Simulate incoming call");
      console.log("  __endTestCall() - End current test call");
    }

    return () => {
      if (typeof window !== "undefined") {
        delete (window as any).__triggerTestCall;
        delete (window as any).__endTestCall;
      }
    };
  }, [handleCallEvent, activeCall]);

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
        myExtension,
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
