'use client';

/**
 * Wizard Progress Component
 * =========================
 * Step-by-step progress indicator with clickable dots.
 */

import { cn } from '@/lib/utils';
import { Check, AlertTriangle, XCircle } from 'lucide-react';
import { StepConfig } from './config/types';
import { EligibilityStatus } from '@/lib/eligibility/types';
import { useQuoteWizard } from './QuoteWizardProvider';

interface WizardProgressProps {
  steps: StepConfig[];
  currentStep: number;
  progress: number;
  eligibilityStatus?: EligibilityStatus;
}

export function WizardProgress({
  steps,
  currentStep,
  progress,
  eligibilityStatus = 'ELIGIBLE',
}: WizardProgressProps) {
  const { goToStep, isStepComplete } = useQuoteWizard();

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
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-100 dark:bg-red-900/50 border border-red-200 dark:border-red-500/50">
          <XCircle className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
          <span className="text-xs font-medium text-red-700 dark:text-red-300">Blocked</span>
        </div>
      );
    }
    if (eligibilityStatus === 'REVIEW') {
      return (
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-100 dark:bg-amber-900/50 border border-amber-200 dark:border-amber-500/50">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
          <span className="text-xs font-medium text-amber-700 dark:text-amber-300">Warnings</span>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/50 border border-emerald-200 dark:border-emerald-500/50">
        <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
        <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300">Eligible</span>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Header with progress and status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Progress
          </span>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {progress}%
          </span>
        </div>
        {getStatusBadge()}
      </div>

      {/* Progress bar */}
      <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className={cn(
            'h-full bg-gradient-to-r transition-all duration-500 ease-out',
            getBarColor()
          )}
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Step indicators */}
      <div className="relative flex items-center justify-between">
        {/* Connecting line */}
        <div className="absolute top-3 left-0 right-0 h-0.5 bg-gray-200 dark:bg-gray-700" />
        <div
          className={cn(
            'absolute top-3 left-0 h-0.5 bg-gradient-to-r transition-all duration-500',
            getBarColor()
          )}
          style={{ width: `${(currentStep / (steps.length - 1)) * 100}%` }}
        />

        {/* Step dots */}
        {steps.map((step, index) => {
          const isComplete = isStepComplete(index);
          const isCurrent = index === currentStep;
          const isPast = index < currentStep;
          const canClick = isPast || isComplete || index === currentStep + 1;

          return (
            <button
              key={step.id}
              onClick={() => canClick && goToStep(index)}
              disabled={!canClick}
              className={cn(
                'relative z-10 flex flex-col items-center group',
                canClick ? 'cursor-pointer' : 'cursor-not-allowed'
              )}
            >
              {/* Dot */}
              <div
                className={cn(
                  'w-6 h-6 rounded-full flex items-center justify-center transition-all duration-200 border-2',
                  isComplete && 'bg-emerald-500 border-emerald-500',
                  isCurrent && !isComplete && 'bg-blue-500 border-blue-500 ring-4 ring-blue-100 dark:ring-blue-500/20',
                  !isComplete && !isCurrent && 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600',
                  canClick && 'group-hover:scale-110'
                )}
              >
                {isComplete ? (
                  <Check className="w-3.5 h-3.5 text-white" />
                ) : (
                  <span
                    className={cn(
                      'text-xs font-medium',
                      isCurrent ? 'text-white' : 'text-gray-500 dark:text-gray-400'
                    )}
                  >
                    {index + 1}
                  </span>
                )}
              </div>

              {/* Label */}
              <span
                className={cn(
                  'absolute top-8 text-xs font-medium whitespace-nowrap transition-colors',
                  isCurrent
                    ? 'text-gray-900 dark:text-gray-100'
                    : 'text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-300'
                )}
              >
                {step.title}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default WizardProgress;
