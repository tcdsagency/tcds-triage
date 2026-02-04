'use client';

/**
 * QuoteWizardLayout
 * ==================
 * Main layout with header, progress, form area, Agent Assist, and navigation.
 */

import { useState, useEffect } from 'react';
import { useFormContext } from 'react-hook-form';
import { useQuoteWizard } from './QuoteWizardProvider';
import { WizardProgress } from './WizardProgress';
import { WizardNavigation } from './WizardNavigation';
import { AgentAssistPanel } from './AgentAssistPanel';
import { ArrowLeft, Save, RotateCcw, Lightbulb, X } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { AnimatePresence, motion } from 'framer-motion';

interface QuoteWizardLayoutProps {
  children: React.ReactNode;
  title: string;
}

export function QuoteWizardLayout({ children, title }: QuoteWizardLayoutProps) {
  const {
    currentStep,
    steps,
    quoteType,
    isSaving,
    lastSaved,
    saveAsDraft,
    resetForm,
    eligibility,
  } = useQuoteWizard();

  const { formState: { isDirty } } = useFormContext();

  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showMobileAssist, setShowMobileAssist] = useState(false);
  const [prevStep, setPrevStep] = useState(currentStep);

  const direction = currentStep > prevStep ? 1 : -1;
  useEffect(() => {
    setPrevStep(currentStep);
  }, [currentStep]);

  const currentStepConfig = steps[currentStep];

  // beforeunload warning
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link
              href="/quote/new"
              className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="text-sm font-medium">Back</span>
            </Link>

            <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {title}
            </h1>

            <div className="flex items-center gap-2">
              {lastSaved && (
                <span className="text-xs text-gray-500 dark:text-gray-400 hidden sm:block">
                  {formatLastSaved()}
                </span>
              )}
              <button
                onClick={() => setShowResetConfirm(true)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors',
                  'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700',
                  'border border-gray-300 dark:border-gray-600'
                )}
              >
                <RotateCcw className="w-4 h-4" />
                <span className="hidden sm:inline">Start Over</span>
              </button>
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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <WizardProgress
            steps={steps}
            currentStep={currentStep}
            eligibilityStatus={eligibility?.status}
          />
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex gap-8">
          {/* Form Column */}
          <div className="flex-1 max-w-3xl">
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

            {/* Step Content with Animation */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 sm:p-8 mb-8 overflow-hidden">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={currentStep}
                  initial={{ x: direction * 30, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: direction * -30, opacity: 0 }}
                  transition={{ duration: 0.2, ease: 'easeInOut' }}
                >
                  {children}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Navigation */}
            <WizardNavigation />

            {/* Aria live region for step changes */}
            <div className="sr-only" aria-live="polite">
              Step {currentStep + 1} of {steps.length}: {currentStepConfig?.title}
            </div>
          </div>

          {/* Agent Assist - Desktop */}
          <div className="hidden lg:block w-80 flex-shrink-0">
            <AgentAssistPanel
              currentStepId={currentStepConfig?.id || 'contact'}
              quoteType={quoteType}
            />
          </div>
        </div>
      </main>

      {/* Mobile Agent Assist Toggle */}
      <button
        onClick={() => setShowMobileAssist(true)}
        className="lg:hidden fixed bottom-20 right-4 z-30 p-4 bg-amber-500 hover:bg-amber-600 text-white rounded-full shadow-lg transition-colors"
        aria-label="Open Agent Assist"
      >
        <Lightbulb className="w-6 h-6" />
      </button>

      {/* Mobile Agent Assist Drawer */}
      {showMobileAssist && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowMobileAssist(false)}
          />
          <div className="absolute right-0 top-0 bottom-0 w-full max-w-sm bg-white dark:bg-gray-800 shadow-xl overflow-y-auto">
            <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">Agent Assist</h3>
              <button
                onClick={() => setShowMobileAssist(false)}
                className="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4">
              <AgentAssistPanel
                currentStepId={currentStepConfig?.id || 'contact'}
                quoteType={quoteType}
              />
            </div>
          </div>
        </div>
      )}

      {/* Reset Confirmation Modal */}
      {showResetConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-sm w-full mx-4 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Start Over?
              </h3>
            </div>
            <div className="px-6 py-4">
              <p className="text-gray-600 dark:text-gray-400">
                This will clear all entered data and start a new quote from the beginning. This action cannot be undone.
              </p>
            </div>
            <div className="px-6 py-4 bg-gray-50 dark:bg-gray-700/50 flex gap-3 justify-end">
              <button
                onClick={() => setShowResetConfirm(false)}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-600 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  resetForm();
                  setShowResetConfirm(false);
                }}
                className="px-4 py-2 text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
              >
                Start Over
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default QuoteWizardLayout;
