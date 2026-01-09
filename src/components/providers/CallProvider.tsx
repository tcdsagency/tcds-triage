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
  externalCallId?: string; // 3CX call ID for matching call_ended events
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
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

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
    const wsUrl = process.env.NEXT_PUBLIC_REALTIME_WS_URL;
    let ws: WebSocket | null = null;
    let reconnectTimeout: NodeJS.Timeout | null = null;
    let reconnectAttempts = 0;
    const maxReconnectAttempts = 3;

    // Skip WebSocket connection if no URL is configured
    if (!wsUrl) {
      console.debug("[CallProvider] No WebSocket URL configured, skipping realtime connection");
      return;
    }

    const connect = () => {
      // Stop reconnecting after max attempts
      if (reconnectAttempts >= maxReconnectAttempts) {
        console.debug("[CallProvider] Max reconnect attempts reached, stopping");
        return;
      }

      try {
        console.debug("[CallProvider] Connecting to", wsUrl);
        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          console.debug("[CallProvider] WebSocket connected");
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
            console.debug("[CallProvider] Parse error:", e);
          }
        };

        ws.onclose = () => {
          setWsConnected(false);
          reconnectAttempts++;

          // Reconnect with backoff up to max attempts
          if (reconnectAttempts < maxReconnectAttempts) {
            const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 10000);
            console.debug(`[CallProvider] Reconnecting in ${delay}ms`);
            reconnectTimeout = setTimeout(connect, delay);
          }
        };

        ws.onerror = () => {
          // Silently handle errors - onclose will trigger reconnect
        };
      } catch (e) {
        reconnectAttempts++;
      }
    };

    connect();

    return () => {
      if (ws) ws.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, []);

  // Polling fallback: Check call status AND presence every 5 seconds
  // Since webhooks aren't reliable, we use presence as source of truth
  useEffect(() => {
    if (!activeCall || activeCall.status === "ended") {
      // No active call or already ended - clear polling
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      return;
    }

    const checkCallStatus = async () => {
      const currentExt = myExtensionRef.current;

      try {
        // Check presence API - this is the source of truth for whether agent is on a call
        if (currentExt) {
          const presenceRes = await fetch('/api/3cx/presence');
          if (presenceRes.ok) {
            const presenceData = await presenceRes.json();
            const myPresence = presenceData.team?.find((t: any) => t.extension === currentExt);

            if (myPresence && myPresence.status !== 'on_call' && activeCallRef.current?.status !== "ended") {
              // Presence shows NOT on call, but we have an active popup - call must have ended
              console.log(`[CallProvider] Presence shows ${myPresence.status}, marking call as ended`);
              setActiveCall(prev => prev ? { ...prev, status: "ended" } : null);

              // Also update the call in the database
              try {
                await fetch(`/api/calls/${activeCall.sessionId}`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ action: 'end' }),
                });
              } catch (e) {
                console.error('[CallProvider] Failed to update call status:', e);
              }

              // Auto-close after 30 seconds for wrap-up
              if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
              closeTimeoutRef.current = setTimeout(() => {
                console.log(`[CallProvider] Auto-closing popup after presence detected end`);
                setIsPopupVisible(false);
                setActiveCall(null);
                closeTimeoutRef.current = null;
              }, 30000);
              return;
            }
          }
        }

        // Also check DB status as secondary source
        const res = await fetch(`/api/calls/${activeCall.sessionId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.call) {
            const dbStatus = data.call.status;
            const hasEnded = data.call.endedAt || dbStatus === "completed" || dbStatus === "missed";

            if (hasEnded && activeCallRef.current?.status !== "ended") {
              console.log(`[CallProvider] DB shows call ended (status: ${dbStatus}), closing popup`);
              setActiveCall(prev => prev ? { ...prev, status: "ended" } : null);

              // Auto-close after 30 seconds for wrap-up
              if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
              closeTimeoutRef.current = setTimeout(() => {
                console.log(`[CallProvider] Auto-closing popup after DB detected end`);
                setIsPopupVisible(false);
                setActiveCall(null);
                closeTimeoutRef.current = null;
              }, 30000);
            }
          }
        } else if (res.status === 404) {
          // Call not found - might be deleted or never existed, close popup
          console.log(`[CallProvider] Call ${activeCall.sessionId} not found, closing popup`);
          setIsPopupVisible(false);
          setActiveCall(null);
        }
      } catch (e) {
        console.error("[CallProvider] Polling error:", e);
      }
    };

    // Start polling every 5 seconds (faster since we're relying on this)
    pollIntervalRef.current = setInterval(checkCallStatus, 5000);

    // Also check immediately
    checkCallStatus();

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [activeCall?.sessionId, activeCall?.status]);

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
          externalCallId: data.callId || data.externalCallId, // Store 3CX call ID for matching
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
        // Match by multiple fields to handle different ID formats from 3CX/VoIPTools
        // Use ref to avoid stale closure
        const eventPhone = data.phoneNumber || data.callerNumber || data.calleeNumber;
        const currentPhone = currentCall?.phoneNumber;

        const matchesSession = currentCall && (
          // Direct session ID match
          data.sessionId === currentCall.sessionId ||
          // Cross-match external/session IDs
          data.sessionId === currentCall.externalCallId ||
          data.externalCallId === currentCall.sessionId ||
          data.externalCallId === currentCall.externalCallId ||
          // Extension match (same agent)
          (data.extension && data.extension === currentCall.extension) ||
          // Phone number match as last resort (if extensions also match or no extension in event)
          (eventPhone && currentPhone && eventPhone === currentPhone &&
           (!data.extension || data.extension === currentCall.extension))
        );

        if (matchesSession) {
          console.log(`[CallProvider] Call ended - session ${data.sessionId}, matched to ${currentCall.sessionId}`);
          setActiveCall((prev) =>
            prev ? { ...prev, status: "ended" } : null
          );

          // Clear polling since we got the event
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }

          // Keep popup visible for wrap-up, auto-close after 30s
          // Store timeout ref so we can cancel if a new call comes in
          if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
          closeTimeoutRef.current = setTimeout(() => {
            console.log(`[CallProvider] Auto-closing popup after call ended`);
            setIsPopupVisible(false);
            setActiveCall(null);
            closeTimeoutRef.current = null;
          }, 30000);
        } else {
          console.log(`[CallProvider] Ignoring call_ended - no match`, {
            eventSessionId: data.sessionId,
            eventExternalId: data.externalCallId,
            eventExtension: data.extension,
            eventPhone,
            currentSessionId: currentCall?.sessionId,
            currentExternalId: currentCall?.externalCallId,
            currentExtension: currentCall?.extension,
            currentPhone,
          });
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
