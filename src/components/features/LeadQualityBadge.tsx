'use client';

import { cn } from '@/lib/utils';
import type { LeadGrade } from '@/lib/api/trestleiq';

// =============================================================================
// TYPES
// =============================================================================

export interface LeadQualityData {
  grade: LeadGrade;
  activityScore: number;
  phoneValid?: boolean;
  phoneLineType?: string;
  isDisconnected?: boolean;
  isSpam?: boolean;
}

interface LeadQualityBadgeProps {
  data: LeadQualityData;
  size?: 'sm' | 'md' | 'lg';
  showScore?: boolean;
  showTooltip?: boolean;
  className?: string;
}

// =============================================================================
// STYLES
// =============================================================================

const GRADE_STYLES: Record<LeadGrade, {
  bg: string;
  text: string;
  border: string;
  label: string;
  description: string;
}> = {
  A: {
    bg: 'bg-green-100 dark:bg-green-900/40',
    text: 'text-green-700 dark:text-green-300',
    border: 'border-green-300 dark:border-green-700',
    label: 'Excellent',
    description: 'High-quality lead, likely to connect',
  },
  B: {
    bg: 'bg-blue-100 dark:bg-blue-900/40',
    text: 'text-blue-700 dark:text-blue-300',
    border: 'border-blue-300 dark:border-blue-700',
    label: 'Good',
    description: 'Good lead quality, worth contacting',
  },
  C: {
    bg: 'bg-yellow-100 dark:bg-yellow-900/40',
    text: 'text-yellow-700 dark:text-yellow-300',
    border: 'border-yellow-300 dark:border-yellow-700',
    label: 'Fair',
    description: 'Average quality, may need verification',
  },
  D: {
    bg: 'bg-orange-100 dark:bg-orange-900/40',
    text: 'text-orange-700 dark:text-orange-300',
    border: 'border-orange-300 dark:border-orange-700',
    label: 'Poor',
    description: 'Low quality, connection unlikely',
  },
  F: {
    bg: 'bg-red-100 dark:bg-red-900/40',
    text: 'text-red-700 dark:text-red-300',
    border: 'border-red-300 dark:border-red-700',
    label: 'Bad',
    description: 'Invalid or disconnected number',
  },
};

const SIZE_STYLES = {
  sm: {
    badge: 'text-xs px-1.5 py-0.5',
    score: 'text-[10px]',
    icon: 'w-3 h-3',
  },
  md: {
    badge: 'text-sm px-2 py-1',
    score: 'text-xs',
    icon: 'w-4 h-4',
  },
  lg: {
    badge: 'text-base px-3 py-1.5',
    score: 'text-sm',
    icon: 'w-5 h-5',
  },
};

// =============================================================================
// ACTIVITY SCORE BAR
// =============================================================================

function ActivityScoreBar({ score, size = 'md' }: { score: number; size?: 'sm' | 'md' | 'lg' }) {
  const getScoreColor = (s: number) => {
    if (s >= 70) return 'bg-green-500';
    if (s >= 50) return 'bg-blue-500';
    if (s >= 30) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const heights = { sm: 'h-1', md: 'h-1.5', lg: 'h-2' };
  const widths = { sm: 'w-12', md: 'w-16', lg: 'w-20' };

  return (
    <div className="flex items-center gap-1.5">
      <div className={cn('rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden', heights[size], widths[size])}>
        <div
          className={cn('h-full rounded-full transition-all', getScoreColor(score))}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className={cn('font-medium tabular-nums', SIZE_STYLES[size].score,
        score >= 70 ? 'text-green-600 dark:text-green-400' :
        score >= 50 ? 'text-blue-600 dark:text-blue-400' :
        score >= 30 ? 'text-yellow-600 dark:text-yellow-400' :
        'text-red-600 dark:text-red-400'
      )}>
        {score}
      </span>
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function LeadQualityBadge({
  data,
  size = 'md',
  showScore = true,
  showTooltip = true,
  className,
}: LeadQualityBadgeProps) {
  const style = GRADE_STYLES[data.grade];
  const sizeStyle = SIZE_STYLES[size];

  // Build tooltip content
  const tooltipLines = [
    style.description,
    `Activity Score: ${data.activityScore}/100`,
    data.phoneLineType && `Line Type: ${data.phoneLineType}`,
    data.isSpam && 'Warning: Flagged as potential spam',
    data.isDisconnected && 'Warning: May be disconnected',
  ].filter(Boolean);

  return (
    <div className={cn('inline-flex items-center gap-2', className)}>
      {/* Grade Badge */}
      <div className="relative group">
        <span
          className={cn(
            'inline-flex items-center font-semibold rounded border',
            style.bg, style.text, style.border,
            sizeStyle.badge
          )}
        >
          <span className="mr-1">Grade</span>
          <span className="font-bold">{data.grade}</span>
          {data.isSpam && <span className="ml-1">⚠️</span>}
          {data.isDisconnected && <span className="ml-1">📵</span>}
        </span>

        {/* Tooltip */}
        {showTooltip && (
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2
                          bg-gray-900 text-white text-xs rounded-lg opacity-0
                          group-hover:opacity-100 transition-opacity whitespace-nowrap
                          pointer-events-none z-50 max-w-xs">
            <div className="space-y-1">
              {tooltipLines.map((line, i) => (
                <div key={i}>{line}</div>
              ))}
            </div>
            <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1
                            border-4 border-transparent border-t-gray-900" />
          </div>
        )}
      </div>

      {/* Activity Score */}
      {showScore && (
        <ActivityScoreBar score={data.activityScore} size={size} />
      )}
    </div>
  );
}

// =============================================================================
// COMPACT VARIANT
// =============================================================================

export function LeadQualityBadgeCompact({ data, className }: { data: LeadQualityData; className?: string }) {
  const style = GRADE_STYLES[data.grade];

  return (
    <span
      className={cn(
        'inline-flex items-center text-xs font-semibold px-1.5 py-0.5 rounded border',
        style.bg, style.text, style.border,
        className
      )}
      title={`${style.label} lead (Score: ${data.activityScore}/100)`}
    >
      {data.grade}
      {data.isSpam && '⚠️'}
    </span>
  );
}

// =============================================================================
// INLINE VARIANT (for list views)
// =============================================================================

export function LeadQualityInline({ data }: { data: LeadQualityData }) {
  const getIcon = (grade: LeadGrade) => {
    switch (grade) {
      case 'A': return '🟢';
      case 'B': return '🔵';
      case 'C': return '🟡';
      case 'D': return '🟠';
      case 'F': return '🔴';
    }
  };

  return (
    <span className="inline-flex items-center gap-1 text-xs">
      <span>{getIcon(data.grade)}</span>
      <span className="font-medium">{data.activityScore}</span>
    </span>
  );
}
