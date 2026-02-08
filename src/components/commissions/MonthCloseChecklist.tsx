"use client";

import { CheckCircle, XCircle, AlertTriangle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ValidationCheckResult } from "@/types/commission.types";

interface MonthCloseChecklistProps {
  checks: ValidationCheckResult[];
  isRunning?: boolean;
  onLock?: () => void;
  canLock?: boolean;
  isLocked?: boolean;
  onUnlock?: () => void;
}

export function MonthCloseChecklist({
  checks,
  isRunning = false,
  onLock,
  canLock = false,
  isLocked = false,
  onUnlock,
}: MonthCloseChecklistProps) {
  const allPassed = checks.length > 0 && checks.every((c) => c.passed);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
        Month-Close Checklist
      </h3>

      {isRunning && (
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
          <Loader2 className="h-4 w-4 animate-spin" />
          Running validation checks...
        </div>
      )}

      <div className="space-y-3">
        {checks.map((check) => (
          <div
            key={check.check}
            className={cn(
              "flex items-start gap-3 p-3 rounded-lg",
              check.passed
                ? "bg-green-50 dark:bg-green-900/10"
                : "bg-red-50 dark:bg-red-900/10"
            )}
          >
            {check.passed ? (
              <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
            ) : (
              <XCircle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
            )}
            <div>
              <p className={cn(
                "text-sm font-medium",
                check.passed ? "text-green-800 dark:text-green-300" : "text-red-800 dark:text-red-300"
              )}>
                {check.label}
              </p>
              <p className={cn(
                "text-xs mt-0.5",
                check.passed ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
              )}>
                {check.message}
              </p>
            </div>
          </div>
        ))}
      </div>

      {checks.length > 0 && (
        <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
          {isLocked ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-amber-600">
                <AlertTriangle className="h-5 w-5" />
                <span className="text-sm font-medium">Month is locked</span>
              </div>
              {onUnlock && (
                <button
                  onClick={onUnlock}
                  className="px-4 py-2 text-sm font-medium text-red-600 border border-red-300 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20"
                >
                  Unlock Month
                </button>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">
                {allPassed
                  ? "All checks passed. Ready to lock."
                  : "Some checks failed. Fix issues before locking."}
              </p>
              {onLock && (
                <button
                  onClick={onLock}
                  disabled={!canLock || !allPassed}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-md text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Lock Month
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
