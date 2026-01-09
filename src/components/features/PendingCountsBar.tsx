'use client';

import { cn } from '@/lib/utils';

// =============================================================================
// TYPES
// =============================================================================

export interface PendingCounts {
  wrapups: number;
  messages: number;
  leads: number;
  total: number;
  byStatus: {
    matched: number;
    needsReview: number;
    unmatched: number;
    afterHours: number;
  };
}

interface PendingCountsBarProps {
  counts: PendingCounts;
  activeTypeFilter: 'all' | 'wrapup' | 'message' | 'lead' | null;
  onTypeFilter: (type: 'all' | 'wrapup' | 'message' | 'lead') => void;
  isLoading?: boolean;
}

// =============================================================================
// COMPONENT
// =============================================================================

export default function PendingCountsBar({
  counts,
  activeTypeFilter,
  onTypeFilter,
  isLoading = false,
}: PendingCountsBarProps) {
  const typeButtons = [
    {
      key: 'all' as const,
      label: 'All',
      count: counts.total,
      icon: '📋',
      color: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
      activeColor: 'bg-gray-900 text-white dark:bg-white dark:text-gray-900',
    },
    {
      key: 'wrapup' as const,
      label: 'Calls',
      count: counts.wrapups,
      icon: '📞',
      color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
      activeColor: 'bg-blue-600 text-white',
    },
    {
      key: 'message' as const,
      label: 'Messages',
      count: counts.messages,
      icon: '💬',
      color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
      activeColor: 'bg-green-600 text-white',
    },
    {
      key: 'lead' as const,
      label: 'Leads',
      count: counts.leads,
      icon: '🎯',
      color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
      activeColor: 'bg-purple-600 text-white',
    },
  ];

  const statusIndicators = [
    {
      key: 'matched',
      label: 'Matched',
      count: counts.byStatus.matched,
      color: 'text-green-600 dark:text-green-400',
      bgColor: 'bg-green-500',
    },
    {
      key: 'needsReview',
      label: 'Review',
      count: counts.byStatus.needsReview,
      color: 'text-amber-600 dark:text-amber-400',
      bgColor: 'bg-amber-500',
    },
    {
      key: 'unmatched',
      label: 'No Match',
      count: counts.byStatus.unmatched,
      color: 'text-red-600 dark:text-red-400',
      bgColor: 'bg-red-500',
    },
    {
      key: 'afterHours',
      label: 'After Hours',
      count: counts.byStatus.afterHours,
      color: 'text-purple-600 dark:text-purple-400',
      bgColor: 'bg-purple-500',
    },
  ];

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="flex gap-2">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-10 w-24 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse"
            />
          ))}
        </div>
        <div className="flex gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
      {/* Type Filter Buttons */}
      <div className="flex flex-wrap gap-2">
        {typeButtons.map((btn) => (
          <button
            key={btn.key}
            onClick={() => onTypeFilter(btn.key)}
            className={cn(
              'flex items-center gap-2 px-3 py-2 rounded-lg font-medium text-sm transition-all',
              activeTypeFilter === btn.key || (activeTypeFilter === null && btn.key === 'all')
                ? btn.activeColor
                : btn.color + ' hover:opacity-80'
            )}
          >
            <span>{btn.icon}</span>
            <span>{btn.label}</span>
            <span className={cn(
              'px-1.5 py-0.5 rounded-full text-xs',
              activeTypeFilter === btn.key || (activeTypeFilter === null && btn.key === 'all')
                ? 'bg-white/20'
                : 'bg-black/10 dark:bg-white/10'
            )}>
              {btn.count}
            </span>
          </button>
        ))}
      </div>

      {/* Status Summary */}
      <div className="flex items-center gap-4 text-sm">
        {statusIndicators.map((status) => (
          <div key={status.key} className="flex items-center gap-1.5">
            <span className={cn('w-2 h-2 rounded-full', status.bgColor)} />
            <span className="text-gray-500 dark:text-gray-400">{status.label}:</span>
            <span className={cn('font-semibold', status.color)}>{status.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// =============================================================================
// COMPACT VERSION (for mobile/sidebar)
// =============================================================================

export function PendingCountsCompact({ counts }: { counts: PendingCounts }) {
  return (
    <div className="flex items-center gap-3 text-sm">
      {counts.total > 0 && (
        <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 font-medium">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
          </span>
          {counts.total} pending
        </span>
      )}
      {counts.byStatus.needsReview > 0 && (
        <span className="text-amber-600 dark:text-amber-400">
          {counts.byStatus.needsReview} need review
        </span>
      )}
    </div>
  );
}
