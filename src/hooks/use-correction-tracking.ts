/**
 * useCorrectionTracking Hook
 * ==========================
 * Tracks agent corrections to AI-extracted data for feedback loop learning.
 *
 * Usage:
 * 1. Initialize with wrapup ID and AI extraction data
 * 2. Call trackField() when agent edits a field
 * 3. Call submitCorrections() before completing the wrapup
 */

'use client';

import { useState, useCallback, useRef, useMemo } from 'react';
import { toast } from 'sonner';

// Tracked field names (must match schema)
export type TrackedFieldName =
  | 'customerName'
  | 'summary'
  | 'editedSummary'
  | 'requestType'
  | 'serviceRequestType'
  | 'policyNumbers'
  | 'actionItems'
  | 'priority'
  | 'customerEmail'
  | 'customerPhone';

// Correction type classification
export type CorrectionType =
  | 'wrong_value'    // AI extracted wrong data
  | 'missing_value'  // AI missed extracting data
  | 'extra_value'    // AI extracted data that wasn't there
  | 'format_issue'   // Right data, wrong format
  | 'context_error'; // Misunderstood context

// AI Extraction data structure (from wrapup)
export interface AiExtraction {
  actionItems?: string[];
  extractedData?: {
    customerName?: string;
    policyNumber?: string;
    phone?: string;
    email?: string;
    address?: string;
    vin?: string;
    effectiveDate?: string;
    amount?: string;
  };
  sentiment?: string;
  serviceRequestType?: string;
  agencyZoomCustomerId?: string;
  agencyZoomLeadId?: string;
  matchType?: string;
}

// Pending correction record
interface PendingCorrection {
  fieldName: TrackedFieldName;
  aiValue: string | null;
  agentValue: string | null;
  correctionType: CorrectionType;
}

// Hook options
interface UseCorrectionTrackingOptions {
  wrapupId: string;
  callId?: string;
  // Initial AI values to track
  aiExtraction?: AiExtraction | null;
  aiCleanedSummary?: string | null;
  customerName?: string | null;
  requestType?: string | null;
  priority?: string | null;
  // Optional transcript for context
  transcript?: string | null;
  // Disable tracking (e.g., for auto-voided wrapups)
  disabled?: boolean;
}

// Hook return type
interface UseCorrectionTrackingReturn {
  // Track a field change
  trackField: (fieldName: TrackedFieldName, newValue: string | null) => void;
  // Submit all pending corrections
  submitCorrections: () => Promise<boolean>;
  // Check if there are pending corrections
  hasCorrections: boolean;
  // Number of pending corrections
  correctionCount: number;
  // Get original AI value for a field
  getOriginalValue: (fieldName: TrackedFieldName) => string | null;
  // Clear all tracked corrections
  clearCorrections: () => void;
  // Submission state
  isSubmitting: boolean;
}

/**
 * Classify the type of correction based on AI vs agent values
 */
function classifyCorrectionType(
  aiValue: string | null | undefined,
  agentValue: string | null | undefined
): CorrectionType {
  const hasAi = aiValue && aiValue.trim().length > 0;
  const hasAgent = agentValue && agentValue.trim().length > 0;

  if (!hasAi && hasAgent) {
    return 'missing_value'; // AI missed it, agent added it
  }
  if (hasAi && !hasAgent) {
    return 'extra_value'; // AI extracted something that shouldn't be there
  }
  if (hasAi && hasAgent) {
    // Both have values but they're different
    const aiLower = (aiValue || '').toLowerCase().trim();
    const agentLower = (agentValue || '').toLowerCase().trim();

    // Check if it's just a format issue (same content, different format)
    const aiNormalized = aiLower.replace(/[^a-z0-9]/g, '');
    const agentNormalized = agentLower.replace(/[^a-z0-9]/g, '');

    if (aiNormalized === agentNormalized) {
      return 'format_issue';
    }

    return 'wrong_value';
  }

  // Both empty - shouldn't happen but default to wrong_value
  return 'wrong_value';
}

/**
 * Convert a value to string for comparison
 */
