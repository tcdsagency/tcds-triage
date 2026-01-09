'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { evaluateEligibility } from '@/lib/eligibility/engine';
import {
  EligibilityResult,
  EligibilityAlert,
  AlertSeverity,
  QuoteType,
  EMPTY_ELIGIBILITY_RESULT,
} from '@/lib/eligibility/types';

// =============================================================================
// HOOK OPTIONS
// =============================================================================

interface UseEligibilityOptions {
  /** Debounce delay in ms (default: 500) */
  debounceMs?: number;
  /** Whether to auto-evaluate on mount */
  evaluateOnMount?: boolean;
  /** Callback when status changes */
  onStatusChange?: (status: EligibilityResult['status']) => void;
  /** Callback when new alert is triggered */
  onNewAlert?: (alert: EligibilityAlert) => void;
}

// =============================================================================
// HOOK RETURN TYPE
// =============================================================================

interface UseEligibilityReturn {
  /** Current eligibility result */
  result: EligibilityResult;
  /** Overall status */
  status: EligibilityResult['status'];
  /** All active alerts */
  alerts: EligibilityAlert[];
  /** Red alerts that block submission */
  blockers: EligibilityAlert[];
  /** Yellow warnings */
  warnings: EligibilityAlert[];
  /** Whether evaluation is in progress */
  isEvaluating: boolean;
  /** Whether there are unacknowledged blockers */
  hasUnacknowledgedBlockers: boolean;
  /** Whether there are unacknowledged warnings */
  hasUnacknowledgedWarnings: boolean;
  /** Total issue count */
  issueCount: number;
  /** Can the form be submitted? */
  canSubmit: boolean;
  /** Acknowledge a specific alert */
  acknowledgeAlert: (alertId: string) => void;
  /** Acknowledge all warnings */
  acknowledgeAllWarnings: () => void;
  /** Get alerts for a specific field */
  getFieldAlerts: (fieldName: string) => EligibilityAlert[];
  /** Check if a field has alerts */
  hasFieldAlert: (fieldName: string) => boolean;
  /** Get the severity of alerts for a field */
  getFieldSeverity: (fieldName: string) => AlertSeverity | null;
  /** Force re-evaluation */
  reevaluate: () => void;
  /** Clear all acknowledgments */
  clearAcknowledgments: () => void;
}

// =============================================================================
// HOOK IMPLEMENTATION
// =============================================================================

