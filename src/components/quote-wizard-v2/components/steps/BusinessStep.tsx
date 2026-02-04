'use client';

import React from 'react';
import { Building2, MapPin, DollarSign } from 'lucide-react';
import {
  FormInput,
  FormSelect,
  FormCheckbox,
  FormCurrencyInput,
  FormSection,
  FormFieldGrid,
} from '../../fields';
import { FormTextarea } from '../../fields';
import { BUSINESS_TYPES } from '../../config/options';
import { AddressFields } from '../shared/AddressFields';

interface BusinessStepProps {
  variant?: 'bop' | 'gl' | 'wc';
}

export function BusinessStep({ variant = 'bop' }: BusinessStepProps) {
  return (
    <div className="space-y-8">
      {/* Business Info */}
      <FormSection title="Business Information" icon={Building2}>
        <FormFieldGrid cols={2}>
          <FormInput
            name="businessName"
            label="Business Name"
            required
          />
          <FormSelect
            name="businessType"
            label="Business Type"
            options={BUSINESS_TYPES}
            required
            placeholder="Select business type..."
          />
        </FormFieldGrid>
        <FormFieldGrid cols={2}>
          <FormInput
            name="yearsInBusiness"
            label="Years in Business"
            type="number"
          />
          <FormCurrencyInput
            name="annualRevenue"
            label="Annual Revenue"
          />
        </FormFieldGrid>
        {(variant === 'gl' || variant === 'wc') && (
          <FormTextarea
            name="businessDescription"
            label="Business Description"
            placeholder="Describe the nature of your business operations..."
            rows={3}
          />
        )}
      </FormSection>

      {/* Business Location */}
      <FormSection title="Business Location" icon={MapPin}>
        <AddressFields prefix="property" />
      </FormSection>

      {/* Financials / Employees */}
      <FormSection title="Financials" icon={DollarSign}>
        <FormFieldGrid cols={2}>
          <FormInput
            name="employeeCount"
            label="Number of Employees"
            type="number"
          />
        </FormFieldGrid>

        {variant === 'wc' && (
          <FormInput
            name="fein"
            label="FEIN (Federal Employer ID)"
            required
            placeholder="XX-XXXXXXX"
          />
        )}

        {variant === 'gl' && (
          <div className="space-y-4">
            <FormInput
              name="classCode"
              label="Class Code"
              placeholder="e.g. 91580"
            />
            <FormCheckbox
              name="hasSubcontractors"
              label="Uses Subcontractors"
              description="Check if your business hires subcontractors"
            />
            <FormCheckbox
              name="needsCOI"
              label="Needs Certificate of Insurance"
              description="A COI is required for your business contracts"
            />
          </div>
        )}
      </FormSection>
    </div>
  );
}

export default BusinessStep;
