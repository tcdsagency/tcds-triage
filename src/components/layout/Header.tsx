'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Bell, Search, Menu, LogOut, User, MessageSquare, Check, ExternalLink, Wifi, WifiOff, Users, FileText, Phone, Loader2 } from 'lucide-react';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { useSMSStream } from '@/hooks/useSMSStream';
import { NotificationBell } from '@/components/features/NotificationBell';
import { useRealtimeNotifications } from '@/components/providers/NotificationProvider';

interface HeaderProps {
  user: SupabaseUser;
}

interface SearchResult {
  id: string;
  type: 'customer' | 'lead' | 'policy' | 'call';
  title: string;
  subtitle?: string;
  href: string;
}

interface UserProfile {
  firstName?: string;
  lastName?: string;
  phone?: string;
  directDial?: string;
  currentStatus?: string;
  isAvailable?: boolean;
  extension?: string;
}

export function Header({ user }: HeaderProps) {
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const supabase = createClient();

  // Fetch user profile
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await fetch('/api/auth/me');
        const data = await res.json();
        if (data.success && data.user) {
          setUserProfile(data.user);
        }
      } catch (err) {
        console.error('Error fetching user profile:', err);
      }
    };
    fetchProfile();
  }, []);

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Close search results when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSearchResults(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keyboard shortcut (Cmd+K or Ctrl+K) to focus search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Search function
  const handleSearch = useCallback(async (query: string) => {
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    setSearchLoading(true);
    try {
      const res = await fetch(`/api/customers/search?q=${encodeURIComponent(query)}&limit=8`);
      const data = await res.json();

      if (data.results) {
        const results: SearchResult[] = data.results.map((r: any) => ({
          id: r.id,
          type: r.isLead ? 'lead' : 'customer',
          title: `${r.firstName} ${r.lastName}`,
          subtitle: r.email || r.phone || (r.isLead ? 'Lead' : 'Customer'),
          href: r.isLead ? `/leads?id=${r.id}` : `/customer/${r.id}`,
        }));
        setSearchResults(results);
      }
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setSearchLoading(false);
    }
  }, []);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery) {
        handleSearch(searchQuery);
        setShowSearchResults(true);
      } else {
        setSearchResults([]);
        setShowSearchResults(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, handleSearch]);

  const handleSelectResult = (result: SearchResult) => {
    router.push(result.href);
    setSearchQuery('');
    setSearchResults([]);
    setShowSearchResults(false);
  };

  const getResultIcon = (type: string) => {
    switch (type) {
      case 'customer': return Users;
      case 'lead': return Users;
      case 'policy': return FileText;
      case 'call': return Phone;
      default: return Users;
    }
  };

  // Use real-time SSE stream for SMS notifications
  const {
    messages: unreadMessages,
    unreadCount,
    isConnected,
    acknowledgeMessage,
    acknowledgeAll,
  } = useSMSStream(true);

  // Enable browser notifications via WebSocket
  useRealtimeNotifications();

  // Acknowledge a single message
  const handleAcknowledge = async (messageId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await acknowledgeMessage(messageId);
  };

  // Acknowledge all messages
  const handleAcknowledgeAll = async () => {
    await acknowledgeAll();
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
        <div ref={searchRef} className="relative flex flex-1">
          <label htmlFor="search-field" className="sr-only">
            Search
          </label>
          <Search className="pointer-events-none absolute inset-y-0 left-0 h-full w-5 text-gray-400" />
          <input
            ref={searchInputRef}
            id="search-field"
            className="block h-full w-full border-0 py-0 pl-8 pr-16 text-gray-900 placeholder:text-gray-400 focus:ring-0 sm:text-sm"
            placeholder="Search customers, policies, calls..."
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => searchResults.length > 0 && setShowSearchResults(true)}
          />
          {/* Keyboard shortcut hint */}
          <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
            {searchLoading ? (
              <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
            ) : (
              <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-400 bg-gray-100 rounded border border-gray-200">
                <span className="text-xs">⌘</span>K
              </kbd>
            )}
          </div>

          {/* Search Results Dropdown */}
          {showSearchResults && searchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white rounded-lg shadow-lg ring-1 ring-black ring-opacity-5 max-h-80 overflow-y-auto">
              {searchResults.map((result) => {
                const Icon = getResultIcon(result.type);
                return (
                  <button
                    key={`${result.type}-${result.id}`}
                    onClick={() => handleSelectResult(result)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 text-left border-b border-gray-100 last:border-b-0"
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      result.type === 'lead' ? 'bg-amber-100' : 'bg-blue-100'
                    }`}>
                      <Icon className={`w-4 h-4 ${
                        result.type === 'lead' ? 'text-amber-600' : 'text-blue-600'
                      }`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{result.title}</p>
                      <p className="text-xs text-gray-500 truncate">{result.subtitle}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      result.type === 'lead'
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-blue-100 text-blue-700'
                    }`}>
                      {result.type}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* No results message */}
          {showSearchResults && searchQuery.length >= 2 && !searchLoading && searchResults.length === 0 && (
            <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white rounded-lg shadow-lg ring-1 ring-black ring-opacity-5 p-4 text-center">
              <p className="text-sm text-gray-500">No results found for "{searchQuery}"</p>
            </div>
          )}
        </div>

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
              {/* Connection status indicator */}
              <span
                className={`absolute bottom-0.5 right-0.5 h-2 w-2 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-gray-400'}`}
                title={isConnected ? 'Real-time connected' : 'Reconnecting...'}
              />
            </button>

            {/* Notifications Dropdown */}
            {showNotifications && (
              <div className="absolute right-0 z-50 mt-2 w-80 origin-top-right rounded-lg bg-white shadow-lg ring-1 ring-black ring-opacity-5">
                <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-gray-900">
                      Messages {unreadCount > 0 && `(${unreadCount})`}
                    </h3>
                    {isConnected ? (
                      <span className="flex items-center gap-1 text-[10px] text-emerald-600">
                        <Wifi className="h-3 w-3" /> Live
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[10px] text-gray-400">
                        <WifiOff className="h-3 w-3" /> Offline
                      </span>
                    )}
                  </div>
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

          {/* Browser Notification Settings */}
          <NotificationBell />

          {/* Separator */}
          <div className="hidden lg:block lg:h-6 lg:w-px lg:bg-gray-200" />

          {/* User menu */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-x-3 -m-1.5 p-1.5"
            >
              <div className="relative">
                <div className="h-8 w-8 rounded-full bg-emerald-600 flex items-center justify-center">
                  <span className="text-white text-sm font-medium">
                    {userProfile?.firstName?.charAt(0).toUpperCase() || user.email?.charAt(0).toUpperCase()}
                  </span>
                </div>
                {/* Status indicator */}
                <span className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white ${
                  userProfile?.isAvailable ? 'bg-green-500' : 'bg-gray-400'
                }`} />
              </div>
              <span className="hidden lg:flex lg:flex-col lg:items-start">
                <span className="text-sm font-medium text-gray-900">
                  {userProfile?.firstName && userProfile?.lastName
                    ? `${userProfile.firstName} ${userProfile.lastName}`
                    : user.email}
                </span>
                <span className="text-xs text-gray-500 flex items-center gap-1">
                  {userProfile?.directDial || userProfile?.phone || userProfile?.extension ? (
                    <>
                      <Phone className="h-3 w-3" />
                      {userProfile.directDial || userProfile.phone || `Ext ${userProfile.extension}`}
                    </>
                  ) : (
                    <span className="capitalize">{userProfile?.currentStatus || 'Available'}</span>
                  )}
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
