'use client';

/**
 * Quote Wizard Page
 * =================
 * Dynamic route for quote wizard by type.
 * URL: /quote/new/[type] (e.g., /quote/new/personal_auto)
 */

import { use } from 'react';
import { notFound } from 'next/navigation';
import { QuoteWizardProvider } from '@/components/quote-wizard/QuoteWizardProvider';
import { QuoteWizardLayout } from '@/components/quote-wizard/QuoteWizardLayout';
import { useQuoteWizard } from '@/components/quote-wizard/QuoteWizardProvider';
import { QuoteType, StepConfig } from '@/components/quote-wizard/config/types';
import { personalAutoSteps } from '@/components/quote-wizard/config/personal-auto';

// Import step components
import {
  ContactStep,
  VehiclesStep,
  DriversStep,
  CoverageStep,
  ReviewStep,
} from '@/components/quote-wizard/steps';

// =============================================================================
// QUOTE TYPE CONFIGURATIONS
// =============================================================================

interface QuoteTypeInfo {
  label: string;
  steps: StepConfig[];
}

const QUOTE_TYPES: Record<QuoteType, QuoteTypeInfo> = {
  personal_auto: {
    label: 'Personal Auto',
    steps: personalAutoSteps,
  },
  homeowners: {
    label: 'Homeowners',
    steps: personalAutoSteps, // TODO: Create homeowners steps
  },
  renters: {
    label: 'Renters',
    steps: personalAutoSteps, // TODO: Create renters steps
  },
  mobile_home: {
    label: 'Mobile Home',
    steps: personalAutoSteps, // TODO: Create mobile home steps
  },
  umbrella: {
    label: 'Umbrella',
    steps: personalAutoSteps, // TODO: Create umbrella steps
  },
  bop: {
    label: 'Business Owner\'s Policy',
    steps: personalAutoSteps, // TODO: Create BOP steps
  },
  general_liability: {
    label: 'General Liability',
    steps: personalAutoSteps, // TODO: Create GL steps
  },
  workers_comp: {
    label: 'Workers Compensation',
    steps: personalAutoSteps, // TODO: Create WC steps
  },
  recreational: {
    label: 'Recreational Vehicle',
    steps: personalAutoSteps, // TODO: Create recreational steps
  },
};

// =============================================================================
// STEP COMPONENT MAPPING
// =============================================================================

const STEP_COMPONENTS: Record<string, React.ComponentType> = {
  contact: ContactStep,
  vehicles: VehiclesStep,
  drivers: DriversStep,
  coverage: CoverageStep,
  review: ReviewStep,
};

// =============================================================================
// WIZARD CONTENT (renders current step)
// =============================================================================

function WizardContent() {
  const { currentStep, steps } = useQuoteWizard();
  const currentStepConfig = steps[currentStep];

  if (!currentStepConfig) {
    return <div>Step not found</div>;
  }

  const StepComponent = STEP_COMPONENTS[currentStepConfig.id];

  if (!StepComponent) {
    return (
      <div className="text-center py-12 text-gray-500 dark:text-gray-400">
        <p>Step component &quot;{currentStepConfig.id}&quot; not implemented yet.</p>
        <p className="text-sm mt-2">This step is coming soon!</p>
      </div>
    );
  }

  return <StepComponent />;
}

// =============================================================================
// PAGE COMPONENT
// =============================================================================

interface PageProps {
  params: Promise<{ type: string }>;
}

export default function QuoteWizardPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const quoteType = resolvedParams.type as QuoteType;

  // Validate quote type
  if (!QUOTE_TYPES[quoteType]) {
    notFound();
  }

  const { label, steps } = QUOTE_TYPES[quoteType];

  return (
    <QuoteWizardProvider quoteType={quoteType} steps={steps}>
      <QuoteWizardLayout title={`New ${label} Quote`}>
        <WizardContent />
      </QuoteWizardLayout>
    </QuoteWizardProvider>
  );
}
