'use client';

import { useState, useEffect, useCallback } from 'react';

export interface UserProfile {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  directDial?: string;
  currentStatus?: string;
  isAvailable?: boolean;
  extension?: string;
  avatarUrl?: string | null;
  role?: string;
  featurePermissions?: string[];
  preferences?: Record<string, unknown>;
}

interface UseUserReturn {
  user: UserProfile | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

// Simple in-memory cache for user data
let cachedUser: UserProfile | null = null;
let cacheTimestamp: number = 0;
let fetchPromise: Promise<UserProfile | null> | null = null;
const CACHE_DURATION = 60000; // 60 seconds

// Shared fetch function that deduplicates requests
async function fetchUser(): Promise<UserProfile | null> {
  // Return cached data if still valid
  if (cachedUser && Date.now() - cacheTimestamp < CACHE_DURATION) {
    return cachedUser;
  }

  // If already fetching, return the existing promise
  if (fetchPromise) {
    return fetchPromise;
  }

  // Start a new fetch
  fetchPromise = (async () => {
    try {
      const res = await fetch('/api/auth/me');
      const data = await res.json();

      if (data.success && data.user) {
        cachedUser = data.user;
        cacheTimestamp = Date.now();
        return data.user;
      }
      return null;
    } catch (err) {
      console.error('[useUser] Error fetching user:', err);
      return null;
    } finally {
      fetchPromise = null;
    }
  })();

  return fetchPromise;
}

/**
 * Shared hook for getting the current user profile.
 * Caches data for 60 seconds and deduplicates concurrent requests.
 * Use this instead of directly fetching /api/auth/me in components.
 */
export function useUser(): UseUserReturn {
  const [user, setUser] = useState<UserProfile | null>(cachedUser);
  const [loading, setLoading] = useState(!cachedUser);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);

    // Force cache invalidation
    cacheTimestamp = 0;

    try {
      const userData = await fetchUser();
      setUser(userData);
    } catch (err) {
      setError('Failed to fetch user');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // If we have cached data, use it immediately
    if (cachedUser && Date.now() - cacheTimestamp < CACHE_DURATION) {
      setUser(cachedUser);
      setLoading(false);
      return;
    }

    // Otherwise, fetch
    let mounted = true;

    fetchUser().then((userData) => {
      if (mounted) {
        setUser(userData);
        setLoading(false);
      }
    }).catch(() => {
      if (mounted) {
        setError('Failed to fetch user');
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
    };
  }, []);

  return { user, loading, error, refetch };
}

/**
 * Invalidate the user cache (call after profile updates)
 */
export function invalidateUserCache() {
  cachedUser = null;
  cacheTimestamp = 0;
}
