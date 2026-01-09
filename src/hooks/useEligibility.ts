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
  /** Debounce delay in ms (default: 300) */
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
  formData: Record<string, any>,
  options: UseEligibilityOptions = {}
): UseEligibilityReturn {
  const {
    debounceMs = 300,
    evaluateOnMount = true,
    onStatusChange,
    onNewAlert,
  } = options;

  // State
  const [result, setResult] = useState<EligibilityResult>(EMPTY_ELIGIBILITY_RESULT);
  const [acknowledgedIds, setAcknowledgedIds] = useState<Set<string>>(new Set());
  const [isEvaluating, setIsEvaluating] = useState(false);

  // Refs for callbacks
  const onStatusChangeRef = useRef(onStatusChange);
  const onNewAlertRef = useRef(onNewAlert);
  const previousAlertsRef = useRef<Map<string, EligibilityAlert>>(new Map());
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Keep refs updated
  useEffect(() => {
    onStatusChangeRef.current = onStatusChange;
    onNewAlertRef.current = onNewAlert;
  }, [onStatusChange, onNewAlert]);

  // Evaluation function
  const evaluate = useCallback(() => {
    if (!quoteType) {
      setResult(EMPTY_ELIGIBILITY_RESULT);
      return;
    }

    setIsEvaluating(true);

    try {
      const newResult = evaluateEligibility(quoteType, formData);

      // Apply acknowledgments
      const alertsWithAcknowledgments = newResult.alerts.map(alert => ({
        ...alert,
        acknowledged: acknowledgedIds.has(alert.field) || alert.acknowledged,
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
      const currentAlertFields = new Set(newResult.alerts.map(a => a.field));
      const previousAlertFields = new Set(previousAlertsRef.current.keys());

      for (const alert of newResult.alerts) {
        if (!previousAlertFields.has(alert.field)) {
          // This is a new alert
          onNewAlertRef.current?.(alert);
        }
      }

      // Check for status change
      setResult(prevResult => {
        if (prevResult.status !== finalResult.status) {
          onStatusChangeRef.current?.(finalResult.status);
        }
        return finalResult;
      });

      // Update previous alerts map
      previousAlertsRef.current = new Map(newResult.alerts.map(a => [a.field, a]));
    } catch (error) {
      console.error('[useEligibility] Evaluation error:', error);
    } finally {
      setIsEvaluating(false);
    }
  }, [quoteType, formData, acknowledgedIds]);

  // Debounced evaluation on form data change
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      evaluate();
    }, debounceMs);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [evaluate, debounceMs]);

  // Initial evaluation on mount
  useEffect(() => {
    if (evaluateOnMount && quoteType) {
      evaluate();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Acknowledge a specific alert
  const acknowledgeAlert = useCallback((alertId: string) => {
    // Find the alert to get its field
    const alert = result.alerts.find(a => a.id === alertId);
    if (alert) {
      setAcknowledgedIds(prev => new Set([...prev, alert.field]));
    }
  }, [result.alerts]);

  // Acknowledge all warnings
  const acknowledgeAllWarnings = useCallback(() => {
    const warningFields = result.warnings.map(w => w.field);
    setAcknowledgedIds(prev => new Set([...prev, ...warningFields]));
  }, [result.warnings]);

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
    // Return highest severity (red > yellow)
    return fieldAlerts.some(a => a.severity === 'red') ? 'red' : 'yellow';
  }, [getFieldAlerts]);

  // Force re-evaluation
  const reevaluate = useCallback(() => {
    evaluate();
  }, [evaluate]);

  // Clear all acknowledgments
  const clearAcknowledgments = useCallback(() => {
    setAcknowledgedIds(new Set());
  }, []);

  // Computed: can submit
  const canSubmit = useMemo(() => {
    // Cannot submit if there are any blockers (regardless of acknowledgment)
    if (result.blockers.length > 0) return false;
    // Can submit if all warnings are acknowledged
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
