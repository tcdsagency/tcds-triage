'use client';

/**
 * Command Palette Component (Cmd+K)
 * =================================
 * A searchable command menu like Spotlight, Slack, or Linear.
 * Allows quick navigation and actions with keyboard.
 */

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

// =============================================================================
// TYPES
// =============================================================================

export interface CommandItem {
  id: string;
  label: string;
  description?: string;
  icon?: React.ReactNode;
  category: 'page' | 'action' | 'customer' | 'recent';
  shortcut?: string;
  onSelect: () => void;
  keywords?: string[];
}

export interface CommandPaletteProps {
  /** Whether the palette is open */
  isOpen: boolean;
  /** Callback when palette should close */
  onClose: () => void;
  /** Additional items to include */
  additionalItems?: CommandItem[];
  /** Callback to search customers (async) */
  onSearchCustomers?: (query: string) => Promise<CommandItem[]>;
  /** Placeholder text */
  placeholder?: string;
}

// =============================================================================
// ICONS
// =============================================================================

const SearchIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
);

const HomeIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
  </svg>
);

const InboxIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
  </svg>
);

const PhoneIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
  </svg>
);

const UsersIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
  </svg>
);

const DocumentIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);

const ChartIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
  </svg>
);

const PlusIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
  </svg>
);

const ClockIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const AlertIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
  </svg>
);

const SettingsIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const MessageIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
  </svg>
);

const UserIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
  </svg>
);

const MapIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
  </svg>
);

// =============================================================================
// FUZZY SEARCH
// =============================================================================

function fuzzyMatch(pattern: string, text: string): { match: boolean; score: number } {
  pattern = pattern.toLowerCase();
  text = text.toLowerCase();

  if (pattern.length === 0) return { match: true, score: 1 };
  if (pattern.length > text.length) return { match: false, score: 0 };

  // Check for exact substring match first (highest score)
  if (text.includes(pattern)) {
    const position = text.indexOf(pattern);
    // Earlier matches are better
    return { match: true, score: 1 - (position / text.length) * 0.5 };
  }

  // Fuzzy matching
  let patternIdx = 0;
  let score = 0;
  let lastMatchIdx = -1;

  for (let textIdx = 0; textIdx < text.length && patternIdx < pattern.length; textIdx++) {
    if (text[textIdx] === pattern[patternIdx]) {
      // Consecutive matches get bonus
      if (lastMatchIdx >= 0 && textIdx === lastMatchIdx + 1) {
        score += 0.2;
      }
      // Match at start of word gets bonus
      if (textIdx === 0 || text[textIdx - 1] === ' ') {
        score += 0.15;
      }
      score += 0.1;
      lastMatchIdx = textIdx;
      patternIdx++;
    }
  }

  if (patternIdx === pattern.length) {
    return { match: true, score: Math.min(score, 0.9) };
  }

  return { match: false, score: 0 };
}

// =============================================================================
// KEYBOARD SHORTCUT DISPLAY
// =============================================================================

function KeyboardShortcut({ shortcut }: { shortcut: string }) {
  const parts = shortcut.split('+');
  const isMac = typeof navigator !== 'undefined' && navigator.platform.includes('Mac');

  return (
    <span className="flex items-center gap-0.5 text-xs text-gray-400">
      {parts.map((part, idx) => {
        let display = part;
        if (part.toLowerCase() === 'cmd') display = isMac ? '⌘' : 'Ctrl';
        if (part.toLowerCase() === 'ctrl') display = isMac ? '⌃' : 'Ctrl';
        if (part.toLowerCase() === 'alt') display = isMac ? '⌥' : 'Alt';
        if (part.toLowerCase() === 'shift') display = '⇧';

        return (
          <kbd
            key={idx}
            className="min-w-[20px] h-5 px-1.5 flex items-center justify-center bg-gray-100 dark:bg-gray-700 rounded text-[10px] font-medium"
          >
            {display}
          </kbd>
        );
      })}
    </span>
  );
}

// =============================================================================
// COMPONENT
// =============================================================================

