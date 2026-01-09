'use client';

/**
 * Service Request Wizard Layout
 * =============================
 * Main layout wrapper with progress indicator and navigation.
 */

import { useRouter } from 'next/navigation';
import { ArrowLeft, Send, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useServiceRequestWizard } from './ServiceRequestWizardProvider';
import { getChangeTypeById } from './config/change-types';

interface LayoutProps {
  children: React.ReactNode;
}

const STEP_LABELS = ['Find Policy', 'Change Type', 'Details', 'Review'];

export function ServiceRequestWizardLayout({ children }: LayoutProps) {
  const router = useRouter();
  const {
    currentStep,
    totalSteps,
    goToStep,
    nextStep,
    prevStep,
    canGoPrev,
    canGoNext,
    formData,
    submitRequest,
    isSubmitting,
  } = useServiceRequestWizard();

  const changeType = formData.changeType ? getChangeTypeById(formData.changeType) : null;
  const progress = ((currentStep + 1) / totalSteps) * 100;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (canGoPrev) {
                    prevStep();
                  } else {
                    router.push('/policy-change');
                  }
                }}
                className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>

              <div className="hidden sm:block">
                <h1 className="font-semibold text-gray-900 dark:text-gray-100">
                  Policy Change Request
                </h1>
                {formData.policy && (
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {formData.policy.policyNumber} - {formData.policy.insuredName}
                  </p>
                )}
              </div>
            </div>

            {currentStep === totalSteps - 1 ? (
              <Button
                onClick={submitRequest}
                disabled={isSubmitting}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Send className="w-4 h-4 mr-2" />
                )}
                Submit Request
              </Button>
            ) : (
              <Button
                onClick={nextStep}
                disabled={!canGoNext}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                Continue
              </Button>
            )}
          </div>

          {/* Progress Steps */}
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              {STEP_LABELS.map((label, idx) => (
                <button
                  key={label}
                  onClick={() => idx < currentStep && goToStep(idx)}
                  disabled={idx > currentStep}
                  className={cn(
                    'flex items-center gap-2 text-sm transition-colors',
                    idx === currentStep
                      ? 'text-emerald-600 dark:text-emerald-400 font-medium'
                      : idx < currentStep
                      ? 'text-gray-600 dark:text-gray-400 hover:text-emerald-600 cursor-pointer'
                      : 'text-gray-400 dark:text-gray-600 cursor-not-allowed'
                  )}
                >
                  <span
                    className={cn(
                      'w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium',
                      idx === currentStep
                        ? 'bg-emerald-600 text-white'
                        : idx < currentStep
                        ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
                        : 'bg-gray-200 dark:bg-gray-800 text-gray-500 dark:text-gray-500'
                    )}
                  >
                    {idx + 1}
                  </span>
                  <span className="hidden sm:inline">{label}</span>
                </button>
              ))}
            </div>

            {/* Progress Bar */}
            <div className="h-1 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        {children}
      </div>
    </div>
  );
}
