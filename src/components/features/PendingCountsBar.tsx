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

type StatusFilter = 'all' | 'matched' | 'needs_review' | 'unmatched' | 'after_hours';
type TypeFilter = 'all' | 'wrapup' | 'message';

interface PendingCountsBarProps {
  counts: PendingCounts;
  activeTypeFilter: TypeFilter;
  activeStatusFilter: StatusFilter;
  onTypeFilter: (type: TypeFilter) => void;
  onStatusFilter: (status: StatusFilter) => void;
  isLoading?: boolean;
}

// =============================================================================
// STATUS DEFINITIONS WITH DESCRIPTIONS
// =============================================================================

const STATUS_CONFIG: Record<StatusFilter, {
  label: string;
  shortLabel: string;
  description: string;
  icon: string;
  bgColor: string;
  activeColor: string;
  dotColor: string;
}> = {
  all: {
    label: 'All Items',
    shortLabel: 'All',
    description: 'Show all pending items',
    icon: '📋',
    bgColor: 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300',
    activeColor: 'bg-gray-900 dark:bg-white text-white dark:text-gray-900',
    dotColor: 'bg-gray-400',
  },
  unmatched: {
    label: 'No Match',
    shortLabel: 'No Match',
    description: 'Customer not found in system - needs manual lookup',
    icon: '⚠️',
    bgColor: 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-700',
    activeColor: 'bg-amber-500 text-white',
    dotColor: 'bg-amber-500',
  },
  needs_review: {
    label: 'Needs Review',
    shortLabel: 'Review',
    description: 'Potential matches found - verify before posting',
    icon: '🔍',
    bgColor: 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-700',
    activeColor: 'bg-blue-500 text-white',
    dotColor: 'bg-blue-500',
  },
  matched: {
    label: 'Matched',
    shortLabel: 'Matched',
    description: 'Customer identified - ready to post note/ticket',
    icon: '✓',
    bgColor: 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-700',
    activeColor: 'bg-green-500 text-white',
    dotColor: 'bg-green-500',
  },
  after_hours: {
    label: 'After Hours',
    shortLabel: 'After Hrs',
    description: 'Received outside business hours',
    icon: '🌙',
    bgColor: 'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-700',
    activeColor: 'bg-purple-500 text-white',
    dotColor: 'bg-purple-500',
  },
};

// =============================================================================
// COMPONENT
// =============================================================================

export default function PendingCountsBar({
  counts,
  activeTypeFilter,
  activeStatusFilter,
  onTypeFilter,
  onStatusFilter,
  isLoading = false,
}: PendingCountsBarProps) {

  const getStatusCount = (status: StatusFilter): number => {
    switch (status) {
      case 'all': return counts.total;
      case 'matched': return counts.byStatus.matched;
      case 'needs_review': return counts.byStatus.needsReview;
      case 'unmatched': return counts.byStatus.unmatched;
      case 'after_hours': return counts.byStatus.afterHours;
      default: return 0;
    }
  };

  // Order: prioritize actionable items
  const statusOrder: StatusFilter[] = ['all', 'unmatched', 'needs_review', 'matched', 'after_hours'];

  if (isLoading) {
    return (
      <div className="p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
        <div className="flex flex-wrap gap-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="h-10 w-28 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 space-y-4">

      {/* Status Filter Tabs */}
      <div className="flex flex-wrap gap-2">
        {statusOrder.map((status) => {
          const config = STATUS_CONFIG[status];
          const count = getStatusCount(status);
          const isActive = activeStatusFilter === status;

          return (
            <button
              key={status}
              onClick={() => onStatusFilter(status)}
              title={config.description}
              className={cn(
                'group relative flex items-center gap-2 px-3 py-2 rounded-lg font-medium text-sm transition-all',
                isActive ? config.activeColor : config.bgColor,
                'hover:shadow-md'
              )}
            >
              <span>{config.icon}</span>
              <span className="hidden sm:inline">{config.label}</span>
              <span className="sm:hidden">{config.shortLabel}</span>
              <span className={cn(
                'px-1.5 py-0.5 rounded-full text-xs font-bold',
                isActive
                  ? 'bg-white/25'
                  : 'bg-black/10 dark:bg-white/10'
              )}>
                {count}
              </span>

              {/* Tooltip */}
              <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 hidden group-hover:block z-50">
                <div className="bg-gray-900 text-white text-xs rounded-lg px-3 py-2 whitespace-nowrap shadow-lg">
                  {config.description}
                  <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900" />
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Type Filter + Summary Row */}
      <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-gray-200 dark:border-gray-700">

        {/* Type Toggle */}
        <div className="flex items-center gap-1 p-1 bg-gray-100 dark:bg-gray-700 rounded-lg">
          <button
            onClick={() => onTypeFilter('all')}
            className={cn(
              'px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
              activeTypeFilter === 'all'
                ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            )}
          >
            All ({counts.total})
          </button>
          <button
            onClick={() => onTypeFilter('wrapup')}
            className={cn(
              'px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1',
              activeTypeFilter === 'wrapup'
                ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            )}
          >
            <span>📞</span> Calls ({counts.wrapups})
          </button>
          <button
            onClick={() => onTypeFilter('message')}
            className={cn(
              'px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1',
              activeTypeFilter === 'message'
                ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            )}
          >
            <span>💬</span> SMS ({counts.messages})
          </button>
        </div>

        {/* Quick Stats */}
        <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
          {counts.byStatus.unmatched > 0 && (
            <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-medium">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
              </span>
              {counts.byStatus.unmatched} need matching
            </span>
          )}
          {counts.byStatus.needsReview > 0 && (
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              {counts.byStatus.needsReview} to review
            </span>
          )}
        </div>
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
