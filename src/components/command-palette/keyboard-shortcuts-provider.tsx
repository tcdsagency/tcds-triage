'use client';

/**
 * Keyboard Shortcuts Provider
 * ===========================
 * Provides global keyboard shortcuts throughout the app.
 * Handles Cmd+K for command palette, Cmd+1-9 for navigation, etc.
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { CommandPalette, type CommandItem } from './command-palette';

// =============================================================================
// TYPES
// =============================================================================

interface KeyboardShortcutsContextValue {
  /** Open the command palette */
  openCommandPalette: () => void;
  /** Close the command palette */
  closeCommandPalette: () => void;
  /** Toggle the command palette */
  toggleCommandPalette: () => void;
  /** Whether command palette is open */
  isCommandPaletteOpen: boolean;
  /** Open the shortcuts help modal */
  openShortcutsHelp: () => void;
  /** Close the shortcuts help modal */
  closeShortcutsHelp: () => void;
  /** Whether shortcuts help is open */
  isShortcutsHelpOpen: boolean;
  /** Register additional command palette items */
  registerItems: (items: CommandItem[]) => void;
  /** Unregister command palette items */
  unregisterItems: (ids: string[]) => void;
}

interface KeyboardShortcutsProviderProps {
  children: React.ReactNode;
  /** Callback to search customers */
  onSearchCustomers?: (query: string) => Promise<CommandItem[]>;
}

// =============================================================================
// CONTEXT
// =============================================================================

const KeyboardShortcutsContext = createContext<KeyboardShortcutsContextValue | null>(null);

export function useKeyboardShortcuts() {
  const context = useContext(KeyboardShortcutsContext);
  if (!context) {
    throw new Error('useKeyboardShortcuts must be used within KeyboardShortcutsProvider');
  }
  return context;
}

// =============================================================================
// SHORTCUTS HELP MODAL
// =============================================================================

