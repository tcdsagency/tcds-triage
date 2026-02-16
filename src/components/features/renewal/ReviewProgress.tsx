'use client';

import { cn } from '@/lib/utils';
import { AlertTriangle } from 'lucide-react';
import type { CheckResult, CheckSummary } from '@/types/check-rules.types';

interface ReviewProgressProps {
  checkSummary: CheckSummary | null;
  checkResults: CheckResult[];
  materialChangesCount?: number;
  // Optional overrides for combined progress
  overrideReviewed?: number;
  overrideTotal?: number;
}

export default function ReviewProgress({
  checkSummary,
  checkResults,
  materialChangesCount = 0,
  overrideReviewed,
  overrideTotal,
}: ReviewProgressProps) {
  // Compute live progress from checkResults (more current than summary)
  const reviewable = checkResults.filter(r => r.severity !== 'unchanged');
  const reviewedCount = overrideReviewed ?? reviewable.filter(r => r.reviewed).length;
  const totalReviewable = overrideTotal ?? reviewable.length;
  const noCheckResults = totalReviewable === 0;
  const progress = totalReviewable > 0
    ? Math.round((reviewedCount / totalReviewable) * 100)
    : materialChangesCount > 0 ? 0 : 0;

  const blockerCount = checkSummary?.pipelineHalted
    ? (checkSummary.blockerRuleIds?.length ?? 0)
    : 0;

  const progressColor =
    noCheckResults
      ? (materialChangesCount > 0 ? 'text-amber-600' : 'text-gray-500')
      : progress >= 100
        ? 'text-green-600'
        : progress >= 50
          ? 'text-amber-600'
          : 'text-red-600';

  const barColor =
    noCheckResults
      ? (materialChangesCount > 0 ? 'bg-amber-500' : 'bg-gray-400')
      : progress >= 100
        ? 'bg-green-500'
        : progress >= 50
          ? 'bg-amber-500'
          : 'bg-red-500';

  // Border color based on progress
  const borderColor = progress >= 100 ? 'border-green-300' : progress > 0 ? 'border-amber-300' : 'border-gray-200';

  return (
    <div className={cn('rounded-lg border-2 bg-white p-4', borderColor)}>
      <h3 className="text-sm font-semibold uppercase text-gray-500 mb-3">
        Review Progress
      </h3>

      {/* Progress bar */}
      <div className="mb-2">
        <div className="h-2.5 w-full rounded-full bg-gray-200 overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all duration-300', barColor)}
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
        </div>
      </div>

      {/* Stats */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-600">
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
        <div className="mt-3 flex items-center gap-2 rounded-md bg-rose-50 border border-rose-200 px-3 py-2">
          <AlertTriangle className="h-4 w-4 text-rose-500 shrink-0" />
          <span className="text-sm font-medium text-rose-700">
            {blockerCount} blocking issue{blockerCount !== 1 ? 's' : ''} detected
          </span>
        </div>
      )}

      {/* Check engine warning */}
      {noCheckResults && materialChangesCount > 0 && (
        <div className="mt-3 flex items-center gap-2 rounded-md bg-amber-50 border border-amber-200 px-3 py-2">
          <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
          <span className="text-sm font-medium text-amber-700">
            Check engine did not run — {materialChangesCount} material change{materialChangesCount !== 1 ? 's' : ''} detected. Manual review required.
          </span>
        </div>
      )}

      {/* No changes at all */}
      {noCheckResults && materialChangesCount === 0 && (
        <p className="mt-2 text-sm text-gray-500">
          No changes detected
        </p>
      )}

      {/* Completion message */}
      {progress >= 100 && totalReviewable > 0 && (
        <p className="mt-2 text-sm text-green-600 font-medium">
          All items reviewed — ready for decision
        </p>
      )}
    </div>
  );
}