export function useEligibility(
  quoteType: QuoteType | string | null,
  formData: Record<string, unknown>,
  options: UseEligibilityOptions = {}
): UseEligibilityReturn {
  const {
    debounceMs = 500,
    evaluateOnMount = true,
    onStatusChange,
    onNewAlert,
  } = options;

  // State
  const [result, setResult] = useState<EligibilityResult>(EMPTY_ELIGIBILITY_RESULT);
  const [acknowledgedIds, setAcknowledgedIds] = useState<Set<string>>(new Set());
  const [isEvaluating, setIsEvaluating] = useState(false);

  // Refs to avoid re-renders - store latest values
  const formDataRef = useRef(formData);
  const quoteTypeRef = useRef(quoteType);
  const acknowledgedIdsRef = useRef(acknowledgedIds);
  const onStatusChangeRef = useRef(onStatusChange);
  const onNewAlertRef = useRef(onNewAlert);
  const previousAlertsRef = useRef<Map<string, EligibilityAlert>>(new Map());
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);

  // Keep refs updated (without triggering re-renders)
  useEffect(() => {
    formDataRef.current = formData;
  }, [formData]);

  useEffect(() => {
    quoteTypeRef.current = quoteType;
  }, [quoteType]);

  useEffect(() => {
    acknowledgedIdsRef.current = acknowledgedIds;
  }, [acknowledgedIds]);

  useEffect(() => {
    onStatusChangeRef.current = onStatusChange;
    onNewAlertRef.current = onNewAlert;
  }, [onStatusChange, onNewAlert]);

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // Core evaluation function - uses refs, doesn't depend on state
  const doEvaluation = useCallback(() => {
    const currentQuoteType = quoteTypeRef.current;
    const currentFormData = formDataRef.current;
    const currentAcknowledgedIds = acknowledgedIdsRef.current;

    if (!currentQuoteType || !mountedRef.current) {
      return;
    }

    try {
      const newResult = evaluateEligibility(currentQuoteType, currentFormData as Record<string, unknown>);

      // Apply acknowledgments
      const alertsWithAcknowledgments = newResult.alerts.map(alert => ({
        ...alert,
        acknowledged: currentAcknowledgedIds.has(alert.field) || alert.acknowledged,
      }));

      // Update result with acknowledgments
      const finalResult: EligibilityResult = {
        ...newResult,
        alerts: alertsWithAcknowledgments,
        blockers: alertsWithAcknowledgments.filter(a => a.severity === 'red'),
        warnings: alertsWithAcknowledgments.filter(a => a.severity === 'yellow'),
        hasUnacknowledgedBlockers: alertsWithAcknowledgments.some(a => a.severity === 'red' && !a.acknowledged),
        hasUnacknowledgedWarnings: alertsWithAcknowledgments.some(a => a.severity === 'yellow' && !a.acknowledged),
      };

      // Check for new alerts
      const previousAlertFields = new Set(previousAlertsRef.current.keys());

      for (const alert of newResult.alerts) {
        if (!previousAlertFields.has(alert.field)) {
          onNewAlertRef.current?.(alert);
        }
      }

      // Update previous alerts map
      previousAlertsRef.current = new Map(newResult.alerts.map(a => [a.field, a]));

      // Only update state if component is still mounted
      if (mountedRef.current) {
        setResult(prevResult => {
          if (prevResult.status !== finalResult.status) {
            onStatusChangeRef.current?.(finalResult.status);
          }
          return finalResult;
        });
        setIsEvaluating(false);
      }
    } catch (error) {
      console.error('[useEligibility] Evaluation error:', error);
      if (mountedRef.current) {
        setIsEvaluating(false);
      }
    }
  }, []); // No dependencies - uses refs

  // Debounced evaluation trigger
  useEffect(() => {
    // Clear any existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Don't evaluate if no quote type selected
    if (!quoteType) {
      setResult(EMPTY_ELIGIBILITY_RESULT);
      return;
    }

    // Set evaluating state immediately for UI feedback
    setIsEvaluating(true);

    // Schedule evaluation
    debounceTimerRef.current = setTimeout(() => {
      doEvaluation();
    }, debounceMs);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [quoteType, formData, debounceMs, doEvaluation]);

  // Initial evaluation on mount
  useEffect(() => {
    if (evaluateOnMount && quoteType) {
      // Small delay to let form settle
      const timer = setTimeout(() => {
        doEvaluation();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Acknowledge a specific alert
  const acknowledgeAlert = useCallback((alertId: string) => {
    setResult(currentResult => {
      const alert = currentResult.alerts.find(a => a.id === alertId);
      if (alert) {
        setAcknowledgedIds(prev => new Set([...prev, alert.field]));
      }
      return currentResult;
    });
  }, []);

  // Acknowledge all warnings
  const acknowledgeAllWarnings = useCallback(() => {
    setResult(currentResult => {
      const warningFields = currentResult.warnings.map(w => w.field);
      setAcknowledgedIds(prev => new Set([...prev, ...warningFields]));
      return currentResult;
    });
  }, []);

  // Get alerts for a specific field
  const getFieldAlerts = useCallback((fieldName: string): EligibilityAlert[] => {
    return result.alerts.filter(a => a.field === fieldName || a.field.startsWith(`${fieldName}[`));
  }, [result.alerts]);

  // Check if a field has alerts
  const hasFieldAlert = useCallback((fieldName: string): boolean => {
    return result.alerts.some(a => a.field === fieldName || a.field.startsWith(`${fieldName}[`));
  }, [result.alerts]);

  // Get the severity of alerts for a field
  const getFieldSeverity = useCallback((fieldName: string): AlertSeverity | null => {
    const fieldAlerts = getFieldAlerts(fieldName);
    if (fieldAlerts.length === 0) return null;
    return fieldAlerts.some(a => a.severity === 'red') ? 'red' : 'yellow';
  }, [getFieldAlerts]);

  // Force re-evaluation
  const reevaluate = useCallback(() => {
    doEvaluation();
  }, [doEvaluation]);

  // Clear all acknowledgments
  const clearAcknowledgments = useCallback(() => {
    setAcknowledgedIds(new Set());
  }, []);

  // Computed: can submit
  const canSubmit = useMemo(() => {
    if (result.blockers.length > 0) return false;
    return !result.hasUnacknowledgedWarnings;
  }, [result.blockers.length, result.hasUnacknowledgedWarnings]);

  return {
    result,
    status: result.status,
    alerts: result.alerts,
    blockers: result.blockers,
    warnings: result.warnings,
    isEvaluating,
    hasUnacknowledgedBlockers: result.hasUnacknowledgedBlockers,
    hasUnacknowledgedWarnings: result.hasUnacknowledgedWarnings,
    issueCount: result.issueCount,
    canSubmit,
    acknowledgeAlert,
    acknowledgeAllWarnings,
    getFieldAlerts,
    hasFieldAlert,
    getFieldSeverity,
    reevaluate,
    clearAcknowledgments,
  };
}

export default useEligibility;
