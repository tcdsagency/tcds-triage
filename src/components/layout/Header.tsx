'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Bell, Search, Menu, LogOut, User, MessageSquare, Check, ExternalLink } from 'lucide-react';
import type { User as SupabaseUser } from '@supabase/supabase-js';

interface HeaderProps {
  user: SupabaseUser;
}

interface SMSMessage {
  id: string;
  fromNumber: string;
  body: string;
  contactName: string | null;
  createdAt: string;
  isAcknowledged: boolean;
}

export function Header({ user }: HeaderProps) {
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadMessages, setUnreadMessages] = useState<SMSMessage[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  // Fetch unread messages
  const fetchUnreadMessages = useCallback(async () => {
    try {
      const res = await fetch('/api/messages?filter=unread&limit=5');
      const data = await res.json();
      if (data.success) {
        setUnreadMessages(data.messages);
        setUnreadCount(data.unreadCount);
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  }, []);

  // Poll for new messages every 30 seconds
  useEffect(() => {
    fetchUnreadMessages();
    const interval = setInterval(fetchUnreadMessages, 30000);
    return () => clearInterval(interval);
  }, [fetchUnreadMessages]);

  // Acknowledge a single message
  const handleAcknowledge = async (messageId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await fetch(`/api/messages/${messageId}/read`, { method: 'POST' });
      setUnreadMessages(prev => prev.filter(m => m.id !== messageId));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error acknowledging message:', error);
    }
  };

  // Acknowledge all messages
  const handleAcknowledgeAll = async () => {
    try {
      await fetch('/api/messages/acknowledge-all', { method: 'POST' });
      setUnreadMessages([]);
      setUnreadCount(0);
    } catch (error) {
      console.error('Error acknowledging all messages:', error);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  // Format phone number for display
  const formatPhone = (phone: string) => {
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 11 && digits.startsWith('1')) {
      return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
    }
    if (digits.length === 10) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    }
    return phone;
  };

  // Format timestamp
  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return date.toLocaleDateString();
  };

  return (
    <header className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-4 border-b border-gray-200 bg-white px-4 shadow-sm sm:gap-x-6 sm:px-6 lg:px-8">
      {/* Mobile menu button */}
      <button
        type="button"
        className="lg:hidden -m-2.5 p-2.5 text-gray-700"
      >
        <Menu className="h-6 w-6" />
      </button>

      {/* Separator */}
      <div className="h-6 w-px bg-gray-200 lg:hidden" />

      <div className="flex flex-1 gap-x-4 self-stretch lg:gap-x-6">
        {/* Search */}
        <form className="relative flex flex-1" action="#" method="GET">
          <label htmlFor="search-field" className="sr-only">
            Search
          </label>
          <Search className="pointer-events-none absolute inset-y-0 left-0 h-full w-5 text-gray-400" />
          <input
            id="search-field"
            className="block h-full w-full border-0 py-0 pl-8 pr-0 text-gray-900 placeholder:text-gray-400 focus:ring-0 sm:text-sm"
            placeholder="Search customers, policies, calls..."
            type="search"
            name="search"
          />
        </form>

        <div className="flex items-center gap-x-4 lg:gap-x-6">
          {/* SMS Notifications */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative -m-2.5 p-2.5 text-gray-400 hover:text-gray-500"
            >
              <span className="sr-only">View messages</span>
              <Bell className="h-6 w-6" />
              {/* Notification badge */}
              {unreadCount > 0 && (
                <span className="absolute top-0.5 right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {/* Notifications Dropdown */}
            {showNotifications && (
              <div className="absolute right-0 z-50 mt-2 w-80 origin-top-right rounded-lg bg-white shadow-lg ring-1 ring-black ring-opacity-5">
                <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
                  <h3 className="text-sm font-semibold text-gray-900">
                    Messages {unreadCount > 0 && `(${unreadCount})`}
                  </h3>
                  {unreadCount > 0 && (
                    <button
                      onClick={handleAcknowledgeAll}
                      className="text-xs text-emerald-600 hover:text-emerald-700 font-medium"
                    >
                      Mark all read
                    </button>
                  )}
                </div>

                <div className="max-h-80 overflow-y-auto">
                  {unreadMessages.length === 0 ? (
                    <div className="px-4 py-8 text-center">
                      <MessageSquare className="mx-auto h-8 w-8 text-gray-300" />
                      <p className="mt-2 text-sm text-gray-500">No unread messages</p>
                    </div>
                  ) : (
                    <ul className="divide-y divide-gray-100">
                      {unreadMessages.map((message) => (
                        <li
                          key={message.id}
                          className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer"
                          onClick={() => router.push('/messages')}
                        >
                          <div className="flex-shrink-0 mt-1">
                            <div className="h-8 w-8 rounded-full bg-emerald-100 flex items-center justify-center">
                              <MessageSquare className="h-4 w-4 text-emerald-600" />
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {message.contactName || formatPhone(message.fromNumber)}
                            </p>
                            <p className="text-sm text-gray-500 line-clamp-2">
                              {message.body}
                            </p>
                            <p className="mt-1 text-xs text-gray-400">
                              {formatTime(message.createdAt)}
                            </p>
                          </div>
                          <button
                            onClick={(e) => handleAcknowledge(message.id, e)}
                            className="flex-shrink-0 p-1 text-gray-400 hover:text-emerald-600 rounded"
                            title="Mark as read"
                          >
                            <Check className="h-4 w-4" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="border-t border-gray-200 px-4 py-3">
                  <button
                    onClick={() => {
                      router.push('/messages');
                      setShowNotifications(false);
                    }}
                    className="flex w-full items-center justify-center gap-1 text-sm font-medium text-emerald-600 hover:text-emerald-700"
                  >
                    View all messages
                    <ExternalLink className="h-3 w-3" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Separator */}
          <div className="hidden lg:block lg:h-6 lg:w-px lg:bg-gray-200" />

          {/* User menu */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-x-3 -m-1.5 p-1.5"
            >
              <div className="h-8 w-8 rounded-full bg-emerald-600 flex items-center justify-center">
                <span className="text-white text-sm font-medium">
                  {user.email?.charAt(0).toUpperCase()}
                </span>
              </div>
              <span className="hidden lg:flex lg:items-center">
                <span className="text-sm font-medium text-gray-900">
                  {user.email}
                </span>
              </span>
            </button>

            {/* Dropdown */}
            {showUserMenu && (
              <div className="absolute right-0 z-10 mt-2.5 w-48 origin-top-right rounded-md bg-white py-2 shadow-lg ring-1 ring-gray-900/5">
                <a
                  href="/settings/profile"
                  className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                >
                  <User className="h-4 w-4" />
                  Your profile
                </a>
                <button
                  onClick={handleSignOut}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                >
                  <LogOut className="h-4 w-4" />
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
