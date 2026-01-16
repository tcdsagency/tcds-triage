"use client";

import { createContext, useContext, useState, useEffect, useCallback, ReactNode, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
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
  customerName?: string; // For displaying in incoming call toast
  extension?: string;
  predictedReason?: string | null; // AI-predicted reason for the call
  // User info for caller/callee when extension matches a user
  callerUser?: UserInfo;
  calleeUser?: UserInfo;
}

interface CallContextType {
  activeCall: ActiveCall | null;
  isPopupVisible: boolean;
  isPopupMinimized: boolean;
  isOnCallPage: boolean;
  myExtension: string | null;
  myUserInfo: UserInfo | null;
  usersByExtension: Map<string, UserInfo>;
  openPopup: (call: ActiveCall) => void;
  closePopup: () => void;
  minimizePopup: () => void;
  restorePopup: () => void;
  navigateToCall: (sessionId: string) => void;
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
  const router = useRouter();
  const pathname = usePathname();

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
  const newCallPollRef = useRef<NodeJS.Timeout | null>(null);
  const notOnCallCountRef = useRef<number>(0); // Debounce counter for presence-based call end detection

  // Check if user is on the full-page call screen
  const isOnCallPage = pathname?.startsWith('/calls/active/') ?? false;

  // Keep activeCallRef in sync
  useEffect(() => {
    activeCallRef.current = activeCall;
  }, [activeCall]);

  // Lookup customer by phone number for incoming call display
  const lookupCustomerByPhone = useCallback(async (phoneNumber: string): Promise<{ id: string; name: string } | null> => {
    if (!phoneNumber || phoneNumber === "Unknown") return null;

    try {
      const res = await fetch(`/api/customers/search?phone=${encodeURIComponent(phoneNumber)}&limit=1`);
      if (res.ok) {
        const data = await res.json();
        if (data.customers?.[0]) {
          const c = data.customers[0];
          return {
            id: c.id,
            name: `${c.firstName || ''} ${c.lastName || ''}`.trim() || c.businessName || 'Customer',
          };
        }
      }
    } catch (err) {
      console.error(`[CallProvider] Failed to lookup customer for phone ${phoneNumber}:`, err);
    }
    return null;
  }, []);

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