interface ShortcutsHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function ShortcutsHelpModal({ isOpen, onClose }: ShortcutsHelpModalProps) {
  const isMac = typeof navigator !== 'undefined' && navigator.platform.includes('Mac');
  const cmdKey = isMac ? '⌘' : 'Ctrl';

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const shortcuts = [
    { category: 'Navigation', items: [
      { keys: `${cmdKey}+K`, description: 'Open command palette' },
      { keys: `${cmdKey}+1`, description: 'Go to Dashboard' },
      { keys: `${cmdKey}+2`, description: 'Go to Pending Review' },
      { keys: `${cmdKey}+3`, description: 'Go to Lead Queue' },
      { keys: `${cmdKey}+4`, description: 'Go to Call History & Triage' },
      { keys: `${cmdKey}+5`, description: 'Go to Customers' },
    ]},
    { category: 'Actions', items: [
      { keys: `${cmdKey}+N`, description: 'New Quote' },
      { keys: `${cmdKey}+/`, description: 'Show keyboard shortcuts' },
      { keys: '?', description: 'Show keyboard shortcuts' },
    ]},
    { category: 'General', items: [
      { keys: 'Esc', description: 'Close modal / Cancel action' },
      { keys: 'J / K', description: 'Navigate list (down / up)' },
      { keys: 'Enter', description: 'Select / Open' },
    ]},
  ];

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-50 animate-in fade-in duration-150"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-x-4 top-[15%] mx-auto max-w-md z-50 animate-in fade-in slide-in-from-top-4 duration-200">
        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707" />
              </svg>
              Keyboard Shortcuts
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto">
            {shortcuts.map(section => (
              <div key={section.category}>
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                  {section.category}
                </h3>
                <div className="space-y-1">
                  {section.items.map((shortcut, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between py-1.5"
                    >
                      <span className="text-sm text-gray-600 dark:text-gray-300">
                        {shortcut.description}
                      </span>
                      <div className="flex items-center gap-1">
                        {shortcut.keys.split('+').map((key, kidx) => (
                          <kbd
                            key={kidx}
                            className="min-w-[24px] h-6 px-1.5 flex items-center justify-center bg-gray-100 dark:bg-gray-700 rounded text-xs font-medium text-gray-600 dark:text-gray-300"
                          >
                            {key.trim()}
                          </kbd>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
            <p className="text-xs text-gray-500 text-center">
              Press <kbd className="px-1 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-[10px]">?</kbd> anywhere to show this help
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

// =============================================================================
// PROVIDER
// =============================================================================

export function KeyboardShortcutsProvider({
  children,
  onSearchCustomers,
}: KeyboardShortcutsProviderProps) {
  const router = useRouter();
  const pathname = usePathname();

  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isShortcutsHelpOpen, setIsShortcutsHelpOpen] = useState(false);
  const [additionalItems, setAdditionalItems] = useState<CommandItem[]>([]);

  // Navigation routes
  const routes = [
    '/',              // Cmd+1
    '/triage-log',    // Cmd+2
    '/lead-queue',    // Cmd+3
    '/triage-log',    // Cmd+4 (was /calls)
    '/customers',     // Cmd+5
    '/quotes',        // Cmd+6
    '/messages',      // Cmd+7
    '/properties',    // Cmd+8
    '/risk-monitor',  // Cmd+9
  ];

  // Handle global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isModKey = e.metaKey || e.ctrlKey;
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

      // Cmd+K - Command Palette (works even in inputs)
      if (isModKey && e.key === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen(prev => !prev);
        return;
      }

      // Don't trigger other shortcuts in inputs
      if (isInput && !isModKey) return;

      // Cmd+1-9 - Navigation shortcuts
      if (isModKey && e.key >= '1' && e.key <= '9') {
        const index = parseInt(e.key) - 1;
        if (index < routes.length) {
          e.preventDefault();
          router.push(routes[index]);
          return;
        }
      }

      // Cmd+N - New Quote
      if (isModKey && e.key === 'n') {
        e.preventDefault();
        router.push('/quotes/new');
        return;
      }

      // Cmd+/ or ? - Shortcuts Help
      if ((isModKey && e.key === '/') || (!isInput && e.key === '?')) {
        e.preventDefault();
        setIsShortcutsHelpOpen(true);
        return;
      }

      // Escape - Close modals
      if (e.key === 'Escape') {
        if (isCommandPaletteOpen) {
          setIsCommandPaletteOpen(false);
        } else if (isShortcutsHelpOpen) {
          setIsShortcutsHelpOpen(false);
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [router, routes, isCommandPaletteOpen, isShortcutsHelpOpen]);

  // Close command palette on navigation
  useEffect(() => {
    setIsCommandPaletteOpen(false);
  }, [pathname]);

  // Context methods
  const openCommandPalette = useCallback(() => setIsCommandPaletteOpen(true), []);
  const closeCommandPalette = useCallback(() => setIsCommandPaletteOpen(false), []);
  const toggleCommandPalette = useCallback(() => setIsCommandPaletteOpen(prev => !prev), []);
  const openShortcutsHelp = useCallback(() => setIsShortcutsHelpOpen(true), []);
  const closeShortcutsHelp = useCallback(() => setIsShortcutsHelpOpen(false), []);

  const registerItems = useCallback((items: CommandItem[]) => {
    setAdditionalItems(prev => [...prev, ...items]);
  }, []);

  const unregisterItems = useCallback((ids: string[]) => {
    setAdditionalItems(prev => prev.filter(item => !ids.includes(item.id)));
  }, []);

  const contextValue: KeyboardShortcutsContextValue = {
    openCommandPalette,
    closeCommandPalette,
    toggleCommandPalette,
    isCommandPaletteOpen,
    openShortcutsHelp,
    closeShortcutsHelp,
    isShortcutsHelpOpen,
    registerItems,
    unregisterItems,
  };

  return (
    <KeyboardShortcutsContext.Provider value={contextValue}>
      {children}

      {/* Command Palette */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={closeCommandPalette}
        additionalItems={additionalItems}
        onSearchCustomers={onSearchCustomers}
        placeholder="Search pages, actions, customers..."
      />

      {/* Shortcuts Help */}
      <ShortcutsHelpModal
        isOpen={isShortcutsHelpOpen}
        onClose={closeShortcutsHelp}
      />
    </KeyboardShortcutsContext.Provider>
  );
}

export default KeyboardShortcutsProvider;