function valueToString(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (Array.isArray(value)) {
    return value.join(', ');
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
}

export function useCorrectionTracking({
  wrapupId,
  callId,
  aiExtraction,
  aiCleanedSummary,
  customerName,
  requestType,
  priority,
  transcript,
  disabled = false,
}: UseCorrectionTrackingOptions): UseCorrectionTrackingReturn {
  // Track original AI values (captured on first render)
  const originalValues = useRef<Map<TrackedFieldName, string | null>>(new Map());
  const isInitialized = useRef(false);

  // Pending corrections
  const [corrections, setCorrections] = useState<Map<TrackedFieldName, PendingCorrection>>(
    new Map()
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize original values on first render
  useMemo(() => {
    if (isInitialized.current || disabled) return;

    // Capture original AI values
    originalValues.current.set('customerName', customerName || aiExtraction?.extractedData?.customerName || null);
    originalValues.current.set('summary', aiCleanedSummary || null);
    originalValues.current.set('editedSummary', null); // Agent-edited summary starts empty
    originalValues.current.set('requestType', requestType || null);
    originalValues.current.set('serviceRequestType', aiExtraction?.serviceRequestType || null);
    originalValues.current.set('policyNumbers', aiExtraction?.extractedData?.policyNumber || null);
    originalValues.current.set('actionItems', valueToString(aiExtraction?.actionItems) || null);
    originalValues.current.set('priority', priority || null);
    originalValues.current.set('customerEmail', aiExtraction?.extractedData?.email || null);
    originalValues.current.set('customerPhone', aiExtraction?.extractedData?.phone || null);

    isInitialized.current = true;
  }, [aiExtraction, aiCleanedSummary, customerName, requestType, priority, disabled]);

  // Get original value for a field
  const getOriginalValue = useCallback((fieldName: TrackedFieldName): string | null => {
    return originalValues.current.get(fieldName) || null;
  }, []);

  // Track a field change
  const trackField = useCallback((fieldName: TrackedFieldName, newValue: string | null) => {
    if (disabled) return;

    const originalValue = originalValues.current.get(fieldName);

    // Normalize values for comparison
    const normalizedOriginal = (originalValue || '').trim();
    const normalizedNew = (newValue || '').trim();

    // If values are the same, remove any existing correction for this field
    if (normalizedOriginal === normalizedNew) {
      setCorrections(prev => {
        const next = new Map(prev);
        next.delete(fieldName);
        return next;
      });
      return;
    }

    // Values are different - track the correction
    const correctionType = classifyCorrectionType(originalValue, newValue);

    setCorrections(prev => {
      const next = new Map(prev);
      next.set(fieldName, {
        fieldName,
        aiValue: originalValue ?? null,
        agentValue: newValue,
        correctionType,
      });
      return next;
    });
  }, [disabled]);

  // Submit all pending corrections
  const submitCorrections = useCallback(async (): Promise<boolean> => {
    if (disabled || corrections.size === 0) {
      return true; // Nothing to submit
    }

    setIsSubmitting(true);

    try {
      const correctionsList = Array.from(corrections.values());

      const response = await fetch('/api/ai-corrections', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          wrapupDraftId: wrapupId,
          callId,
          corrections: correctionsList,
          transcriptExcerpt: transcript?.substring(0, 500), // First 500 chars for context
          fullTranscript: transcript,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        console.error('[CorrectionTracking] Failed to submit corrections:', error);
        toast.error('Failed to save feedback');
        return false;
      }

      // Clear corrections after successful submission
      setCorrections(new Map());

      console.log(`[CorrectionTracking] Submitted ${correctionsList.length} corrections for wrapup ${wrapupId}`);
      return true;
    } catch (error) {
      console.error('[CorrectionTracking] Error submitting corrections:', error);
      toast.error('Failed to save feedback');
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, [disabled, corrections, wrapupId, callId, transcript]);

  // Clear all tracked corrections
  const clearCorrections = useCallback(() => {
    setCorrections(new Map());
  }, []);

  return {
    trackField,
    submitCorrections,
    hasCorrections: corrections.size > 0,
    correctionCount: corrections.size,
    getOriginalValue,
    clearCorrections,
    isSubmitting,
  };
}

export default useCorrectionTracking;
