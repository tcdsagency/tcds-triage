'use client';

import { useEffect } from 'react';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Fetch user's theme preference and apply immediately
    async function applyTheme() {
      try {
        const res = await fetch('/api/auth/me');
        const data = await res.json();

        if (data.success && data.user?.preferences?.theme) {
          const theme = data.user.preferences.theme;

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
          }
        } else {
          // Default to light if no preference set
          document.documentElement.classList.remove('dark');
        }
      } catch (error) {
        console.error('Failed to fetch theme preference:', error);
        // Default to light on error
        document.documentElement.classList.remove('dark');
      }
    }

    applyTheme();
  }, []);

  return <>{children}</>;
}
