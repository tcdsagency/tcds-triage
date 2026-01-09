'use client';

/**
 * Quote Wizard Layout
 * ===================
 * Main layout wrapper for the quote wizard with header, progress, and navigation.
 */

import { useQuoteWizard } from './QuoteWizardProvider';
import { WizardProgress } from './WizardProgress';
import { WizardNavigation } from './WizardNavigation';
import { ArrowLeft, Save } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

interface QuoteWizardLayoutProps {
  children: React.ReactNode;
  title: string;
}

export function QuoteWizardLayout({ children, title }: QuoteWizardLayoutProps) {
  const {
    currentStep,
    steps,
    isSaving,
    lastSaved,
    saveAsDraft,
    getStepProgress,
    eligibility,
  } = useQuoteWizard();

  const currentStepConfig = steps[currentStep];
  const progress = getStepProgress();

  // Format last saved time
  const formatLastSaved = () => {
    if (!lastSaved) return null;
    const diff = Math.floor((Date.now() - lastSaved.getTime()) / 1000);
    if (diff < 60) return 'Saved just now';
    if (diff < 3600) return `Saved ${Math.floor(diff / 60)}m ago`;
    return `Saved ${Math.floor(diff / 3600)}h ago`;
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Back to quotes */}
            <Link
              href="/quote/new"
              className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="text-sm font-medium">Back</span>
            </Link>

            {/* Title */}
            <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {title}
            </h1>

            {/* Save Draft */}
            <div className="flex items-center gap-3">
              {lastSaved && (
                <span className="text-xs text-gray-500 dark:text-gray-400 hidden sm:block">
                  {formatLastSaved()}
                </span>
              )}
              <button
                onClick={() => saveAsDraft()}
                disabled={isSaving}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors',
                  'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700',
                  'border border-gray-300 dark:border-gray-600',
                  isSaving && 'opacity-50 cursor-not-allowed'
                )}
              >
                <Save className="w-4 h-4" />
                <span className="hidden sm:inline">Save Draft</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Progress Bar */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 py-4">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <WizardProgress
            steps={steps}
            currentStep={currentStep}
            progress={progress}
            eligibilityStatus={eligibility?.status}
          />
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Step Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            {currentStepConfig?.icon && (
              <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                <currentStepConfig.icon className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              </div>
            )}
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Step {currentStep + 1} of {steps.length}
              </p>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                {currentStepConfig?.title}
              </h2>
            </div>
          </div>
          {currentStepConfig?.description && (
            <p className="text-gray-600 dark:text-gray-400 ml-12">
              {currentStepConfig.description}
            </p>
          )}
        </div>

        {/* Step Content */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 sm:p-8 mb-8">
          {children}
        </div>

        {/* Navigation */}
        <WizardNavigation />
      </main>
    </div>
  );
}

export default QuoteWizardLayout;
