'use client';

import { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react';
import SeverityBadge from './SeverityBadge';
import type { CheckResult, CheckSummary } from '@/types/check-rules.types';

interface CheckResultsPanelProps {
  checkResults: CheckResult[];
  checkSummary: CheckSummary | null;
  renewalId: string;
  onReviewToggle: (ruleId: string, field: string, reviewed: boolean) => Promise<void>;
}

// Ordered category list for grouping
const CATEGORY_ORDER = [
  'Identity',
  'Coverages',
  'Deductibles',
  'Premium',
  'Property',
  'Vehicles',
  'Drivers',
  'Endorsements',
];

function groupByCategory(results: CheckResult[]): Map<string, CheckResult[]> {
  const groups = new Map<string, CheckResult[]>();

  // Seed ordered categories
  for (const cat of CATEGORY_ORDER) {
    groups.set(cat, []);
  }

  for (const r of results) {
    const cat = r.category || 'Other';
    if (!groups.has(cat)) groups.set(cat, []);
    groups.get(cat)!.push(r);
  }

  // Remove empty ordered categories
  for (const cat of CATEGORY_ORDER) {
    if (groups.get(cat)?.length === 0) groups.delete(cat);
  }

  return groups;
}

export default function CheckResultsPanel({
  checkResults,
  checkSummary,
  renewalId,
  onReviewToggle,
}: CheckResultsPanelProps) {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(CATEGORY_ORDER));
  const [showUnchanged, setShowUnchanged] = useState(false);
  const [togglingRules, setTogglingRules] = useState<Set<string>>(new Set());

  const grouped = useMemo(() => groupByCategory(checkResults), [checkResults]);

  const criticalCount = checkSummary?.criticalCount ?? checkResults.filter(r => r.severity === 'critical').length;
  const warningCount = checkSummary?.warningCount ?? checkResults.filter(r => r.severity === 'warning').length;
  const infoCount = checkSummary?.infoCount ?? checkResults.filter(r => r.severity === 'info').length;
  const unchangedCount = checkResults.filter(r => r.severity === 'unchanged').length;

  const toggleCategory = (cat: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

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

  if (checkResults.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      {/* Summary bar */}
      <div className="flex items-center gap-4 text-xs text-gray-600 dark:text-gray-400">
        <span className="font-medium">{checkResults.length} checks</span>
        {criticalCount > 0 && (
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-rose-500" />
            {criticalCount} critical
          </span>
        )}
        {warningCount > 0 && (
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-amber-500" />
            {warningCount} warning
          </span>
        )}
        {infoCount > 0 && (
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-blue-500" />
            {infoCount} info
          </span>
        )}
        {unchangedCount > 0 && (
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-gray-400" />
            {unchangedCount} unchanged
          </span>
        )}
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

      {/* Grouped sections */}
      {Array.from(grouped.entries()).map(([category, results]) => {
        const isExpanded = expandedCategories.has(category);
        const changedResults = results.filter(r => r.severity !== 'unchanged');
        const unchangedResults = results.filter(r => r.severity === 'unchanged');
        const displayResults = showUnchanged ? results : changedResults;

        if (displayResults.length === 0 && unchangedResults.length === 0) return null;

        return (
          <div
            key={category}
            className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden"
          >
            {/* Category header */}
            <button
              onClick={() => toggleCategory(category)}
              className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors"
            >
              <div className="flex items-center gap-2">
                {isExpanded ? (
                  <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 text-gray-400" />
                )}
                <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">
                  {category}
                </span>
                <span className="text-[10px] text-gray-400">
                  {changedResults.length} change{changedResults.length !== 1 ? 's' : ''}
                </span>
              </div>
              {/* Quick severity summary */}
              <div className="flex items-center gap-1">
                {results.some(r => r.severity === 'critical') && (
                  <span className="h-2 w-2 rounded-full bg-rose-500" />
                )}
                {results.some(r => r.severity === 'warning') && (
                  <span className="h-2 w-2 rounded-full bg-amber-500" />
                )}
              </div>
            </button>

            {/* Results rows */}
            {isExpanded && (
              <div className="divide-y divide-gray-100 dark:divide-gray-700/50">
                {displayResults.map((result) => {
                  const key = `${result.ruleId}:${result.field}`;
                  const isToggling = togglingRules.has(key);

                  return (
                    <div
                      key={key}
                      className={cn(
                        'px-3 py-2 flex items-start gap-3 text-xs',
                        result.reviewed && 'bg-green-50/50 dark:bg-green-900/10',
                      )}
                    >
                      {/* Review checkbox */}
                      {result.severity !== 'unchanged' && (
                        <label className="mt-0.5 shrink-0">
                          <input
                            type="checkbox"
                            checked={result.reviewed}
                            disabled={isToggling}
                            onChange={() => handleReviewToggle(result)}
                            className="h-3.5 w-3.5 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 cursor-pointer disabled:opacity-50"
                          />
                        </label>
                      )}
                      {result.severity === 'unchanged' && <span className="w-3.5 shrink-0" />}

                      {/* Severity badge */}
                      <span className="shrink-0 mt-0.5">
                        <SeverityBadge severity={result.severity} compact />
                      </span>

                      {/* Content */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-2 flex-wrap">
                          <span className="font-medium text-gray-800 dark:text-gray-200">
                            {result.field}
                          </span>
                          <span className="text-gray-500 dark:text-gray-400">
                            {result.change}
                          </span>
                        </div>
                        {result.agentAction && result.severity !== 'unchanged' && (
                          <p className="text-gray-500 dark:text-gray-400 mt-0.5 italic">
                            {result.agentAction}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Collapsed unchanged */}
                {!showUnchanged && unchangedResults.length > 0 && (
                  <button
                    onClick={() => setShowUnchanged(true)}
                    className="w-full px-3 py-1.5 text-[10px] text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors text-left"
                  >
                    {unchangedResults.length} unchanged item{unchangedResults.length !== 1 ? 's' : ''}...
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
