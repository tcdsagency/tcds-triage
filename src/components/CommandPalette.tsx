'use client';

/**
 * Command Palette Component
 * =========================
 * A Spotlight/Alfred-style command palette for quick navigation and actions.
 * Press Cmd+K (Mac) or Ctrl+K (Windows) to open.
 */

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Command } from 'cmdk';
import { cn } from '@/lib/utils';

// Navigation items with their routes and icons
const NAVIGATION_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: '📊', href: '/dashboard', shortcut: '1' },
  { id: 'pending-review', label: 'Pending Review', icon: '📋', href: '/pending-review', shortcut: '2' },
  { id: 'calls', label: 'Call History', icon: '📞', href: '/calls', shortcut: '3' },
  { id: 'customers', label: 'Customers', icon: '👥', href: '/customers', shortcut: '4' },
  { id: 'risk-monitor', label: 'Property Risk Monitor', icon: '🏠', href: '/risk-monitor', shortcut: '5' },
  { id: 'leads', label: 'Leads', icon: '📈', href: '/leads', shortcut: '6' },
  { id: 'messages', label: 'Messages', icon: '💬', href: '/messages', shortcut: '7' },
  { id: 'after-hours', label: 'After Hours', icon: '🌙', href: '/after-hours', shortcut: '8' },
];

const ACTION_ITEMS = [
  { id: 'new-quote', label: 'New Quote', icon: '✨', href: '/quote/new' },
  { id: 'new-quote-auto', label: 'New Auto Quote', icon: '🚗', href: '/quote/new/personal_auto' },
  { id: 'new-quote-home', label: 'New Home Quote', icon: '🏡', href: '/quote/new/homeowners' },
  { id: 'policy-change', label: 'Policy Change Request', icon: '📝', href: '/policy-change' },
  { id: 'settings', label: 'Agency Settings', icon: '⚙️', href: '/agency-settings' },
];

interface CommandPaletteProps {
  className?: string;
}

export function CommandPalette({ className }: CommandPaletteProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const router = useRouter();

  // Open/close with Cmd+K or Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+K or Ctrl+K to toggle
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }

      // Escape to close
      if (e.key === 'Escape' && open) {
        setOpen(false);
      }

      // Number shortcuts for navigation (when palette is closed)
      if (!open && (e.metaKey || e.ctrlKey) && e.key >= '1' && e.key <= '9') {
        e.preventDefault();
        const index = parseInt(e.key) - 1;
        const navItem = NAVIGATION_ITEMS[index];
        if (navItem) {
          router.push(navItem.href);
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, router]);

  // Navigate to a route and close palette
  const handleSelect = useCallback((href: string) => {
    setOpen(false);
    setSearch('');
    router.push(href);
  }, [router]);

  // Close on backdrop click
  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      setOpen(false);
    }
  }, []);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[20vh]"
      onClick={handleBackdropClick}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      {/* Command Palette */}
      <Command
        className={cn(
          'relative w-full max-w-xl bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden',
          'animate-in fade-in zoom-in-95 duration-150',
          className
        )}
        shouldFilter={true}
      >
        {/* Search Input */}
        <div className="flex items-center border-b border-gray-200 dark:border-gray-700 px-4">
          <span className="text-gray-400 mr-3">🔍</span>
          <Command.Input
            value={search}
            onValueChange={setSearch}
            placeholder="Type a command or search..."
            className="flex-1 py-4 bg-transparent text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none text-lg"
            autoFocus
          />
          <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-400 bg-gray-100 dark:bg-gray-800 rounded">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <Command.List className="max-h-[400px] overflow-y-auto p-2">
          <Command.Empty className="py-6 text-center text-gray-500 dark:text-gray-400">
            No results found.
          </Command.Empty>

          {/* Navigation Group */}
          <Command.Group heading="Navigation" className="px-2 py-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            {NAVIGATION_ITEMS.map((item) => (
              <Command.Item
                key={item.id}
                value={item.label}
                onSelect={() => handleSelect(item.href)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer text-gray-700 dark:text-gray-200 data-[selected=true]:bg-blue-50 dark:data-[selected=true]:bg-blue-900/30 data-[selected=true]:text-blue-700 dark:data-[selected=true]:text-blue-300"
              >
                <span className="text-lg">{item.icon}</span>
                <span className="flex-1 font-medium">{item.label}</span>
                <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-medium text-gray-400 bg-gray-100 dark:bg-gray-800 rounded">
                  <span className="text-[8px]">⌘</span>{item.shortcut}
                </kbd>
              </Command.Item>
            ))}
          </Command.Group>

          {/* Actions Group */}
          <Command.Group heading="Actions" className="px-2 py-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mt-2">
            {ACTION_ITEMS.map((item) => (
              <Command.Item
                key={item.id}
                value={item.label}
                onSelect={() => handleSelect(item.href)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer text-gray-700 dark:text-gray-200 data-[selected=true]:bg-blue-50 dark:data-[selected=true]:bg-blue-900/30 data-[selected=true]:text-blue-700 dark:data-[selected=true]:text-blue-300"
              >
                <span className="text-lg">{item.icon}</span>
                <span className="flex-1 font-medium">{item.label}</span>
              </Command.Item>
            ))}
          </Command.Group>
        </Command.List>

        {/* Footer with shortcuts hint */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-400">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded">↑</kbd>
              <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded">↓</kbd>
              <span className="ml-1">to navigate</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded">↵</kbd>
              <span className="ml-1">to select</span>
            </span>
          </div>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded">⌘</kbd>
            <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded">/</kbd>
            <span className="ml-1">for shortcuts</span>
          </span>
        </div>
      </Command>
    </div>
  );
}

export default CommandPalette;
