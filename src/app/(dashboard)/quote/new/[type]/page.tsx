'use client';

/**
 * Quote Wizard Page (v2)
 * ======================
 * Dynamic route for quote wizard by type.
 * URL: /quote/new/[type] (e.g., /quote/new/personal_auto)
 */

import { use } from 'react';
import { notFound } from 'next/navigation';
import { QuoteFormProvider } from '@/components/quote-wizard-v2/QuoteFormProvider';
import { QuoteWizardProvider } from '@/components/quote-wizard-v2/QuoteWizardProvider';
import { QuoteWizardLayout } from '@/components/quote-wizard-v2/QuoteWizardLayout';
import { WizardContent } from '@/components/quote-wizard-v2/WizardContent';
import { getStepsForType } from '@/components/quote-wizard-v2/config/steps';
import { getDefaultsForType } from '@/components/quote-wizard-v2/config/defaults';
import type { QuoteType } from '@/components/quote-wizard-v2/schemas';

// =============================================================================
// QUOTE TYPE LABELS
// =============================================================================

const QUOTE_TYPE_LABELS: Record<QuoteType, string> = {
  personal_auto: 'Personal Auto',
  homeowners: 'Homeowners',
  renters: 'Renters',
  mobile_home: 'Mobile Home',
  flood: 'Flood Insurance',
  umbrella: 'Umbrella',
  bop: "Business Owner's Policy",
  general_liability: 'General Liability',
  workers_comp: 'Workers Compensation',
  recreational: 'Recreational Vehicle',
};

const VALID_TYPES = new Set<string>(Object.keys(QUOTE_TYPE_LABELS));

// =============================================================================
// PAGE COMPONENT
// =============================================================================

interface PageProps {
  params: Promise<{ type: string }>;
}

export default function QuoteWizardPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const quoteType = resolvedParams.type as QuoteType;

  if (!VALID_TYPES.has(quoteType)) {
    notFound();
  }

  const label = QUOTE_TYPE_LABELS[quoteType];
  const steps = getStepsForType(quoteType);
  const defaults = getDefaultsForType(quoteType);

  return (
    <QuoteFormProvider quoteType={quoteType} defaultValues={defaults}>
      <QuoteWizardProvider quoteType={quoteType} steps={steps}>
        <QuoteWizardLayout title={`New ${label} Quote`}>
          <WizardContent />
        </QuoteWizardLayout>
      </QuoteWizardProvider>
    </QuoteFormProvider>
  );
}
