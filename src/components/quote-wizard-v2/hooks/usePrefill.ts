'use client';

/**
 * usePrefill Hook
 * ================
 * Manages LexisNexis/MSB prefill API calls and form population.
 */

import { useState, useCallback } from 'react';

export type PrefillStatus = 'idle' | 'loading' | 'loaded' | 'error';

export interface PrefillResults {
  drivers?: any[];
  vehicles?: any[];
  home?: any;
}

interface UsePrefillReturn {
  status: PrefillStatus;
  results: PrefillResults | null;
  error: string | null;
  summary: string | null;
  runDriversPrefill: (applicantId: string, address: any) => Promise<any[]>;
  runVehiclesPrefill: (applicantId: string, address: any) => Promise<any[]>;
  runHomePrefill: (applicantId: string, firstName: string, lastName: string, address: any) => Promise<any>;
  runVinLookup: (vin: string) => Promise<any>;
  reset: () => void;
}

export function usePrefill(): UsePrefillReturn {
  const [status, setStatus] = useState<PrefillStatus>('idle');
  const [results, setResults] = useState<PrefillResults | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);

  const runDriversPrefill = useCallback(
    async (applicantId: string, address: any): Promise<any[]> => {
      setStatus('loading');
      setError(null);
      try {
        const res = await fetch('/api/ezlynx/prefill', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'drivers',
            params: { applicantId, address },
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Driver prefill failed');
        const drivers = data.result || [];
        setResults((prev) => ({ ...prev, drivers }));
        setSummary(`Found ${drivers.length} driver${drivers.length !== 1 ? 's' : ''}`);
        setStatus('loaded');
        return drivers;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Driver prefill failed';
        setError(msg);
        setStatus('error');
        return [];
      }
    },
    []
  );

  const runVehiclesPrefill = useCallback(
    async (applicantId: string, address: any): Promise<any[]> => {
      setStatus('loading');
      setError(null);
      try {
        const res = await fetch('/api/ezlynx/prefill', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'vehicles',
            params: { applicantId, address },
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Vehicle prefill failed');
        const vehicles = data.result || [];
        setResults((prev) => ({ ...prev, vehicles }));
        setSummary(
          (prev) =>
            (prev ? prev + ', ' : '') +
            `${vehicles.length} vehicle${vehicles.length !== 1 ? 's' : ''}`
        );
        setStatus('loaded');
        return vehicles;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Vehicle prefill failed';
        setError(msg);
        setStatus('error');
        return [];
      }
    },
    []
  );

  const runHomePrefill = useCallback(
    async (
      applicantId: string,
      firstName: string,
      lastName: string,
      address: any
    ): Promise<any> => {
      setStatus('loading');
      setError(null);
      try {
        const res = await fetch('/api/ezlynx/prefill', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'home',
            params: { applicantId, firstName, lastName, address },
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Home prefill failed');
        const home = data.result;
        setResults((prev) => ({ ...prev, home }));
        setSummary('Property data loaded');
        setStatus('loaded');
        return home;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Home prefill failed';
        setError(msg);
        setStatus('error');
        return null;
      }
    },
    []
  );

  const runVinLookup = useCallback(async (vin: string): Promise<any> => {
    try {
      const res = await fetch('/api/ezlynx/prefill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'vin',
          params: { vin },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'VIN lookup failed');
      return data.result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'VIN lookup failed';
      setError(msg);
      return null;
    }
  }, []);

  const reset = useCallback(() => {
    setStatus('idle');
    setResults(null);
    setError(null);
    setSummary(null);
  }, []);

  return {
    status,
    results,
    error,
    summary,
    runDriversPrefill,
    runVehiclesPrefill,
    runHomePrefill,
    runVinLookup,
    reset,
  };
}
