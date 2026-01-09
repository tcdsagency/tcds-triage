'use client';

/**
 * Policy Change Page
 * ==================
 * Wizard-based policy change request form.
 */

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { ServiceRequestWizardProvider } from '@/components/service-request-wizard/ServiceRequestWizardProvider';
import { ServiceRequestWizardLayout } from '@/components/service-request-wizard/ServiceRequestWizardLayout';
import { PolicySearchStep, ChangeTypeStep, ChangeFormStep, ReviewStep } from '@/components/service-request-wizard/steps';
import { useServiceRequestWizard } from '@/components/service-request-wizard/ServiceRequestWizardProvider';

// Step renderer component
function WizardSteps() {
  const { currentStep } = useServiceRequestWizard();

  switch (currentStep) {
    case 0:
      return <PolicySearchStep />;
    case 1:
      return <ChangeTypeStep />;
    case 2:
      return <ChangeFormStep />;
    case 3:
      return <ReviewStep />;
    default:
      return <PolicySearchStep />;
  }
}

// Inner component that uses search params
function PolicyChangeContent() {
  const searchParams = useSearchParams();
  const prefillName = searchParams.get('name') || undefined;
  const prefillPolicyNumber = searchParams.get('policyNumber') || undefined;

  return (
    <ServiceRequestWizardProvider
      prefillName={prefillName}
      prefillPolicyNumber={prefillPolicyNumber}
    >
      <ServiceRequestWizardLayout>
        <WizardSteps />
      </ServiceRequestWizardLayout>
    </ServiceRequestWizardProvider>
  );
}

// Main page component with Suspense boundary
export default function PolicyChangePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-600 mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    }>
      <PolicyChangeContent />
    </Suspense>
  );
}
