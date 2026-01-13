"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";

// =============================================================================
// TYPES
// =============================================================================

interface NotificationContextType {
  isSupported: boolean;
  permission: NotificationPermission | "default";
  requestPermission: () => Promise<boolean>;
  showNotification: (title: string, options?: NotificationOptions & { playSound?: boolean }) => void;
  soundEnabled: boolean;
  setSoundEnabled: (enabled: boolean) => void;
}

interface NotificationProviderProps {
  children: React.ReactNode;
}

// =============================================================================
// CONTEXT
// =============================================================================

const NotificationContext = createContext<NotificationContextType>({
  isSupported: false,
  permission: "default",
  requestPermission: async () => false,
  showNotification: () => {},
  soundEnabled: true,
  setSoundEnabled: () => {},
});

export const useNotifications = () => useContext(NotificationContext);

// =============================================================================
// NOTIFICATION SOUND (Base64 encoded simple tone)
// =============================================================================

// Simple notification tone - 440Hz beep
const NOTIFICATION_SOUND_BASE64 = "data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBIAAAABAAEAQB8AAEAfAAABAAgAAABmYWN0BAAAAAAAAABkYXRhVgYAAICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA//////////////////7//v/+//7//v/+//7//v/9//3//f/9//3//f/8//z//P/8//z//P/7//v/+//7//v/+//6//r/+v/6//r/+v/5//n/+f/5//n/+f/4//j/+P/4//j/+P/3//f/9//3//f/9//2//b/9v/2//b/9v/1//X/9f/1//X/9f/0//T/9P/0//T/9P/z//P/8//z//P/8//y//L/8v/y//L/8v/x//H/8f/x//H/8f/w//D/8P/w//D/8P/v//D/8P/w//D/8P/x//H/8f/x//H/8f/y//L/8v/y//L/8v/z//P/8//z//P/8//0//T/9P/0//T/9P/1//X/9f/1//X/9f/2//b/9v/2//b/9v/3//f/9//3//f/9//4//j/+P/4//j/+P/5//n/+f/5//n/+f/6//r/+v/6//r/+v/7//v/+//7//v/+//8//z//P/8//z//P/9//3//f/9//3//f/+//7//v/+//7//v////////////7//v/+//7//v/+//3//f/9//3//f/9//z//P/8//z//P/8//v/+//7//v/+//7//r/+v/6//r/+v/6//n/+f/5//n/+f/5//j/+P/4//j/+P/4//f/9//3//f/9//3//b/9v/2//b/9v/2//X/9f/1//X/9f/1//T/9P/0//T/9P/0//P/8//z//P/8//z//L/8v/y//L/8v/y//H/8f/x//H/8f/x//D/8P/w//D/8P/w//D/8P/w//D/8P/w//H/8f/x//H/8f/x//L/8v/y//L/8v/y//P/8//z//P/8//z//T/9P/0//T/9P/0//X/9f/1//X/9f/1//b/9v/2//b/9v/2//f/9//3//f/9//3//j/+P/4//j/+P/4//n/+f/5//n/+f/5//r/+v/6//r/+v/6//v/+//7//v/+//7//z//P/8//z//P/8//3//f/9//3//f/9//7//v/+//7//v/+////////////gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgA==";

// =============================================================================
// PROVIDER
// =============================================================================

