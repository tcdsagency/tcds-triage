"use client";

import { createContext, useContext, useState, useEffect, useCallback, ReactNode, useRef } from "react";
import CallPopup from "@/components/features/CallPopup";

interface UserInfo {
  id: string;
  name: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string;
  extension: string;
}

interface ActiveCall {
  sessionId: string;
  phoneNumber: string;
  direction: "inbound" | "outbound";
  status: "ringing" | "connected" | "on_hold" | "wrap_up" | "ended";
  startTime: number;
  customerId?: string;
  extension?: string;
  // User info for caller/callee when extension matches a user
  callerUser?: UserInfo;
  calleeUser?: UserInfo;
}

interface CallContextType {
  activeCall: ActiveCall | null;
  isPopupVisible: boolean;
  isPopupMinimized: boolean;
  myExtension: string | null;
  myUserInfo: UserInfo | null;
  usersByExtension: Map<string, UserInfo>;
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
  const [myUserInfo, setMyUserInfo] = useState<UserInfo | null>(null);
  const [usersByExtension, setUsersByExtension] = useState<Map<string, UserInfo>>(new Map());
  const myExtensionRef = useRef<string | null>(null);
  const activeCallRef = useRef<ActiveCall | null>(null);
  const closeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Keep activeCallRef in sync
  useEffect(() => {
    activeCallRef.current = activeCall;
  }, [activeCall]);

