'use client';

/**
 * Wizard Navigation Component
 * ===========================
 * Back/Continue navigation buttons with keyboard support.
 */

import { useEffect, useCallback } from 'react';
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
    errors,
  } = useQuoteWizard();

  const isLastStep = currentStep === totalSteps - 1;

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Enter to continue (but not when in a textarea)
      if (e.key === 'Enter' && e.target instanceof HTMLElement) {
        const tagName = e.target.tagName.toLowerCase();
        if (tagName !== 'textarea' && tagName !== 'button') {
          e.preventDefault();
          if (isLastStep) {
            submitQuote();
          } else {
            nextStep();
          }
        }
      }
      // Escape to go back
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

  return (
    <div className="space-y-4">
      {/* Global error message */}
      {errors._global && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-500/50 rounded-lg">
          <p className="text-sm text-red-700 dark:text-red-300">{errors._global}</p>
        </div>
      )}

      {/* Navigation buttons */}
      <div className="flex items-center justify-between">
        {/* Back button */}
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

        {/* Keyboard hint */}
        <div className="hidden sm:flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500">
          <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-gray-600 dark:text-gray-400">
            Enter
          </kbd>
          <span>to continue</span>
          {canGoPrev && (
            <>
              <span className="mx-1">•</span>
              <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-gray-600 dark:text-gray-400">
                Esc
              </kbd>
              <span>to go back</span>
            </>
          )}
        </div>

        {/* Continue/Submit button */}
        {isLastStep ? (
          <button
            onClick={submitQuote}
            disabled={isSubmitting}
            className={cn(
              'flex items-center gap-2 px-6 py-2.5 rounded-lg font-medium transition-all',
              'bg-emerald-600 text-white hover:bg-emerald-700',
              'shadow-lg shadow-emerald-500/20',
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
            onClick={nextStep}
            disabled={!canGoNext}
            className={cn(
              'flex items-center gap-2 px-6 py-2.5 rounded-lg font-medium transition-all',
              canGoNext
                ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-lg shadow-emerald-500/20'
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
