'use client';

import React from 'react';
import { useFormContext } from 'react-hook-form';
import { Info, AlertTriangle } from 'lucide-react';
import {
  FormInput,
  FormCheckbox,
  FormSection,
  FormFieldGrid,
} from '../../fields';
import { CurrentInsuranceFields } from '../shared/CurrentInsuranceFields';

export function UnderlyingPoliciesStep() {
  const { watch } = useFormContext();
  const hasDog = watch('hasDog');

  return (
    <div className="space-y-8">
      {/* Info Banner */}
      <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-4 flex gap-3">
        <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
        <div className="text-sm text-blue-800 dark:text-blue-200">
          <p className="font-medium mb-1">Umbrella Policy Requirements</p>
          <p>
            An umbrella policy requires underlying auto and homeowners (or
            renters) insurance with minimum liability limits. Please provide your
            current policy information below so we can verify eligibility and
            ensure seamless coverage.
          </p>
        </div>
      </div>

      {/* Current Insurance */}
      <CurrentInsuranceFields />

      {/* Liability Exposures */}
      <FormSection title="Liability Exposures" icon={AlertTriangle}>
        <div className="space-y-4">
          <FormCheckbox
            name="hasPool"
            label="Swimming Pool"
            description="Property has a swimming pool or hot tub"
          />
          <FormCheckbox
            name="hasTrampoline"
            label="Trampoline"
            description="Property has a trampoline"
          />
          <FormCheckbox
            name="hasDog"
            label="Dog on Premises"
            description="Property has one or more dogs"
          />
          {hasDog && (
            <FormFieldGrid cols={2}>
              <FormInput
                name="dogBreed"
                label="Dog Breed(s)"
                placeholder="e.g. Labrador Retriever"
              />
            </FormFieldGrid>
          )}
        </div>
      </FormSection>
    </div>
  );
}

export default UnderlyingPoliciesStep;
