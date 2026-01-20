/**
 * Claude AI Assist Hook
 *
 * Provides real-time AI assistance during calls by analyzing transcript
 * and customer context to provide intent detection, script suggestions,
 * compliance warnings, and knowledge base recommendations.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { debounce } from '@/lib/utils';
import type { Customer } from '@/types';

// =============================================================================
// TYPES
// =============================================================================

export interface DetectedIntent {
  label: string;
  confidence: number;
  reasoning?: string;
}

export interface Suggestion {
  id: string;
  type: 'script' | 'question' | 'action' | 'upsell';
  priority: 'high' | 'medium' | 'low';
  title: string;
  content: string;
  context?: string;
}

export interface ComplianceWarning {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  message: string;
  regulation?: string;
}

export interface KnowledgeItem {
  id: string;
  title: string;
  summary: string;
  url?: string;
  category?: string;
}

export interface AssistState {
  intent: DetectedIntent | null;
  suggestions: Suggestion[];
  compliance: ComplianceWarning[];
  knowledge: KnowledgeItem[];
  questionsToAsk: string[];
  detectedNeeds: string[];
}

export interface UseClaudeAssistOptions {
  callId: string;
  agentId: string;
  customer: Customer | null;
  customerNotes?: string[];
  onUpdate?: (update: Partial<AssistState>) => void;
  debounceMs?: number;
}

export interface UseClaudeAssistReturn {
  analyze: (transcript: string) => void;
  isLoading: boolean;
  error: Error | null;
  assistState: AssistState;
  clearError: () => void;
  triggerQuickPrompt: (prompt: 'handle_objection' | 'close_sale' | 'find_upsell') => void;
}

// =============================================================================
// INITIAL STATE
// =============================================================================

const initialAssistState: AssistState = {
  intent: null,
  suggestions: [],
  compliance: [],
  knowledge: [],
  questionsToAsk: [],
  detectedNeeds: [],
};

// =============================================================================
// HOOK
// =============================================================================

export function useClaudeAssist({
  callId,
  agentId,
  customer,
  customerNotes,
  onUpdate,
  debounceMs = 2000,
}: UseClaudeAssistOptions): UseClaudeAssistReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [assistState, setAssistState] = useState<AssistState>(initialAssistState);

  // Refs for cleanup and request management
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastTranscriptRef = useRef<string>('');
  const analysisCache = useRef<Map<string, AssistState>>(new Map());

  // Clear error
  const clearError = useCallback(() => setError(null), []);

  // Core analysis function
  const performAnalysis = useCallback(
    async (transcript: string) => {
      // Skip if transcript is too short
      if (transcript.length < 50) {
        return;
      }

      // Skip if same as last analysis
      if (transcript === lastTranscriptRef.current) {
        return;
      }

      // Check cache (use hash of transcript)
      const cacheKey = transcript.slice(-500); // Use last 500 chars as cache key
      const cached = analysisCache.current.get(cacheKey);
      if (cached) {
        setAssistState(cached);
        onUpdate?.(cached);
        return;
      }

      // Abort previous request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      const controller = new AbortController();
      abortControllerRef.current = controller;

      setIsLoading(true);
      setError(null);
      lastTranscriptRef.current = transcript;

      try {
        const response = await fetch('/api/assist/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            callId,
            agentId,
            transcript,
            customerId: customer?.id,
            customerContext: customer
              ? {
                  name: `${customer.firstName || ''} ${customer.lastName || ''}`.trim(),
                  isExisting: !!customer.hawksoftClientCode || !!customer.agencyzoomId,
                  // Add any relevant customer data for personalization
                }
              : null,
            customerNotes: customerNotes || [],
          }),
        });

        if (!response.ok) {
          throw new Error(`Analysis failed: ${response.status}`);
        }

        const data = await response.json();

        if (data.success && data.analysis) {
          const newState: AssistState = {
            intent: data.analysis.intent || null,
            suggestions: data.analysis.suggestions || [],
            compliance: data.analysis.compliance || [],
            knowledge: data.analysis.knowledge || [],
            questionsToAsk: data.analysis.questionsToAsk || [],
            detectedNeeds: data.analysis.detectedNeeds || [],
          };

          // Cache the result
          analysisCache.current.set(cacheKey, newState);

          // Keep cache size reasonable
          if (analysisCache.current.size > 20) {
            const firstKey = analysisCache.current.keys().next().value;
            if (firstKey) {
              analysisCache.current.delete(firstKey);
            }
          }

          setAssistState(newState);
          onUpdate?.(newState);
        }
      } catch (err) {
        // Ignore abort errors
        if (err instanceof Error && err.name === 'AbortError') {
          return;
        }
        console.error('[useClaudeAssist] Analysis error:', err);
        setError(err instanceof Error ? err : new Error('Analysis failed'));
      } finally {
        setIsLoading(false);
        if (abortControllerRef.current === controller) {
          abortControllerRef.current = null;
        }
      }
    },
    [callId, agentId, customer, customerNotes, onUpdate]
  );

  // Debounced analysis
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const debouncedAnalyze = useCallback(
    debounce((transcript: string) => {
      performAnalysis(transcript);
    }, debounceMs),
    [performAnalysis, debounceMs]
  );

  // Public analyze function
  const analyze = useCallback(
    (transcript: string) => {
      debouncedAnalyze(transcript);
    },
    [debouncedAnalyze]
  );

  // Quick prompt trigger for specific scenarios
  const triggerQuickPrompt = useCallback(
    async (prompt: 'handle_objection' | 'close_sale' | 'find_upsell') => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch('/api/assist/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            callId,
            agentId,
            transcript: lastTranscriptRef.current,
            quickPrompt: prompt,
            customerId: customer?.id,
            customerContext: customer
              ? {
                  name: `${customer.firstName || ''} ${customer.lastName || ''}`.trim(),
                  isExisting: !!customer.hawksoftClientCode || !!customer.agencyzoomId,
                }
              : null,
          }),
        });

        if (!response.ok) {
          throw new Error(`Quick prompt failed: ${response.status}`);
        }

        const data = await response.json();

        if (data.success && data.analysis) {
          // Merge quick prompt results with existing state
          setAssistState((prev) => ({
            ...prev,
            suggestions: [
              // Prepend new suggestions with high priority
              ...(data.analysis.suggestions || []),
              ...prev.suggestions.filter(
                (s) =>
                  !data.analysis.suggestions?.some(
                    (ns: Suggestion) => ns.id === s.id
                  )
              ),
            ],
          }));
        }
      } catch (err) {
        console.error('[useClaudeAssist] Quick prompt error:', err);
        setError(err instanceof Error ? err : new Error('Quick prompt failed'));
      } finally {
        setIsLoading(false);
      }
    },
    [callId, agentId, customer]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      debouncedAnalyze.cancel();
    };
  }, [debouncedAnalyze]);

  return {
    analyze,
    isLoading,
    error,
    assistState,
    clearError,
    triggerQuickPrompt,
  };
}

export default useClaudeAssist;