export function NotificationProvider({ children }: NotificationProviderProps) {
  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | "default">("default");
  const [soundEnabled, setSoundEnabled] = useState(true);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Check if notifications are supported
  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      setIsSupported(true);
      setPermission(Notification.permission);
    }

    // Load sound preference from localStorage
    const stored = localStorage.getItem("notificationSoundEnabled");
    if (stored !== null) {
      setSoundEnabled(stored === "true");
    }

    // Create audio element for notification sound
    audioRef.current = new Audio(NOTIFICATION_SOUND_BASE64);
    audioRef.current.volume = 0.5;
  }, []);

  // Save sound preference
  useEffect(() => {
    localStorage.setItem("notificationSoundEnabled", String(soundEnabled));
  }, [soundEnabled]);

  // Request notification permission
  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!isSupported) return false;

    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      return result === "granted";
    } catch (error) {
      console.error("[Notifications] Permission request failed:", error);
      return false;
    }
  }, [isSupported]);

  // Play notification sound
  const playSound = useCallback(() => {
    if (soundEnabled && audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch((e) => {
        // Ignore autoplay errors (user hasn't interacted yet)
        console.debug("[Notifications] Sound play failed:", e.message);
      });
    }
  }, [soundEnabled]);

  // Show a notification
  const showNotification = useCallback(
    (title: string, options?: NotificationOptions & { playSound?: boolean }) => {
      const { playSound: shouldPlaySound = true, ...notificationOptions } = options || {};

      // Play sound if enabled
      if (shouldPlaySound) {
        playSound();
      }

      // Show browser notification if permitted
      if (isSupported && permission === "granted") {
        try {
          const notification = new Notification(title, {
            tag: options?.tag || "tcds-notification",
            ...notificationOptions,
          } as NotificationOptions);

          // Auto-close after 5 seconds
          setTimeout(() => notification.close(), 5000);

          // Focus window on click
          notification.onclick = () => {
            window.focus();
            notification.close();
          };
        } catch (error) {
          console.error("[Notifications] Failed to show notification:", error);
        }
      }
    },
    [isSupported, permission, playSound]
  );

  return (
    <NotificationContext.Provider
      value={{
        isSupported,
        permission,
        requestPermission,
        showNotification,
        soundEnabled,
        setSoundEnabled,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

// =============================================================================
// REALTIME NOTIFICATION HOOK
// =============================================================================

/**
 * Hook to listen for realtime events and show notifications
 * Call this in a component that's always mounted (e.g., layout)
 */
export function useRealtimeNotifications() {
  const { showNotification, permission } = useNotifications();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 3; // Stop trying after 3 failed attempts

  useEffect(() => {
    // Don't connect if notifications aren't enabled
    if (permission !== "granted") return;

    const wsUrl = process.env.NEXT_PUBLIC_REALTIME_WS_URL;

    // Skip WebSocket connection if no URL is configured
    if (!wsUrl) {
      console.debug("[RealtimeNotifications] No WebSocket URL configured, skipping realtime connection");
      return;
    }

    const connect = () => {
      // Stop reconnecting after max attempts
      if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
        console.debug("[RealtimeNotifications] Max reconnect attempts reached, stopping");
        return;
      }

      try {
        console.debug("[RealtimeNotifications] Connecting to", wsUrl);
        wsRef.current = new WebSocket(wsUrl);

        wsRef.current.onopen = () => {
          console.debug("[RealtimeNotifications] Connected");
          reconnectAttemptsRef.current = 0; // Reset on successful connection
        };

        wsRef.current.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            handleRealtimeEvent(data);
          } catch (e) {
            console.debug("[RealtimeNotifications] Parse error:", e);
          }
        };

        wsRef.current.onclose = () => {
          reconnectAttemptsRef.current++;
          if (reconnectAttemptsRef.current < maxReconnectAttempts) {
            console.debug("[RealtimeNotifications] Disconnected, reconnecting...");
            reconnectTimeoutRef.current = setTimeout(connect, 5000);
          }
        };

        wsRef.current.onerror = () => {
          // Silently handle errors - onclose will trigger reconnect
        };
      } catch (error) {
        reconnectAttemptsRef.current++;
        if (reconnectAttemptsRef.current < maxReconnectAttempts) {
          reconnectTimeoutRef.current = setTimeout(connect, 5000);
        }
      }
    };

    const handleRealtimeEvent = (data: any) => {
      switch (data.type) {
        case "new_sms":
        case "incoming_sms":
          showNotification("New Text Message", {
            body: `${data.contactName || data.from || "Unknown"}: ${data.body?.substring(0, 100) || "New message"}`,
            tag: `sms-${data.id || Date.now()}`,
          });
          break;

        case "pending_review":
        case "new_wrapup":
          showNotification("New Item for Review", {
            body: `${data.contactName || "Unknown"} - ${data.summary?.substring(0, 100) || "Pending review"}`,
            tag: `review-${data.id || Date.now()}`,
          });
          break;

        case "call_ringing":
          showNotification("Incoming Call", {
            body: `${data.callerName || data.phoneNumber || "Unknown caller"}`,
            tag: `call-${data.sessionId || Date.now()}`,
          });
          break;
      }
    };

    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [permission, showNotification]);
}