  // Polling fallback: Check call status AND presence every 10 seconds
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
        // Check DB status FIRST - this is updated by call_ended webhook
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
          return;
        }

        // Fallback: Check presence API if DB doesn't show ended
        if (currentExt && activeCallRef.current?.status !== "ended") {
          const presenceRes = await fetch('/api/3cx/presence');
          if (presenceRes.ok) {
            const presenceData = await presenceRes.json();
            const myPresence = presenceData.team?.find((t: any) => t.extension === currentExt);

            if (myPresence && myPresence.status !== 'on_call') {
              // Presence shows NOT on call - increment counter for debounce
              notOnCallCountRef.current++;
              console.log(`[CallProvider] Presence shows ${myPresence.status}, count: ${notOnCallCountRef.current}/2`);

              // Require 2 consecutive checks before marking ended (prevents false positives)
              if (notOnCallCountRef.current >= 2) {
                console.log(`[CallProvider] Confirmed via presence - call ended`);
                setActiveCall(prev => prev ? { ...prev, status: "ended" } : null);
                notOnCallCountRef.current = 0;

                // Update DB
                try {
                  await fetch(`/api/calls/${activeCall.sessionId}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'end' }),
                  });
                } catch (e) {
                  console.error('[CallProvider] Failed to update call status:', e);
                }

                // Auto-close after 30 seconds
                if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
                closeTimeoutRef.current = setTimeout(() => {
                  console.log(`[CallProvider] Auto-closing popup after presence end`);
                  setIsPopupVisible(false);
                  setActiveCall(null);
                  closeTimeoutRef.current = null;
                }, 30000);
              }
            } else if (myPresence && myPresence.status === 'on_call') {
              notOnCallCountRef.current = 0; // Reset counter
            }
          }
        }
      } catch (e) {
        console.error("[CallProvider] Polling error:", e);
      }
    };

    // Start polling every 3 seconds for responsive call end detection
    pollIntervalRef.current = setInterval(checkCallStatus, 3000);

    // Also check immediately
    checkCallStatus();

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [activeCall?.sessionId, activeCall?.status]);

  // Helper to check if a number is an internal extension (3 digits)
  const isInternalExtension = (number: string | undefined): boolean => {
    if (!number) return false;
    // Strip any formatting and check if it's exactly 3 digits
    const cleaned = number.replace(/\D/g, '');
    return cleaned.length === 3 && /^\d{3}$/.test(cleaned);
  };

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

        // Skip internal calls (extension to extension - both are 3 digits)
        const phoneNumber = data.phoneNumber || data.callerNumber || "";
        if (isInternalExtension(phoneNumber)) {
          console.log(`[CallProvider] Ignoring internal call from extension ${phoneNumber}`);
          return;
        }

        // DEDUPLICATION: Check if we already have an active call for this session
        if (currentCall && currentCall.sessionId === data.sessionId) {
          // Same session - check if transitioning from ringing to connected
          const newStatus = data.type === "call_ringing" ? "ringing" : "connected";
          if (currentCall.status !== newStatus) {
            console.log(`[CallProvider] Updating existing call ${data.sessionId} status: ${currentCall.status} -> ${newStatus}`);
            setActiveCall(prev => prev ? { ...prev, status: newStatus } : null);

            // If transitioning from ringing to connected, navigate to full screen
            if (currentCall.status === "ringing" && newStatus === "connected") {
              console.log("[CallProvider] Call answered - navigating to full screen");
              router.push(`/calls/active/${data.sessionId}`);
            }
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

        // Determine if this is a ringing or already answered call
        const isRinging = data.type === "call_ringing";

        // New call - create ActiveCall object
        const newCall: ActiveCall = {
          sessionId: data.sessionId,
          externalCallId: data.callId || data.externalCallId, // Store 3CX call ID for matching
          phoneNumber: data.phoneNumber || data.callerNumber || "Unknown",
          direction: data.direction || "inbound",
          status: isRinging ? "ringing" : "connected",
          startTime: Date.now(),
          customerId: data.customerId,
          customerName: data.customerName, // May be provided by webhook
          extension: callExtension,
          predictedReason: data.predictedReason || null, // AI-predicted call reason
        };

        // Look up customer info for incoming call toast (async, don't block)
        if (!newCall.customerName && newCall.phoneNumber !== "Unknown") {
          lookupCustomerByPhone(newCall.phoneNumber).then(customer => {
            if (customer) {
              setActiveCall(prev => prev?.sessionId === newCall.sessionId
                ? { ...prev, customerId: customer.id, customerName: customer.name }
                : prev
              );
            }
          });
        }

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
        console.log("[CallProvider] New call detected:", newCall.sessionId, "status:", newCall.status);

        // Only navigate to full screen if call is already answered (not ringing)
        // For ringing calls, we show the incoming call toast instead
        if (!isRinging) {
          console.log("[CallProvider] Call already connected - navigating to full screen");
          router.push(`/calls/active/${newCall.sessionId}`);
        } else {
          console.log("[CallProvider] Call ringing - showing incoming call toast");
        }
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
          const wasRinging = currentCall.status === "ringing";
          console.log(`[CallProvider] Call ended - session ${data.sessionId}, matched to ${currentCall.sessionId}, wasRinging=${wasRinging}`);

          // Clear polling since we got the event
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }

          if (wasRinging) {
            // Call ended while ringing (missed) - close toast immediately
            console.log(`[CallProvider] Missed call - closing toast immediately`);
            setIsPopupVisible(false);
            setActiveCall(null);
          } else {
            // Call was connected - keep popup for wrap-up
            setActiveCall((prev) =>
              prev ? { ...prev, status: "ended" } : null
            );

            // Auto-close after 30s
            if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
            closeTimeoutRef.current = setTimeout(() => {
              console.log(`[CallProvider] Auto-closing popup after call ended`);
              setIsPopupVisible(false);
              setActiveCall(null);
              closeTimeoutRef.current = null;
            }, 30000);
          }
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
  }, [lookupUserByExtension, lookupCustomerByPhone, usersByExtension, router]);

  // Poll for NEW incoming calls when no active call (fallback for WebSocket)
  // Uses /api/calls/detect which creates calls from VoIPTools presence
  useEffect(() => {
    const currentExt = myExtensionRef.current;

    // Only poll if we have an extension AND no active call
    if (!currentExt || activeCall) {
      if (newCallPollRef.current) {
        clearInterval(newCallPollRef.current);
        newCallPollRef.current = null;
      }
      return;
    }

    const pollForNewCalls = async () => {
      try {
        // Use the new detect endpoint which handles call creation
        const res = await fetch(`/api/calls/detect?extension=${currentExt}`);
        if (!res.ok) return;

        const data = await res.json();
        if (data.success && data.isOnCall && data.call) {
          const call = data.call;

          console.log(`[CallProvider] Detect found call: ${call.sessionId} (source: ${call.source})`);

          // Trigger call event to show screen pop
          handleCallEvent({
            type: call.status === 'ringing' ? 'call_ringing' : 'call_started',
            sessionId: call.sessionId,
            phoneNumber: call.phoneNumber || "Unknown",
            direction: call.direction || "inbound",
            extension: currentExt,
            customerId: call.customerId,
          });
        }
      } catch (e) {
        // Silent fail - polling will retry
      }
    };

    // Poll for new calls
    pollForNewCalls(); // Check immediately
    newCallPollRef.current = setInterval(pollForNewCalls, 5000); // Poll every 5s

    return () => {
      if (newCallPollRef.current) {
        clearInterval(newCallPollRef.current);
        newCallPollRef.current = null;
      }
    };
  }, [myExtension, activeCall, handleCallEvent]);

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
    notOnCallCountRef.current = 0; // Reset debounce counter for new call
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

  // Navigate to the full-page call screen
  const navigateToCall = useCallback((sessionId: string) => {
    router.push(`/calls/active/${sessionId}`);
  }, [router]);

  return (
    <CallContext.Provider
      value={{
        activeCall,
        isPopupVisible,
        isPopupMinimized,
        isOnCallPage,
        myExtension,
        myUserInfo,
        usersByExtension,
        openPopup,
        closePopup,
        minimizePopup,
        restorePopup,
        navigateToCall,
      }}
    >
      {children}

      {/*
        Call UI Logic:
        - Ringing: Show incoming call toast with customer info
        - Answered but not on call page: Show mini bar
        - On /calls/active/[sessionId]: Full-page handles everything
      */}

      {/* Incoming Call Toast - Shows when call is ringing */}
      {activeCall && isPopupVisible && activeCall.status === "ringing" && (
        <div className="fixed bottom-4 right-4 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 p-4 z-50 w-80 animate-in slide-in-from-bottom-4 duration-300">
          <div className="flex items-start gap-3">
            {/* Pulsing phone icon */}
            <div className="flex-shrink-0 w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
              <span className="text-2xl animate-pulse">📞</span>
            </div>

            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-green-600 dark:text-green-400 uppercase tracking-wide mb-1">
                Incoming Call
              </div>

              {/* Customer/Caller info */}
              {activeCall.customerName ? (
                <>
                  <div className="font-semibold text-gray-900 dark:text-white truncate">
                    {activeCall.customerName}
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    {activeCall.phoneNumber}
                  </div>
                </>
              ) : (
                <div className="font-semibold text-gray-900 dark:text-white">
                  {activeCall.phoneNumber}
                </div>
              )}

              {/* Direction badge */}
              <div className="mt-2 inline-flex items-center text-xs text-gray-500 dark:text-gray-400">
                <span className="mr-1">{activeCall.direction === "inbound" ? "↓" : "↑"}</span>
                {activeCall.direction === "inbound" ? "Inbound" : "Outbound"}
              </div>
            </div>

            {/* Dismiss button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                closePopup();
              }}
              className="flex-shrink-0 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded"
              title="Dismiss"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Action button - Go to call screen */}
          <button
            onClick={() => navigateToCall(activeCall.sessionId)}
            className="mt-3 w-full py-2 px-4 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            View Call
          </button>
        </div>
      )}

      {/* Minimized Call Bar - Shows when user navigates away from active call page */}
      {activeCall && isPopupVisible && activeCall.status !== "ringing" && !isOnCallPage && (
        <div
          onClick={() => navigateToCall(activeCall.sessionId)}
          className="fixed bottom-4 right-4 bg-gray-900 text-white rounded-lg shadow-xl p-3 cursor-pointer hover:bg-gray-800 z-50"
        >
          <div className="flex items-center gap-3">
            <span className="text-green-400 animate-pulse">📞</span>
            <div>
              <div className="font-medium">{activeCall.customerName || activeCall.phoneNumber}</div>
              <div className="text-xs text-gray-400">
                {activeCall.status === "connected"
                  ? "Active Call - Click to return"
                  : activeCall.status}
              </div>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                closePopup();
              }}
              className="ml-2 p-1 hover:bg-gray-700 rounded"
              title="End call session"
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
