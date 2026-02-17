/**
 * Live Transcript Polling Hook
 *
 * Polls the transcript segment API for new segments every 2 seconds.
 * Replaces the previous Supabase Realtime subscription which required
 * publication + RLS configuration that was never set up.
 */

import { useEffect, useState, useRef, useCallback } from 'react';

// =============================================================================
// TYPES
// =============================================================================

export interface TranscriptSegment {
  id: string;
  text: string;
  speaker: 'agent' | 'caller' | 'unknown';
  timestamp: Date;
  confidence: number;
  isFinal: boolean;
  sequenceNumber: number;
}

export interface UseSupabaseRealtimeOptions {
  callId: string;
  enabled?: boolean;
}

export interface UseSupabaseRealtimeReturn {
  segments: TranscriptSegment[];
  isConnected: boolean;
  error: Error | null;
  connectionState: 'connecting' | 'connected' | 'disconnected' | 'error';
}

const POLL_INTERVAL_MS = 2000;

// =============================================================================
// HELPER: Transform API row to TranscriptSegment
// =============================================================================

function transformSegment(row: any): TranscriptSegment {
  let speaker: 'agent' | 'caller' | 'unknown' = 'unknown';
  if (row.speaker === 'agent') {
    speaker = 'agent';
  } else if (row.speaker === 'customer' || row.speaker === 'caller') {
    speaker = 'caller';
  }

  return {
    id: row.id,
    text: row.text || '',
    speaker,
    timestamp: new Date(row.timestamp || row.created_at || Date.now()),
    confidence: row.confidence ?? 1.0,
    isFinal: row.isFinal ?? row.is_final ?? true,
    sequenceNumber: row.sequenceNumber ?? row.sequence_number ?? 0,
  };
}

// =============================================================================
// HOOK
// =============================================================================

export function useSupabaseRealtime({
  callId,
  enabled = true,
}: UseSupabaseRealtimeOptions): UseSupabaseRealtimeReturn {
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [connectionState, setConnectionState] = useState<
    'connecting' | 'connected' | 'disconnected' | 'error'
  >('disconnected');

  const highWaterRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const failCountRef = useRef(0);

  const poll = useCallback(async () => {
    if (!callId) return;

    try {
      const after = highWaterRef.current;
      const res = await fetch(
        `/api/calls/${callId}/transcript/segment?after=${after}`
      );

      if (!res.ok) {
        throw new Error(`Poll failed: ${res.status}`);
      }

      const data = await res.json();
      if (!data.success) return;

      const newSegments: TranscriptSegment[] = (data.segments || []).map(transformSegment);

      if (newSegments.length > 0) {
        setSegments((prev) => {
          const existingIds = new Set(prev.map((s) => s.id));
          const deduped = newSegments.filter((s) => !existingIds.has(s.id));
          if (deduped.length === 0) return prev;
          return [...prev, ...deduped].sort(
            (a, b) => a.sequenceNumber - b.sequenceNumber
          );
        });

        const maxSeq = Math.max(...newSegments.map((s) => s.sequenceNumber));
        if (maxSeq > highWaterRef.current) {
          highWaterRef.current = maxSeq;
        }
      }

      // Mark connected on first successful poll
      failCountRef.current = 0;
      if (!isConnected) {
        setIsConnected(true);
        setConnectionState('connected');
        setError(null);
      }
    } catch (err) {
      failCountRef.current++;
      console.error('[LiveTranscript] Poll error:', err);
      // Only mark as error after 3 consecutive failures
      if (failCountRef.current >= 3) {
        setError(err instanceof Error ? err : new Error('Poll failed'));
        setConnectionState('error');
        setIsConnected(false);
      }
    }
  }, [callId, isConnected]);

  useEffect(() => {
    if (!enabled || !callId) {
      setConnectionState('disconnected');
      setIsConnected(false);
      return;
    }

    // Reset state for new call
    setSegments([]);
    highWaterRef.current = 0;
    failCountRef.current = 0;
    setConnectionState('connecting');
    setError(null);

    // Initial fetch (no after filter — get all existing segments)
    const initialFetch = async () => {
      try {
        const res = await fetch(
          `/api/calls/${callId}/transcript/segment`
        );
        if (!res.ok) throw new Error(`Initial fetch failed: ${res.status}`);

        const data = await res.json();
        if (data.success && data.segments?.length > 0) {
          const transformed = data.segments.map(transformSegment);
          setSegments(transformed);
          highWaterRef.current = Math.max(
            ...transformed.map((s: TranscriptSegment) => s.sequenceNumber)
          );
          console.log(`[LiveTranscript] Loaded ${transformed.length} initial segments`);
        }

        setIsConnected(true);
        setConnectionState('connected');
      } catch (err) {
        console.error('[LiveTranscript] Initial fetch error:', err);
        setError(err instanceof Error ? err : new Error('Initial fetch failed'));
        setConnectionState('error');
      }
    };

    initialFetch();

    // Start polling
    intervalRef.current = setInterval(poll, POLL_INTERVAL_MS);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setIsConnected(false);
      setConnectionState('disconnected');
    };
  }, [callId, enabled, poll]);

  return {
    segments,
    isConnected,
    error,
    connectionState,
  };
}

export default useSupabaseRealtime;