export function CommandPalette({
  isOpen,
  onClose,
  additionalItems = [],
  onSearchCustomers,
  placeholder = 'Search...',
}: CommandPaletteProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [customerResults, setCustomerResults] = useState<CommandItem[]>([]);
  const [isSearchingCustomers, setIsSearchingCustomers] = useState(false);

  // Default navigation items
  const navigationItems: CommandItem[] = useMemo(() => [
    {
      id: 'nav-dashboard',
      label: 'Dashboard',
      icon: <HomeIcon />,
      category: 'page',
      shortcut: 'Cmd+1',
      keywords: ['home', 'main', 'overview'],
      onSelect: () => router.push('/'),
    },
    {
      id: 'nav-triage-log',
      label: 'Triage Log',
      icon: <InboxIcon />,
      category: 'page',
      shortcut: 'Cmd+2',
      keywords: ['log', 'triage', 'calls', 'outcomes'],
      onSelect: () => router.push('/triage-log'),
    },
    {
      id: 'nav-lead-queue',
      label: 'Lead Queue',
      icon: <ChartIcon />,
      category: 'page',
      shortcut: 'Cmd+3',
      keywords: ['leads', 'prospects', 'sales'],
      onSelect: () => router.push('/lead-queue'),
    },
    {
      id: 'nav-calls',
      label: 'Calls',
      icon: <PhoneIcon />,
      category: 'page',
      shortcut: 'Cmd+4',
      keywords: ['phone', 'recordings', 'call log'],
      onSelect: () => router.push('/calls'),
    },
    {
      id: 'nav-customers',
      label: 'Customers',
      icon: <UsersIcon />,
      category: 'page',
      shortcut: 'Cmd+5',
      keywords: ['clients', 'accounts', 'insureds'],
      onSelect: () => router.push('/customers'),
    },
    {
      id: 'nav-quotes',
      label: 'Quotes',
      icon: <DocumentIcon />,
      category: 'page',
      keywords: ['proposals', 'pricing'],
      onSelect: () => router.push('/quotes'),
    },
    {
      id: 'nav-messages',
      label: 'Messages',
      icon: <MessageIcon />,
      category: 'page',
      keywords: ['sms', 'text', 'inbox'],
      onSelect: () => router.push('/messages'),
    },
    {
      id: 'nav-properties',
      label: 'Property Intelligence',
      icon: <MapIcon />,
      category: 'page',
      keywords: ['property', 'lookup', 'risk', 'aerial'],
      onSelect: () => router.push('/properties'),
    },
    {
      id: 'nav-risk-monitor',
      label: 'Risk Monitor',
      icon: <AlertIcon />,
      category: 'page',
      keywords: ['alerts', 'monitoring', 'property risk'],
      onSelect: () => router.push('/risk-monitor'),
    },
    {
      id: 'nav-settings',
      label: 'Settings',
      icon: <SettingsIcon />,
      category: 'page',
      keywords: ['preferences', 'configuration', 'profile'],
      onSelect: () => router.push('/settings'),
    },
  ], [router]);

  // Default action items
  const actionItems: CommandItem[] = useMemo(() => [
    {
      id: 'action-new-quote',
      label: 'Create New Quote',
      icon: <PlusIcon />,
      category: 'action',
      shortcut: 'Cmd+N',
      keywords: ['add', 'create', 'quote', 'proposal'],
      onSelect: () => router.push('/quotes/new'),
    },
    {
      id: 'action-add-customer',
      label: 'Add Customer',
      icon: <PlusIcon />,
      category: 'action',
      keywords: ['add', 'create', 'customer', 'client'],
      onSelect: () => router.push('/customers/new'),
    },
  ], [router]);

  // Combine and filter items based on query
  const filteredItems = useMemo(() => {
    const allItems = [...navigationItems, ...actionItems, ...additionalItems, ...customerResults];

    if (!query.trim()) {
      // Show categories without search
      return allItems.filter(item => item.category !== 'customer').slice(0, 10);
    }

    // Score and filter items
    const scored = allItems.map(item => {
      const labelMatch = fuzzyMatch(query, item.label);
      const descMatch = item.description ? fuzzyMatch(query, item.description) : { match: false, score: 0 };
      const keywordMatches = (item.keywords || []).map(k => fuzzyMatch(query, k));
      const bestKeywordMatch = keywordMatches.reduce((best, m) => m.score > best.score ? m : best, { match: false, score: 0 });

      const isMatch = labelMatch.match || descMatch.match || bestKeywordMatch.match;
      const score = Math.max(labelMatch.score, descMatch.score * 0.8, bestKeywordMatch.score * 0.7);

      return { item, isMatch, score };
    });

    return scored
      .filter(s => s.isMatch)
      .sort((a, b) => b.score - a.score)
      .map(s => s.item)
      .slice(0, 10);
  }, [query, navigationItems, actionItems, additionalItems, customerResults]);

  // Search customers when query changes
  useEffect(() => {
    if (!onSearchCustomers || query.length < 2) {
      setCustomerResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearchingCustomers(true);
      try {
        const results = await onSearchCustomers(query);
        setCustomerResults(results);
      } catch (err) {
        console.error('Customer search failed:', err);
        setCustomerResults([]);
      } finally {
        setIsSearchingCustomers(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query, onSearchCustomers]);

  // Reset state when closing
  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setCustomerResults([]);
    } else {
      // Focus input when opening
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Reset selected index when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [filteredItems.length]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(i => Math.min(i + 1, filteredItems.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(i => Math.max(i - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredItems[selectedIndex]) {
          filteredItems[selectedIndex].onSelect();
          onClose();
        }
        break;
      case 'Escape':
        e.preventDefault();
        onClose();
        break;
    }
  }, [filteredItems, selectedIndex, onClose]);

  // Scroll selected item into view
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;

    const selectedEl = list.querySelector(`[data-index="${selectedIndex}"]`);
    if (selectedEl) {
      selectedEl.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  // Group items by category
  const groupedItems = useMemo(() => {
    const groups: Record<string, CommandItem[]> = {
      recent: [],
      page: [],
      action: [],
      customer: [],
    };

    filteredItems.forEach(item => {
      if (groups[item.category]) {
        groups[item.category].push(item);
      }
    });

    return groups;
  }, [filteredItems]);

  if (!isOpen) return null;

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case 'recent': return 'Recent';
      case 'page': return 'Pages';
      case 'action': return 'Actions';
      case 'customer': return 'Customers';
      default: return category;
    }
  };

  let itemIndex = 0;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-50 animate-in fade-in duration-150"
        onClick={onClose}
      />

      {/* Palette */}
      <div className="fixed inset-x-4 top-[20%] mx-auto max-w-xl z-50 animate-in fade-in slide-in-from-top-4 duration-200">
        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          {/* Search Input */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <span className="text-gray-400">
              <SearchIcon />
            </span>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              className="flex-1 bg-transparent text-gray-900 dark:text-white placeholder-gray-400 outline-none text-sm"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
            />
            {isSearchingCustomers && (
              <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            )}
            <KeyboardShortcut shortcut="Esc" />
          </div>

          {/* Results */}
          <div ref={listRef} className="max-h-[60vh] overflow-y-auto">
            {filteredItems.length === 0 ? (
              <div className="px-4 py-8 text-center text-gray-500 dark:text-gray-400 text-sm">
                No results found for "{query}"
              </div>
            ) : (
              <div className="py-2">
                {['recent', 'page', 'action', 'customer'].map(category => {
                  const items = groupedItems[category];
                  if (items.length === 0) return null;

                  return (
                    <div key={category}>
                      <div className="px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wide">
                        {getCategoryLabel(category)}
                      </div>
                      {items.map(item => {
                        const idx = itemIndex++;
                        const isSelected = idx === selectedIndex;

                        return (
                          <button
                            key={item.id}
                            data-index={idx}
                            onClick={() => {
                              item.onSelect();
                              onClose();
                            }}
                            onMouseEnter={() => setSelectedIndex(idx)}
                            className={cn(
                              'w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors',
                              isSelected
                                ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                            )}
                          >
                            <span className={cn(
                              'flex-shrink-0',
                              isSelected ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400'
                            )}>
                              {item.icon || <DocumentIcon />}
                            </span>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium truncate">
                                {item.label}
                              </div>
                              {item.description && (
                                <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                  {item.description}
                                </div>
                              )}
                            </div>
                            {item.shortcut && (
                              <KeyboardShortcut shortcut={item.shortcut} />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between text-xs text-gray-400">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <kbd className="px-1 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-[10px]">↑↓</kbd>
                navigate
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-[10px]">↵</kbd>
                select
              </span>
            </div>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-[10px]">esc</kbd>
              close
            </span>
          </div>
        </div>
      </div>
    </>
  );
}

export default CommandPalette;