  // Lookup user by extension and cache it
  const lookupUserByExtension = useCallback(async (extension: string): Promise<UserInfo | null> => {
    // Check cache first
    if (usersByExtension.has(extension)) {
      return usersByExtension.get(extension)!;
    }

    try {
      const res = await fetch(`/api/users/by-extension/${extension}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.user) {
          const userInfo: UserInfo = {
            id: data.user.id,
            name: data.user.name || `${data.user.firstName} ${data.user.lastName}`.trim(),
            firstName: data.user.firstName,
            lastName: data.user.lastName,
            avatarUrl: data.user.avatarUrl,
            extension: data.user.extension,
          };
          setUsersByExtension(prev => new Map(prev).set(extension, userInfo));
          return userInfo;
        }
      }
    } catch (err) {
      console.error(`[CallProvider] Failed to lookup user for extension ${extension}:`, err);
    }
    return null;
  }, [usersByExtension]);

  // Fetch current user's extension on mount and check for active call
  useEffect(() => {
    fetch('/api/auth/me')
      .then(res => res.json())
      .then(async data => {
        if (data.success && data.user?.extension) {
          const ext = data.user.extension;
          setMyExtension(ext);
          myExtensionRef.current = ext;
          localStorage.setItem('myExtension', ext);
          console.log('[CallProvider] Agent extension:', ext);

          // Store current user info
          const userInfo: UserInfo = {
            id: data.user.id,
            name: `${data.user.firstName} ${data.user.lastName}`.trim(),
            firstName: data.user.firstName,
            lastName: data.user.lastName,
            avatarUrl: data.user.avatarUrl,
            extension: ext,
          };
          setMyUserInfo(userInfo);
          setUsersByExtension(prev => new Map(prev).set(ext, userInfo));

          // Check for active call on page load
          try {
            const activeRes = await fetch(`/api/calls/active?extension=${ext}`);
            if (activeRes.ok) {
              const activeData = await activeRes.json();
              if (activeData.call) {
                console.log('[CallProvider] Found active call on load:', activeData.call.id);
                const call: ActiveCall = {
                  sessionId: activeData.call.id,
                  phoneNumber: activeData.call.fromNumber || activeData.call.toNumber || "Unknown",
                  direction: activeData.call.direction || "inbound",
                  status: activeData.call.status === "in_progress" ? "connected" : "ringing",
                  startTime: new Date(activeData.call.startedAt).getTime(),
                  customerId: activeData.call.customerId,
                  extension: ext,
                };
                setActiveCall(call);
                setIsPopupVisible(true);
              }
            }
          } catch (e) {
            console.error('[CallProvider] Error checking active call:', e);
          }
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

  // Note: Realtime push via WebSocket - broadcasts come from realtime.tcdsagency.com
  // The 3CX bridge posts to webhooks, which should push to realtime server
  // If popup not showing, check if realtime server has /api/broadcast endpoint

  const handleCallEvent = useCallback(async (data: any) => {
    console.log("[CallProvider] Event:", data.type, data);

    // Get extension from event (supports both formats from 3CX)
    const callExtension = data.extension || data.data?.extension || data.agentExtension;
    const currentExt = myExtensionRef.current || localStorage.getItem('myExtension');
    const currentCall = activeCallRef.current;

    switch (data.type) {
      case "call_ringing":
      case "call_started": {
        // Filter by extension - only show popup for THIS agent's calls
        const isMyCall = !callExtension || (currentExt && callExtension === currentExt);

        if (!isMyCall) {
          console.log(`[CallProvider] Ignoring call for extension ${callExtension} (my extension: ${currentExt})`);
          return;
        }

        // DEDUPLICATION: Check if we already have an active call for this session
        if (currentCall && currentCall.sessionId === data.sessionId) {
          // Same session - just update status if needed (ringing -> connected)
          const newStatus = data.type === "call_ringing" ? "ringing" : "connected";
          if (currentCall.status !== newStatus) {
            console.log(`[CallProvider] Updating existing call ${data.sessionId} status: ${currentCall.status} -> ${newStatus}`);
            setActiveCall(prev => prev ? { ...prev, status: newStatus } : null);
          } else {
            console.log(`[CallProvider] Ignoring duplicate ${data.type} for session ${data.sessionId}`);
          }
          return;
        }

        // Clear any pending close timeout from previous call
        if (closeTimeoutRef.current) {
          clearTimeout(closeTimeoutRef.current);
          closeTimeoutRef.current = null;
        }

        // New call - create ActiveCall object
        const newCall: ActiveCall = {
          sessionId: data.sessionId,
          phoneNumber: data.phoneNumber || data.callerNumber || "Unknown",
          direction: data.direction || "inbound",
          status: data.type === "call_ringing" ? "ringing" : "connected",
          startTime: Date.now(),
          customerId: data.customerId,
          extension: callExtension,
        };

        // Look up user info for caller/callee extensions
        if (data.callerExtension) {
          newCall.callerUser = await lookupUserByExtension(data.callerExtension) || undefined;
        }
        if (data.calleeExtension) {
          newCall.calleeUser = await lookupUserByExtension(data.calleeExtension) || undefined;
        }
        // If call extension is the agent's, mark them as callee for inbound or caller for outbound
        if (callExtension && callExtension === currentExt) {
          const myUser = usersByExtension.get(callExtension);
          if (myUser) {
            if (data.direction === "inbound") {
              newCall.calleeUser = myUser;
            } else {
              newCall.callerUser = myUser;
            }
          }
        }

        setActiveCall(newCall);
        setIsPopupVisible(true);
        setIsPopupMinimized(false);
        console.log("[CallProvider] Auto-opened popup for call:", newCall.sessionId, "extension:", callExtension);
        break;
      }

      case "call_updated":
        if (currentCall && data.sessionId === currentCall.sessionId) {
          setActiveCall((prev) =>
            prev ? { ...prev, status: data.status } : null
          );
        }
        break;

      case "call_ended": {
        // Match by sessionId - use ref to avoid stale closure
        if (currentCall && data.sessionId === currentCall.sessionId) {
          setActiveCall((prev) =>
            prev ? { ...prev, status: "ended" } : null
          );

          // Keep popup visible for wrap-up, auto-close after 60s
          // Store timeout ref so we can cancel if a new call comes in
          closeTimeoutRef.current = setTimeout(() => {
            setIsPopupVisible(false);
            setActiveCall(null);
            closeTimeoutRef.current = null;
          }, 60000);
        }
        break;
      }
    }
  }, [lookupUserByExtension, usersByExtension]);

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
    // Clear any pending auto-close timeout
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }

    setIsPopupVisible(false);
    setIsPopupMinimized(false);
    // Clear activeCall immediately when user explicitly closes
    setActiveCall(null);
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
        myUserInfo,
        usersByExtension,
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
          startTime={activeCall.startTime}
          callStatus={activeCall.status}
          callerUser={activeCall.callerUser}
          calleeUser={activeCall.calleeUser}
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
