'use client';

import { cn } from '@/lib/utils';
import { AlertTriangle } from 'lucide-react';
import type { CheckResult, CheckSummary } from '@/types/check-rules.types';

interface ReviewProgressProps {
  checkSummary: CheckSummary | null;
  checkResults: CheckResult[];
}

export default function ReviewProgress({ checkSummary, checkResults }: ReviewProgressProps) {
  // Compute live progress from checkResults (more current than summary)
  const reviewable = checkResults.filter(r => r.severity !== 'unchanged');
  const reviewedCount = reviewable.filter(r => r.reviewed).length;
  const totalReviewable = reviewable.length;
  const progress = totalReviewable > 0
    ? Math.round((reviewedCount / totalReviewable) * 100)
    : 100;

  const blockerCount = checkSummary?.pipelineHalted
    ? (checkSummary.blockerRuleIds?.length ?? 0)
    : 0;

  const progressColor =
    progress >= 100
      ? 'text-green-600 dark:text-green-400'
      : progress >= 50
        ? 'text-amber-600 dark:text-amber-400'
        : 'text-red-600 dark:text-red-400';

  const barColor =
    progress >= 100
      ? 'bg-green-500'
      : progress >= 50
        ? 'bg-amber-500'
        : 'bg-red-500';

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
      <h3 className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400 mb-3">
        Review Progress
      </h3>

      {/* Progress bar */}
      <div className="mb-2">
        <div className="h-2.5 w-full rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all duration-300', barColor)}
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
        </div>
      </div>

      {/* Stats */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-600 dark:text-gray-300">
          {reviewedCount} of {totalReviewable} items reviewed
        </span>
        <span className={cn('text-sm font-bold', progressColor)}>
          {progress}%
        </span>
      </div>

      {/* Blocker warning */}
      {blockerCount > 0 && (
        <div className="mt-3 flex items-center gap-2 rounded-md bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 px-3 py-2">
          <AlertTriangle className="h-4 w-4 text-rose-500 shrink-0" />
          <span className="text-xs font-medium text-rose-700 dark:text-rose-300">
            {blockerCount} blocking issue{blockerCount !== 1 ? 's' : ''} detected
          </span>
        </div>
      )}

      {/* Completion message */}
      {progress >= 100 && totalReviewable > 0 && (
        <p className="mt-2 text-xs text-green-600 dark:text-green-400 font-medium">
          All items reviewed — ready for decision
        </p>
      )}
    </div>
  );
}
