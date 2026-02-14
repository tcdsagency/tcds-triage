'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { AlertTriangle } from 'lucide-react';
import CategoryBadge from './CategoryBadge';
import SeverityBadge from './SeverityBadge';
import type { CheckResult, CheckSummary } from '@/types/check-rules.types';

interface ReasonsForChangeProps {
  checkResults: CheckResult[];
  checkSummary: CheckSummary | null;
  onReviewToggle: (ruleId: string, field: string, reviewed: boolean) => Promise<void>;
}

export default function ReasonsForChange({
  checkResults,
  checkSummary,
  onReviewToggle,
}: ReasonsForChangeProps) {
  const [togglingRules, setTogglingRules] = useState<Set<string>>(new Set());

  // Filter to non-unchanged items
  const changedResults = checkResults.filter(r => r.severity !== 'unchanged');

  const handleReviewToggle = async (result: CheckResult) => {
    const key = `${result.ruleId}:${result.field}`;
    setTogglingRules(prev => new Set(prev).add(key));
    try {
      await onReviewToggle(result.ruleId, result.field, !result.reviewed);
    } finally {
      setTogglingRules(prev => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  };

  if (changedResults.length === 0) {
    return (
      <div className="rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 p-4">
        <p className="text-sm text-green-700 dark:text-green-400 font-medium">
          No significant changes detected in this renewal.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            Reasons for Premium Change
          </h3>
          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
            {changedResults.length} change{changedResults.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Blocker alert */}
      {checkSummary?.pipelineHalted && (
        <div className="flex items-start gap-2 rounded-lg bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 px-4 py-3">
          <AlertTriangle className="h-4 w-4 text-rose-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-rose-700 dark:text-rose-300">
              Pipeline halted — blocking issues detected
            </p>
            <p className="text-xs text-rose-600 dark:text-rose-400 mt-0.5">
              Rules: {checkSummary.blockerRuleIds.join(', ')}
            </p>
          </div>
        </div>
      )}

      {/* Results list */}
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700/50 overflow-hidden">
        {changedResults.map((result) => {
          const key = `${result.ruleId}:${result.field}`;
          const isToggling = togglingRules.has(key);

          return (
            <div
              key={key}
              className={cn(
                'px-4 py-3 flex items-start gap-3',
                result.reviewed && 'bg-green-50/50 dark:bg-green-900/10',
              )}
            >
              {/* Checkbox */}
              <label className="mt-0.5 shrink-0">
                <input
                  type="checkbox"
                  checked={result.reviewed}
                  disabled={isToggling}
                  onChange={() => handleReviewToggle(result)}
                  className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 cursor-pointer disabled:opacity-50"
                />
              </label>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm text-gray-800 dark:text-gray-200">
                    {result.message}
                  </span>
                </div>
                {result.agentAction && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 italic">
                    {result.agentAction}
                  </p>
                )}
              </div>

              {/* Badges */}
              <div className="flex items-center gap-2 shrink-0">
                <SeverityBadge severity={result.severity} compact />
                <CategoryBadge category={result.category} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
