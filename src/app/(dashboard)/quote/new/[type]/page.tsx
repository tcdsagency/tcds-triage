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

// Import step configurations
import { personalAutoSteps } from '@/components/quote-wizard/config/personal-auto';
import { homeownersSteps } from '@/components/quote-wizard/config/homeowners';
import { rentersSteps } from '@/components/quote-wizard/config/renters';
import { mobileHomeSteps } from '@/components/quote-wizard/config/mobile-home';
import { umbrellaSteps } from '@/components/quote-wizard/config/umbrella';
import { bopSteps } from '@/components/quote-wizard/config/bop';
import { generalLiabilitySteps } from '@/components/quote-wizard/config/general-liability';
import { workersCompSteps } from '@/components/quote-wizard/config/workers-comp';
import { recreationalSteps } from '@/components/quote-wizard/config/recreational';

// Import step components
import {
  ContactStep,
  VehiclesStep,
  DriversStep,
  CoverageStep,
  ReviewStep,
  PropertyStep,
  PropertyDetailsStep,
  HomeCoverageStep,
  BusinessStep,
  EmployeesStep,
  UnderlyingPoliciesStep,
  UmbrellaCoverageStep,
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
    steps: homeownersSteps,
  },
  renters: {
    label: 'Renters',
    steps: rentersSteps,
  },
  mobile_home: {
    label: 'Mobile Home',
    steps: mobileHomeSteps,
  },
  umbrella: {
    label: 'Umbrella',
    steps: umbrellaSteps,
  },
  bop: {
    label: 'Business Owner\'s Policy',
    steps: bopSteps,
  },
  general_liability: {
    label: 'General Liability',
    steps: generalLiabilitySteps,
  },
  workers_comp: {
    label: 'Workers Compensation',
    steps: workersCompSteps,
  },
  recreational: {
    label: 'Recreational Vehicle',
    steps: recreationalSteps,
  },
};

// =============================================================================
// STEP COMPONENT MAPPING
// =============================================================================

const STEP_COMPONENTS: Record<string, React.ComponentType> = {
  // Shared steps
  contact: ContactStep,
  review: ReviewStep,

  // Auto steps
  vehicles: VehiclesStep,
  drivers: DriversStep,
  coverage: CoverageStep,

  // Property steps
  property: PropertyStep,
  details: PropertyDetailsStep,

  // Home coverage (for homeowners/renters/mobile home)
  homeCoverage: HomeCoverageStep,

  // Commercial steps
  business: BusinessStep,
  location: PropertyStep, // Reuse PropertyStep for business location
  employees: EmployeesStep,

  // Umbrella steps
  underlying: UnderlyingPoliciesStep,
  umbrellaCoverage: UmbrellaCoverageStep,
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
