'use client';

import { useEffect, useCallback } from 'react';
import { useFormContext } from 'react-hook-form';
import { useQuoteWizard } from './QuoteWizardProvider';
import { ArrowLeft, ArrowRight, Check, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export function WizardNavigation() {
  const {
    currentStep,
    totalSteps,
    canGoNext,
    canGoPrev,
    nextStep,
    prevStep,
    submitQuote,
    isSubmitting,
  } = useQuoteWizard();

  const { formState: { errors } } = useFormContext();
  const isLastStep = currentStep === totalSteps - 1;

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Enter' && e.target instanceof HTMLElement) {
        const tagName = e.target.tagName.toLowerCase();
        if (tagName !== 'textarea' && tagName !== 'button' && tagName !== 'select') {
          e.preventDefault();
          if (isLastStep) {
            submitQuote();
          } else {
            nextStep();
          }
        }
      }
      if (e.key === 'Escape' && canGoPrev) {
        e.preventDefault();
        prevStep();
      }
    },
    [canGoPrev, isLastStep, nextStep, prevStep, submitQuote]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Check for global-level errors
  const globalError = (errors as any)?._global?.message || (errors as any)?.root?.message;

  return (
    <div className="space-y-4">
      {globalError && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-500/50 rounded-lg">
          <p className="text-sm text-red-700 dark:text-red-300">{globalError}</p>
        </div>
      )}

      <div className="flex items-center justify-between">
        <button
          onClick={prevStep}
          disabled={!canGoPrev}
          className={cn(
            'flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium transition-all',
            canGoPrev
              ? 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              : 'text-gray-400 dark:text-gray-600 cursor-not-allowed'
          )}
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>

        <div className="hidden sm:flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500">
          <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-gray-600 dark:text-gray-400">
            Enter
          </kbd>
          <span>to continue</span>
          {canGoPrev && (
            <>
              <span className="mx-1">&middot;</span>
              <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-gray-600 dark:text-gray-400">
                Esc
              </kbd>
              <span>to go back</span>
            </>
          )}
        </div>

        {isLastStep ? (
          <button
            onClick={submitQuote}
            disabled={isSubmitting}
            className={cn(
              'flex items-center gap-2 px-6 py-2.5 rounded-lg font-medium transition-all',
              'bg-blue-600 text-white hover:bg-blue-700 active:scale-[0.98]',
              'shadow-lg shadow-blue-500/20',
              isSubmitting && 'opacity-70 cursor-not-allowed'
            )}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                Submit Quote
              </>
            )}
          </button>
        ) : (
          <button
            onClick={() => nextStep()}
            disabled={!canGoNext}
            className={cn(
              'flex items-center gap-2 px-6 py-2.5 rounded-lg font-medium transition-all',
              canGoNext
                ? 'bg-blue-600 text-white hover:bg-blue-700 active:scale-[0.98] shadow-lg shadow-blue-500/20'
                : 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
            )}
          >
            Continue
            <ArrowRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

export default WizardNavigation;
