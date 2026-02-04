'use client';

/**
 * WizardContent
 * =============
 * Maps step IDs to step components and renders the current step.
 */

import { useQuoteWizard } from './QuoteWizardProvider';
import type { QuoteType } from './schemas';

// Step components
import { ContactStep } from './components/steps/ContactStep';
import { VehiclesStep } from './components/steps/VehiclesStep';
import { DriversStep } from './components/steps/DriversStep';
import { PropertyStep } from './components/steps/PropertyStep';
import { PropertyDetailsStep } from './components/steps/PropertyDetailsStep';
import { FloodDetailsStep } from './components/steps/FloodDetailsStep';
import { RentalStep } from './components/steps/RentalStep';
import { CoverageStep } from './components/steps/CoverageStep';
import { HomeCoverageStep } from './components/steps/HomeCoverageStep';
import { BusinessStep } from './components/steps/BusinessStep';
import { EmployeesStep } from './components/steps/EmployeesStep';
import { UnderlyingPoliciesStep } from './components/steps/UnderlyingPoliciesStep';
import { UmbrellaCoverageStep } from './components/steps/UmbrellaCoverageStep';
import { ReviewStep } from './components/steps/ReviewStep';

interface StepComponentConfig {
  component: React.ComponentType<any>;
  props?: Record<string, any>;
}

function getStepComponent(stepId: string, quoteType: QuoteType): StepComponentConfig | null {
  switch (stepId) {
    case 'contact':
      return {
        component: ContactStep,
        props: {
          showLicense: quoteType === 'personal_auto' || quoteType === 'recreational',
          showSpouse: quoteType === 'personal_auto' || quoteType === 'recreational',
          showAddress: quoteType === 'personal_auto' || quoteType === 'recreational' || quoteType === 'umbrella',
        },
      };

    case 'vehicles':
      return { component: VehiclesStep };

    case 'drivers':
      return { component: DriversStep };

    case 'property':
      return { component: PropertyStep };

    case 'details':
      return { component: PropertyDetailsStep };

    case 'floodDetails':
      return { component: FloodDetailsStep };

    case 'coverage':
      if (quoteType === 'personal_auto' || quoteType === 'recreational') {
        return { component: CoverageStep };
      }
      if (quoteType === 'bop') {
        return { component: HomeCoverageStep, props: { variant: 'homeowners' } };
      }
      if (quoteType === 'general_liability') {
        return { component: HomeCoverageStep, props: { variant: 'homeowners' } };
      }
      return { component: CoverageStep };

    case 'homeCoverage':
      if (quoteType === 'renters') {
        return { component: HomeCoverageStep, props: { variant: 'renters' } };
      }
      if (quoteType === 'flood') {
        return { component: HomeCoverageStep, props: { variant: 'flood' } };
      }
      return { component: HomeCoverageStep, props: { variant: 'homeowners' } };

    case 'business':
      if (quoteType === 'workers_comp') {
        return { component: BusinessStep, props: { variant: 'wc' } };
      }
      if (quoteType === 'general_liability') {
        return { component: BusinessStep, props: { variant: 'gl' } };
      }
      return { component: BusinessStep, props: { variant: 'bop' } };

    case 'employees':
      return { component: EmployeesStep };

    case 'underlying':
      return { component: UnderlyingPoliciesStep };

    case 'umbrellaCoverage':
      return { component: UmbrellaCoverageStep };

    case 'review':
      return { component: ReviewStep };

    default:
      return null;
  }
}

export function WizardContent() {
  const { currentStep, steps, quoteType } = useQuoteWizard();
  const currentStepConfig = steps[currentStep];

  if (!currentStepConfig) {
    return <div>Step not found</div>;
  }

  const stepConfig = getStepComponent(currentStepConfig.id, quoteType);

  if (!stepConfig) {
    return (
      <div className="text-center py-12 text-gray-500 dark:text-gray-400">
        <p>Step component &quot;{currentStepConfig.id}&quot; not implemented yet.</p>
        <p className="text-sm mt-2">This step is coming soon!</p>
      </div>
    );
  }

  const { component: StepComponent, props = {} } = stepConfig;

  return <StepComponent {...props} />;
}

export default WizardContent;
