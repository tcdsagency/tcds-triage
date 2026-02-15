'use client';

import { cn } from '@/lib/utils';
import { AlertTriangle } from 'lucide-react';
import type { CheckResult, CheckSummary } from '@/types/check-rules.types';

interface ReviewProgressProps {
  checkSummary: CheckSummary | null;
  checkResults: CheckResult[];
  materialChangesCount?: number;
}

export default function ReviewProgress({ checkSummary, checkResults, materialChangesCount = 0 }: ReviewProgressProps) {
  // Compute live progress from checkResults (more current than summary)
  const reviewable = checkResults.filter(r => r.severity !== 'unchanged');
  const reviewedCount = reviewable.filter(r => r.reviewed).length;
  const totalReviewable = reviewable.length;
  const noCheckResults = totalReviewable === 0;
  const progress = totalReviewable > 0
    ? Math.round((reviewedCount / totalReviewable) * 100)
    : materialChangesCount > 0 ? 0 : 0; // Don't show 100% when there's nothing to review

  const blockerCount = checkSummary?.pipelineHalted
    ? (checkSummary.blockerRuleIds?.length ?? 0)
    : 0;

  const progressColor =
    noCheckResults
      ? (materialChangesCount > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-gray-500 dark:text-gray-400')
      : progress >= 100
        ? 'text-green-600 dark:text-green-400'
        : progress >= 50
          ? 'text-amber-600 dark:text-amber-400'
          : 'text-red-600 dark:text-red-400';

  const barColor =
    noCheckResults
      ? (materialChangesCount > 0 ? 'bg-amber-500' : 'bg-gray-400')
      : progress >= 100
        ? 'bg-green-500'
        : progress >= 50
          ? 'bg-amber-500'
          : 'bg-red-500';

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
      <h3 className="text-sm font-semibold uppercase text-gray-500 dark:text-gray-400 mb-3">
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
          {noCheckResults
            ? (materialChangesCount > 0 ? `${materialChangesCount} material change${materialChangesCount !== 1 ? 's' : ''} detected` : 'No changes detected')
            : `${reviewedCount} of ${totalReviewable} items reviewed`}
        </span>
        <span className={cn('text-sm font-bold', progressColor)}>
          {noCheckResults ? (materialChangesCount > 0 ? '0%' : '-') : `${progress}%`}
        </span>
      </div>

      {/* Blocker warning */}
      {blockerCount > 0 && (
        <div className="mt-3 flex items-center gap-2 rounded-md bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 px-3 py-2">
          <AlertTriangle className="h-4 w-4 text-rose-500 shrink-0" />
          <span className="text-sm font-medium text-rose-700 dark:text-rose-300">
            {blockerCount} blocking issue{blockerCount !== 1 ? 's' : ''} detected
          </span>
        </div>
      )}

      {/* Check engine warning */}
      {noCheckResults && materialChangesCount > 0 && (
        <div className="mt-3 flex items-center gap-2 rounded-md bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-3 py-2">
          <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
          <span className="text-sm font-medium text-amber-700 dark:text-amber-300">
            Check engine did not run — {materialChangesCount} material change{materialChangesCount !== 1 ? 's' : ''} detected. Manual review required.
          </span>
        </div>
      )}

      {/* No changes at all */}
      {noCheckResults && materialChangesCount === 0 && (
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          No changes detected
        </p>
      )}

      {/* Completion message */}
      {progress >= 100 && totalReviewable > 0 && (
        <p className="mt-2 text-sm text-green-600 dark:text-green-400 font-medium">
          All items reviewed — ready for decision
        </p>
      )}
    </div>
  );
}
