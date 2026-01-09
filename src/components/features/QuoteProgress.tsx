'use client';

import { cn } from '@/lib/utils';
import { CheckCircle, Circle, AlertTriangle, XCircle } from 'lucide-react';
import { EligibilityStatus } from '@/lib/eligibility/types';

// =============================================================================
// QUOTE PROGRESS COMPONENT
// Shows form completion progress with section dots and eligibility status
// =============================================================================

interface QuoteProgressSection {
  id: string;
  label: string;
  isComplete: boolean;
  isCurrent: boolean;
}

interface QuoteProgressProps {
  /** Overall completion percentage (0-100) */
  completion: number;
  /** List of form sections with their status */
  sections: QuoteProgressSection[];
  /** Current eligibility status */
  eligibilityStatus?: EligibilityStatus;
  /** Number of eligibility issues */
  issueCount?: number;
  /** Callback when a section dot is clicked */
  onSectionClick?: (sectionId: string) => void;
  /** Whether to show in compact mode */
  compact?: boolean;
  className?: string;
}

export function QuoteProgress({
  completion,
  sections,
  eligibilityStatus = 'ELIGIBLE',
  issueCount = 0,
  onSectionClick,
  compact = false,
  className,
}: QuoteProgressProps) {
  // Determine bar color based on eligibility status
  const getBarColor = () => {
    if (eligibilityStatus === 'DECLINE') return 'from-red-500 to-red-600';
    if (eligibilityStatus === 'REVIEW') return 'from-amber-500 to-amber-600';
    return 'from-emerald-500 to-emerald-600';
  };

  // Get status badge
  const getStatusBadge = () => {
    if (eligibilityStatus === 'DECLINE') {
      return (
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-red-900/50 border border-red-500/50">
          <XCircle className="w-3.5 h-3.5 text-red-400" />
          <span className="text-xs font-medium text-red-300">Blocked</span>
        </div>
      );
    }
    if (eligibilityStatus === 'REVIEW') {
      return (
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-amber-900/50 border border-amber-500/50">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-xs font-medium text-amber-300">{issueCount} Warning{issueCount !== 1 ? 's' : ''}</span>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-emerald-900/50 border border-emerald-500/50">
        <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
        <span className="text-xs font-medium text-emerald-300">Eligible</span>
      </div>
    );
  };

  if (compact) {
    return (
      <div className={cn('flex items-center gap-3', className)}>
        {/* Progress bar */}
        <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
          <div
            className={cn('h-full bg-gradient-to-r transition-all duration-300', getBarColor())}
            style={{ width: `${completion}%` }}
          />
        </div>
        {/* Percentage */}
        <span className="text-sm font-medium text-gray-300 w-12 text-right">{completion}%</span>
        {/* Status badge */}
        {getStatusBadge()}
      </div>
    );
  }

  return (
    <div className={cn('space-y-3', className)}>
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-gray-300">Progress</span>
          <span className="text-sm text-gray-400">{completion}%</span>
        </div>
        {getStatusBadge()}
      </div>

      {/* Main progress bar */}
      <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
        <div
          className={cn('h-full bg-gradient-to-r transition-all duration-300', getBarColor())}
          style={{ width: `${completion}%` }}
        />
      </div>

      {/* Section dots */}
      {sections.length > 0 && (
        <div className="flex items-center justify-between px-1">
          {sections.map((section, index) => (
            <button
              key={section.id}
              onClick={() => onSectionClick?.(section.id)}
              className="group relative flex flex-col items-center"
              title={section.label}
            >
              {/* Dot */}
              <div
                className={cn(
                  'w-3 h-3 rounded-full transition-all border-2',
                  section.isComplete && 'bg-emerald-500 border-emerald-400',
                  section.isCurrent && !section.isComplete && 'bg-blue-500 border-blue-400 ring-2 ring-blue-400/30',
                  !section.isComplete && !section.isCurrent && 'bg-gray-700 border-gray-600',
                  'group-hover:scale-125'
                )}
              />
              {/* Connecting line */}
              {index < sections.length - 1 && (
                <div
                  className={cn(
                    'absolute top-1.5 left-3 h-0.5 w-[calc(100%-12px)]',
                    section.isComplete ? 'bg-emerald-500/50' : 'bg-gray-700'
                  )}
                  style={{ transform: 'translateX(3px)' }}
                />
              )}
              {/* Tooltip */}
              <div className="absolute -bottom-6 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                <span className="text-[10px] text-gray-400">{section.label}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// SIMPLE PROGRESS BAR (for header area)
// =============================================================================

interface SimpleProgressBarProps {
  completion: number;
  eligibilityStatus?: EligibilityStatus;
  className?: string;
}

export function SimpleProgressBar({
  completion,
  eligibilityStatus = 'ELIGIBLE',
  className,
}: SimpleProgressBarProps) {
  const getBarColor = () => {
    if (eligibilityStatus === 'DECLINE') return 'from-red-500 to-red-600';
    if (eligibilityStatus === 'REVIEW') return 'from-amber-500 to-amber-600';
    return 'from-emerald-500 to-emerald-600';
  };

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className="w-32 h-2 bg-gray-700 rounded-full overflow-hidden">
        <div
          className={cn('h-full bg-gradient-to-r transition-all duration-300', getBarColor())}
          style={{ width: `${completion}%` }}
        />
      </div>
      <span className="text-sm font-medium text-gray-300">{completion}%</span>
    </div>
  );
}

export default QuoteProgress;
