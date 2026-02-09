'use client';

import { useState, useEffect } from 'react';

export interface CommissionUserInfo {
  isAdmin: boolean;
  agentId: string | null;
  agentCodes: string[];
}

let cached: CommissionUserInfo | null = null;
let cacheTime = 0;
let fetchPromise: Promise<CommissionUserInfo | null> | null = null;
const CACHE_MS = 60000;

async function fetchCommissionUser(): Promise<CommissionUserInfo | null> {
  if (cached && Date.now() - cacheTime < CACHE_MS) return cached;
  if (fetchPromise) return fetchPromise;

  fetchPromise = (async () => {
    try {
      const res = await fetch('/api/commissions/me');
      const json = await res.json();
      if (json.success && json.data) {
        cached = json.data;
        cacheTime = Date.now();
        return cached;
      }
      return null;
    } catch {
      return null;
    } finally {
      fetchPromise = null;
    }
  })();

  return fetchPromise;
}

export function useCommissionUser() {
  const [data, setData] = useState<CommissionUserInfo | null>(cached);
  const [loading, setLoading] = useState(!cached);

  useEffect(() => {
    if (cached && Date.now() - cacheTime < CACHE_MS) {
      setData(cached);
      setLoading(false);
      return;
    }

    let mounted = true;
    fetchCommissionUser().then((result) => {
      if (mounted) {
        setData(result);
        setLoading(false);
      }
    });
    return () => { mounted = false; };
  }, []);

  return { data, loading, isAdmin: data?.isAdmin ?? false };
}
