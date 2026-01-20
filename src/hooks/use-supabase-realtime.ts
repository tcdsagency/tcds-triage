/**
 * Supabase Realtime Hook for Live Transcript Subscription
 *
 * Subscribes to live_transcript_segments table filtered by call_id
 * and provides real-time updates as new segments arrive.
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';

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

// =============================================================================
// HELPER: Transform database row to TranscriptSegment
// =============================================================================

function transformSegment(row: any): TranscriptSegment {
  // Map 'customer' speaker to 'caller' for UI consistency
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
    isFinal: row.is_final ?? true,
    sequenceNumber: row.sequence_number ?? 0,
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
  const [connectionState, setConnectionState] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected');

  const channelRef = useRef<RealtimeChannel | null>(null);
  const supabaseRef = useRef(createClient());

  // Fetch initial segments on mount
  const fetchInitialSegments = useCallback(async () => {
    if (!callId) return;

    try {
      const { data, error: fetchError } = await supabaseRef.current
        .from('live_transcript_segments')
        .select('*')
        .eq('call_id', callId)
        .order('sequence_number', { ascending: true });

      if (fetchError) {
        console.error('[useSupabaseRealtime] Initial fetch error:', fetchError);
        setError(new Error(fetchError.message));
        return;
      }

      if (data && data.length > 0) {
        const transformed = data.map(transformSegment);
        setSegments(transformed);
        console.log(`[useSupabaseRealtime] Loaded ${transformed.length} initial segments`);
      }
    } catch (err) {
      console.error('[useSupabaseRealtime] Error fetching initial segments:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch segments'));
    }
  }, [callId]);

  // Subscribe to realtime updates
  useEffect(() => {
    if (!enabled || !callId) {
      setConnectionState('disconnected');
      return;
    }

    const supabase = supabaseRef.current;
    setConnectionState('connecting');

    // Fetch initial data
    fetchInitialSegments();

    // Create realtime channel
    const channelName = `transcript:${callId}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'live_transcript_segments',
          filter: `call_id=eq.${callId}`,
        },
        (payload) => {
          console.log('[useSupabaseRealtime] New segment:', payload.new);
          const newSegment = transformSegment(payload.new);

          setSegments((prev) => {
            // Deduplicate by ID
            if (prev.some((s) => s.id === newSegment.id)) {
              return prev;
            }
            // Insert in sequence order
            const updated = [...prev, newSegment].sort(
              (a, b) => a.sequenceNumber - b.sequenceNumber
            );
            return updated;
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'live_transcript_segments',
          filter: `call_id=eq.${callId}`,
        },
        (payload) => {
          console.log('[useSupabaseRealtime] Segment updated:', payload.new);
          const updatedSegment = transformSegment(payload.new);

          setSegments((prev) =>
            prev.map((s) => (s.id === updatedSegment.id ? updatedSegment : s))
          );
        }
      )
      .subscribe((status) => {
        console.log(`[useSupabaseRealtime] Channel ${channelName} status:`, status);

        if (status === 'SUBSCRIBED') {
          setIsConnected(true);
          setConnectionState('connected');
          setError(null);
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          setIsConnected(false);
          setConnectionState(status === 'CHANNEL_ERROR' ? 'error' : 'disconnected');
        }
      });

    channelRef.current = channel;

    // Cleanup on unmount or callId change
    return () => {
      console.log(`[useSupabaseRealtime] Unsubscribing from ${channelName}`);
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      setIsConnected(false);
      setConnectionState('disconnected');
    };
  }, [callId, enabled, fetchInitialSegments]);

  return {
    segments,
    isConnected,
    error,
    connectionState,
  };
}

export default useSupabaseRealtime;
