'use client';

import { useState } from 'react';
import { AlertTriangle, XCircle, CheckCircle, ChevronDown, ChevronUp, X, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { EligibilityAlert, EligibilityResult, AlertSeverity } from '@/lib/eligibility/types';

// =============================================================================
// ELIGIBILITY BANNER
// Shows overall eligibility status at top of form
// =============================================================================

interface EligibilityBannerProps {
  result: EligibilityResult;
  onAcknowledgeAll?: () => void;
  className?: string;
}

export function EligibilityBanner({ result, onAcknowledgeAll, className }: EligibilityBannerProps) {
  const [expanded, setExpanded] = useState(true);

  if (result.status === 'ELIGIBLE' && result.issueCount === 0) {
    return null; // Don't show banner when everything is fine
  }

  const isDecline = result.status === 'DECLINE';
  const isReview = result.status === 'REVIEW';

  return (
    <div
      className={cn(
        'rounded-lg border p-4 mb-6',
        isDecline && 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800',
        isReview && 'bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {isDecline ? (
            <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/50 flex items-center justify-center">
              <XCircle className="w-6 h-6 text-red-600 dark:text-red-400" />
            </div>
          ) : (
            <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-amber-600 dark:text-amber-400" />
            </div>
          )}
          <div>
            <h3 className={cn(
              'font-semibold',
              isDecline && 'text-red-800 dark:text-red-200',
              isReview && 'text-amber-800 dark:text-amber-200'
            )}>
              {isDecline ? 'Quote Cannot Proceed' : 'Underwriting Review Required'}
            </h3>
            <p className={cn(
              'text-sm',
              isDecline && 'text-red-600 dark:text-red-300',
              isReview && 'text-amber-600 dark:text-amber-300'
            )}>
              {result.blockers.length > 0 && `${result.blockers.length} blocking issue${result.blockers.length !== 1 ? 's' : ''}`}
              {result.blockers.length > 0 && result.warnings.length > 0 && ' and '}
              {result.warnings.length > 0 && `${result.warnings.length} warning${result.warnings.length !== 1 ? 's' : ''}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isReview && result.hasUnacknowledgedWarnings && onAcknowledgeAll && (
            <button
              onClick={onAcknowledgeAll}
              className="px-3 py-1.5 text-sm font-medium rounded-lg bg-amber-600 text-white hover:bg-amber-700 transition-colors"
            >
              Acknowledge All
            </button>
          )}
          <button
            onClick={() => setExpanded(!expanded)}
            className={cn(
              'p-1 rounded hover:bg-black/5 dark:hover:bg-white/5',
              isDecline && 'text-red-600 dark:text-red-400',
              isReview && 'text-amber-600 dark:text-amber-400'
            )}
          >
            {expanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Alert List */}
      {expanded && (
        <div className="mt-4 space-y-2">
          {/* Blockers first */}
          {result.blockers.map(alert => (
            <AlertItem key={alert.id} alert={alert} />
          ))}
          {/* Then warnings */}
          {result.warnings.map(alert => (
            <AlertItem key={alert.id} alert={alert} />
          ))}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// ALERT ITEM
// Individual alert display
// =============================================================================

interface AlertItemProps {
  alert: EligibilityAlert;
  onAcknowledge?: (alertId: string) => void;
  compact?: boolean;
}

export function AlertItem({ alert, onAcknowledge, compact = false }: AlertItemProps) {
  const isBlocker = alert.severity === 'red';

  return (
    <div
      className={cn(
        'rounded-lg border p-3',
        isBlocker ? 'bg-red-100/50 border-red-200 dark:bg-red-900/30 dark:border-red-800' : 'bg-amber-100/50 border-amber-200 dark:bg-amber-900/30 dark:border-amber-800',
        alert.acknowledged && 'opacity-60'
      )}
    >
      <div className="flex items-start gap-3">
        <div className={cn(
          'mt-0.5 flex-shrink-0',
          isBlocker ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'
        )}>
          {isBlocker ? <XCircle className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={cn(
              'text-xs font-medium uppercase tracking-wide',
              isBlocker ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'
            )}>
              {alert.fieldLabel || alert.field}
            </span>
            {alert.acknowledged && (
              <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                <CheckCircle className="w-3 h-3" /> Acknowledged
              </span>
            )}
          </div>
          <p className={cn(
            'mt-1',
            isBlocker ? 'text-red-800 dark:text-red-200' : 'text-amber-800 dark:text-amber-200',
            compact ? 'text-sm' : 'text-sm'
          )}>
            {alert.message}
          </p>
          {alert.agentScript && !compact && (
            <div className="mt-2 p-2 bg-white/50 dark:bg-black/20 rounded border border-current/10">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Suggested script:</p>
              <p className="text-sm italic text-gray-700 dark:text-gray-300">&quot;{alert.agentScript}&quot;</p>
            </div>
          )}
        </div>
        {!isBlocker && !alert.acknowledged && onAcknowledge && (
          <button
            onClick={() => onAcknowledge(alert.id)}
            className="flex-shrink-0 px-2 py-1 text-xs font-medium rounded bg-amber-600 text-white hover:bg-amber-700 transition-colors"
          >
            Acknowledge
          </button>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// FIELD ALERT INDICATOR
// Small indicator shown next to form fields
// =============================================================================

interface FieldAlertIndicatorProps {
  alerts: EligibilityAlert[];
  className?: string;
}

export function FieldAlertIndicator({ alerts, className }: FieldAlertIndicatorProps) {
  if (alerts.length === 0) return null;

  const hasBlocker = alerts.some(a => a.severity === 'red');
  const allAcknowledged = alerts.every(a => a.acknowledged);

  return (
    <div className={cn('relative group', className)}>
      <div className={cn(
        'w-5 h-5 rounded-full flex items-center justify-center cursor-help',
        hasBlocker ? 'bg-red-100 dark:bg-red-900/50' : 'bg-amber-100 dark:bg-amber-900/50',
        allAcknowledged && 'opacity-50'
      )}>
        {hasBlocker ? (
          <XCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
        ) : (
          <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
        )}
      </div>

      {/* Tooltip */}
      <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 z-50 hidden group-hover:block">
        <div className={cn(
          'px-3 py-2 rounded-lg shadow-lg text-sm max-w-xs whitespace-normal',
          hasBlocker ? 'bg-red-900 text-red-100' : 'bg-amber-900 text-amber-100'
        )}>
          {alerts.map(alert => (
            <div key={alert.id} className="mb-1 last:mb-0">
              {alert.message}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// BLOCKER MODAL
// Modal shown when trying to submit with blockers
// =============================================================================

interface BlockerModalProps {
  blockers: EligibilityAlert[];
  isOpen: boolean;
  onClose: () => void;
}

export function BlockerModal({ blockers, isOpen, onClose }: BlockerModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white dark:bg-gray-900 rounded-xl shadow-2xl max-w-lg w-full mx-4 overflow-hidden">
        {/* Header */}
        <div className="bg-red-600 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <XCircle className="w-6 h-6 text-white" />
            <h2 className="text-lg font-semibold text-white">Cannot Submit Quote</h2>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <p className="text-gray-600 dark:text-gray-300 mb-4">
            The following issues must be resolved before this quote can be submitted:
          </p>

          <div className="space-y-3">
            {blockers.map(alert => (
              <div
                key={alert.id}
                className="flex items-start gap-3 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800"
              >
                <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-red-800 dark:text-red-200">
                    {alert.fieldLabel || alert.field}
                  </p>
                  <p className="text-sm text-red-600 dark:text-red-300 mt-1">
                    {alert.message}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <p className="text-sm text-gray-500 dark:text-gray-400 mt-4">
            Please correct the highlighted fields and try again. If you believe this is an error,
            contact your supervisor.
          </p>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
          >
            Go Back to Form
          </button>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// UNDERWRITING ALERTS SECTION (for Agent Assist Sidebar)
// =============================================================================

interface UnderwritingAlertsSectionProps {
  alerts: EligibilityAlert[];
  onAcknowledge?: (alertId: string) => void;
  onAcknowledgeAll?: () => void;
  className?: string;
}

export function UnderwritingAlertsSection({
  alerts,
  onAcknowledge,
  onAcknowledgeAll,
  className,
}: UnderwritingAlertsSectionProps) {
  if (alerts.length === 0) return null;

  const blockers = alerts.filter(a => a.severity === 'red');
  const warnings = alerts.filter(a => a.severity === 'yellow');
  const hasUnacknowledgedWarnings = warnings.some(w => !w.acknowledged);

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400" />
          Underwriting Alerts
        </h3>
        {hasUnacknowledgedWarnings && onAcknowledgeAll && (
          <button
            onClick={onAcknowledgeAll}
            className="text-xs text-amber-400 hover:text-amber-300 transition-colors"
          >
            Acknowledge All
          </button>
        )}
      </div>

      {/* Blockers */}
      {blockers.length > 0 && (
        <div className="space-y-2">
          {blockers.map(alert => (
            <div
              key={alert.id}
              className="p-3 rounded-lg bg-red-900/40 border border-red-500/50"
            >
              <div className="flex items-start gap-2">
                <XCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-medium text-red-300 uppercase tracking-wide">
                    {alert.fieldLabel || alert.field}
                  </p>
                  <p className="text-sm text-red-100 mt-1">{alert.message}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="space-y-2">
          {warnings.map(alert => (
            <div
              key={alert.id}
              className={cn(
                'p-3 rounded-lg border',
                alert.acknowledged
                  ? 'bg-amber-900/20 border-amber-500/30 opacity-60'
                  : 'bg-amber-900/40 border-amber-500/50'
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-medium text-amber-300 uppercase tracking-wide flex items-center gap-2">
                      {alert.fieldLabel || alert.field}
                      {alert.acknowledged && (
                        <CheckCircle className="w-3 h-3 text-green-400" />
                      )}
                    </p>
                    <p className="text-sm text-amber-100 mt-1">{alert.message}</p>
                  </div>
                </div>
                {!alert.acknowledged && onAcknowledge && (
                  <button
                    onClick={() => onAcknowledge(alert.id)}
                    className="text-xs text-amber-400 hover:text-amber-300 whitespace-nowrap"
                  >
                    OK
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// ELIGIBILITY STATUS BADGE
// Small badge showing overall status
// =============================================================================

interface EligibilityStatusBadgeProps {
  status: EligibilityResult['status'];
  issueCount: number;
  className?: string;
}

export function EligibilityStatusBadge({ status, issueCount, className }: EligibilityStatusBadgeProps) {
  if (status === 'ELIGIBLE' && issueCount === 0) {
    return (
      <span className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium',
        'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
        className
      )}>
        <CheckCircle className="w-3.5 h-3.5" />
        Eligible
      </span>
    );
  }

  if (status === 'DECLINE') {
    return (
      <span className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium',
        'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
        className
      )}>
        <XCircle className="w-3.5 h-3.5" />
        Ineligible ({issueCount})
      </span>
    );
  }

  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium',
      'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
      className
    )}>
      <AlertTriangle className="w-3.5 h-3.5" />
      Review ({issueCount})
    </span>
  );
}
