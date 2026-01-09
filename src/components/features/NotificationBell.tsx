"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Bell, BellOff, Volume2, VolumeX, Check } from "lucide-react";
import { useNotifications } from "@/components/providers/NotificationProvider";
import { cn } from "@/lib/utils";

interface NotificationBellProps {
  className?: string;
}

export function NotificationBell({ className }: NotificationBellProps) {
  const {
    isSupported,
    permission,
    requestPermission,
    showNotification,
    soundEnabled,
    setSoundEnabled,
  } = useNotifications();

  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [lastChecked, setLastChecked] = useState<Date>(new Date());
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Track previous counts for comparison
  const prevSmsCount = useRef<number>(0);
  const prevReviewCount = useRef<number>(0);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Poll for new items (fallback when WebSocket not available)
  const checkForNewItems = useCallback(async () => {
    try {
      // Check for unread SMS
      const smsRes = await fetch("/api/messages?type=sms&acknowledged=false&limit=1");
      let newSmsCount = 0;
      if (smsRes.ok) {
        const smsData = await smsRes.json();
        newSmsCount = smsData.total || smsData.messages?.length || 0;
      }

      // Check for pending review items
      const reviewRes = await fetch("/api/pending-review?limit=1");
      let newReviewCount = 0;
      if (reviewRes.ok) {
        const reviewData = await reviewRes.json();
        newReviewCount = reviewData.counts?.total || reviewData.items?.length || 0;
      }

      // Show notification if counts increased
      if (permission === "granted") {
        if (newSmsCount > prevSmsCount.current) {
          showNotification("New Text Message", {
            body: `You have ${newSmsCount} unread message${newSmsCount > 1 ? "s" : ""}`,
            tag: "sms-poll",
          });
        }

        if (newReviewCount > prevReviewCount.current) {
          showNotification("New Item for Review", {
            body: `You have ${newReviewCount} item${newReviewCount > 1 ? "s" : ""} pending review`,
            tag: "review-poll",
          });
        }
      }

      // Update counts
      prevSmsCount.current = newSmsCount;
      prevReviewCount.current = newReviewCount;
      setUnreadCount(newSmsCount + newReviewCount);
      setLastChecked(new Date());
    } catch (error) {
      console.error("[NotificationBell] Error checking for new items:", error);
    }
  }, [permission, showNotification]);

  // Poll every 30 seconds
  useEffect(() => {
    checkForNewItems(); // Initial check

    const interval = setInterval(checkForNewItems, 30000);
    return () => clearInterval(interval);
  }, [checkForNewItems]);

  // Handle permission request
  const handleEnableNotifications = async () => {
    const granted = await requestPermission();
    if (granted) {
      showNotification("Notifications Enabled", {
        body: "You'll now receive alerts for new messages and review items",
        playSound: true,
      });
    }
  };

  // Test notification
  const handleTestNotification = () => {
    showNotification("Test Notification", {
      body: "This is a test notification from TCDS Agency",
      playSound: true,
    });
  };

  if (!isSupported) {
    return null;
  }

  return (
    <div className={cn("relative", className)} ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "relative p-2 rounded-lg transition-colors",
          permission === "granted"
            ? "text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-100 dark:hover:bg-gray-700"
            : "text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:text-gray-500 dark:hover:text-gray-400 dark:hover:bg-gray-700"
        )}
        title={permission === "granted" ? "Notifications" : "Enable Notifications"}
      >
        {permission === "granted" ? (
          <Bell className="w-5 h-5" />
        ) : (
          <BellOff className="w-5 h-5" />
        )}

        {/* Unread Badge */}
        {unreadCount > 0 && permission === "granted" && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 z-50 overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">Notifications</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Last checked: {lastChecked.toLocaleTimeString()}
            </p>
          </div>

          {/* Content */}
          <div className="p-4 space-y-3">
            {/* Permission Status */}
            {permission !== "granted" ? (
              <div className="text-center py-4">
                <BellOff className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                  Enable notifications to get alerts for new messages and review items
                </p>
                <button
                  onClick={handleEnableNotifications}
                  className="px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors"
                >
                  Enable Notifications
                </button>
              </div>
            ) : (
              <>
                {/* Notification Settings */}
                <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <div className="flex items-center gap-2">
                    {soundEnabled ? (
                      <Volume2 className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <VolumeX className="w-4 h-4 text-gray-400" />
                    )}
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      Sound alerts
                    </span>
                  </div>
                  <button
                    onClick={() => setSoundEnabled(!soundEnabled)}
                    className={cn(
                      "relative w-10 h-6 rounded-full transition-colors",
                      soundEnabled ? "bg-emerald-600" : "bg-gray-300 dark:bg-gray-600"
                    )}
                  >
                    <span
                      className={cn(
                        "absolute top-1 w-4 h-4 bg-white rounded-full transition-transform shadow",
                        soundEnabled ? "left-5" : "left-1"
                      )}
                    />
                  </button>
                </div>

                {/* Status */}
                <div className="flex items-center gap-2 p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span className="text-sm text-emerald-700 dark:text-emerald-300">
                    Notifications enabled
                  </span>
                </div>

                {/* Test Button */}
                <button
                  onClick={handleTestNotification}
                  className="w-full px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  Send test notification
                </button>

                {/* Summary */}
                {unreadCount > 0 && (
                  <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      <span className="font-medium text-gray-900 dark:text-gray-100">
                        {unreadCount}
                      </span>{" "}
                      unread item{unreadCount !== 1 ? "s" : ""} awaiting action
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
