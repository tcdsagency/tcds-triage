'use client';

/**
 * Keyboard Shortcuts Provider
 * ===========================
 * Provides the Command Palette and global keyboard shortcuts
 * throughout the dashboard.
 */

import { CommandPalette } from '@/components/CommandPalette';

export function KeyboardShortcutsProvider({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <CommandPalette />
    </>
  );
}

export default KeyboardShortcutsProvider;
