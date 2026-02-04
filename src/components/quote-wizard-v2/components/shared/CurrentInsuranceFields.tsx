'use client';

import React from 'react';
import { useFormContext } from 'react-hook-form';
import { Shield } from 'lucide-react';
import {
  FormInput,
  FormCheckbox,
  FormCurrencyInput,
  FormSection,
  FormFieldGrid,
} from '../../fields';

export function CurrentInsuranceFields() {
  const { watch } = useFormContext();
  const hasCurrentInsurance = watch('hasCurrentInsurance');

  return (
    <FormSection title="Current Insurance" icon={Shield}>
      <FormCheckbox
        name="hasCurrentInsurance"
        label="Currently insured"
      />
      {hasCurrentInsurance && (
        <FormFieldGrid cols={2}>
          <FormInput
            name="currentCarrier"
            label="Current Insurance Carrier"
          />
          <FormCurrencyInput
            name="currentPremium"
            label="Current Premium"
          />
          <FormInput
            name="yearsWithCarrier"
            label="Years with Current Carrier"
            type="number"
          />
          <FormInput
            name="reasonForShopping"
            label="Reason for Shopping"
          />
        </FormFieldGrid>
      )}
    </FormSection>
  );
}

export default CurrentInsuranceFields;
