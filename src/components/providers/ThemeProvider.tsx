'use client';

import { useEffect } from 'react';
import { useUser } from '@/hooks/useUser';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Use shared user hook (cached, deduplicates requests)
  const { user } = useUser();

  useEffect(() => {
    // Apply theme based on user preference
    const theme = (user?.preferences as Record<string, unknown>)?.theme as string | undefined;

    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else if (theme === 'light') {
      document.documentElement.classList.remove('dark');
    } else if (theme === 'system') {
      // Check system preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (prefersDark) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    } else {
      // Default to light if no preference set
      document.documentElement.classList.remove('dark');
    }
  }, [user?.preferences]);

  return <>{children}</>;
}
