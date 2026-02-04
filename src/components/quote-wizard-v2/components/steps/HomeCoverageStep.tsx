'use client';

import React from 'react';
import { Shield, Droplets, PlusCircle } from 'lucide-react';
import {
  FormSelect,
  FormInput,
  FormCheckbox,
  FormCurrencyInput,
  FormSection,
  FormFieldGrid,
} from '../../fields';
import {
  DWELLING_OPTIONS,
  PERSONAL_PROPERTY_OPTIONS,
  HOME_LIABILITY_OPTIONS,
  HOME_MEDPAY_OPTIONS,
  HOME_DEDUCTIBLE_OPTIONS,
  HURRICANE_DEDUCTIBLE_OPTIONS,
} from '../../config/options';

interface HomeCoverageStepProps {
  variant?: 'homeowners' | 'renters' | 'flood';
}

export function HomeCoverageStep({ variant = 'homeowners' }: HomeCoverageStepProps) {
  return (
    <div className="space-y-8">
      {/* --- Homeowners variant --- */}
      {variant === 'homeowners' && (
        <>
          <FormSection title="Dwelling Coverage" icon={Shield}>
            <FormFieldGrid cols={2}>
              <FormSelect
                name="coverage.dwelling"
                label="Dwelling"
                options={DWELLING_OPTIONS}
              />
              <FormInput
                name="coverage.otherStructures"
                label="Other Structures"
                placeholder="e.g. 10% of dwelling"
              />
            </FormFieldGrid>
            <FormFieldGrid cols={2}>
              <FormSelect
                name="coverage.personalProperty"
                label="Personal Property"
                options={PERSONAL_PROPERTY_OPTIONS}
              />
              <FormSelect
                name="coverage.liability"
                label="Liability"
                options={HOME_LIABILITY_OPTIONS}
              />
            </FormFieldGrid>
            <FormFieldGrid cols={2}>
              <FormSelect
                name="coverage.medicalPayments"
                label="Medical Payments"
                options={HOME_MEDPAY_OPTIONS}
              />
              <FormSelect
                name="coverage.deductible"
                label="Deductible"
                options={HOME_DEDUCTIBLE_OPTIONS}
              />
            </FormFieldGrid>
            <FormSelect
              name="coverage.hurricaneDeductible"
              label="Hurricane Deductible"
              options={HURRICANE_DEDUCTIBLE_OPTIONS}
            />
          </FormSection>

          <FormSection title="Optional Coverages" icon={PlusCircle}>
            <div className="space-y-4">
              <FormCheckbox
                name="coverage.waterBackup"
                label="Water Backup"
                description="Covers damage from sewer or drain backup"
              />
              <FormCheckbox
                name="coverage.identityTheft"
                label="Identity Theft"
                description="Covers expenses from identity theft recovery"
              />
              <FormCheckbox
                name="coverage.equipmentBreakdown"
                label="Equipment Breakdown"
                description="Covers mechanical/electrical breakdown of home systems"
              />
            </div>
          </FormSection>
        </>
      )}

      {/* --- Renters variant --- */}
      {variant === 'renters' && (
        <>
          <FormSection title="Renters Coverage" icon={Shield}>
            <FormFieldGrid cols={2}>
              <FormSelect
                name="coverage.personalProperty"
                label="Personal Property"
                options={PERSONAL_PROPERTY_OPTIONS}
              />
              <FormSelect
                name="coverage.liability"
                label="Liability"
                options={HOME_LIABILITY_OPTIONS}
              />
            </FormFieldGrid>
            <FormFieldGrid cols={2}>
              <FormSelect
                name="coverage.medicalPayments"
                label="Medical Payments"
                options={HOME_MEDPAY_OPTIONS}
              />
              <FormSelect
                name="coverage.deductible"
                label="Deductible"
                options={HOME_DEDUCTIBLE_OPTIONS}
              />
            </FormFieldGrid>
          </FormSection>

          <FormSection title="Optional Coverages" icon={PlusCircle}>
            <div className="space-y-4">
              <FormCheckbox
                name="coverage.waterBackup"
                label="Water Backup"
                description="Covers damage from sewer or drain backup"
              />
              <FormCheckbox
                name="coverage.identityTheft"
                label="Identity Theft"
                description="Covers expenses from identity theft recovery"
              />
            </div>
          </FormSection>
        </>
      )}

      {/* --- Flood variant --- */}
      {variant === 'flood' && (
        <FormSection title="Flood Coverage" icon={Droplets}>
          <FormFieldGrid cols={2}>
            <FormCurrencyInput
              name="coverage.dwelling"
              label="Dwelling"
              placeholder="250000"
            />
            <FormCurrencyInput
              name="coverage.personalProperty"
              label="Personal Property"
              placeholder="100000"
            />
          </FormFieldGrid>
          <FormSelect
            name="coverage.deductible"
            label="Deductible"
            options={HOME_DEDUCTIBLE_OPTIONS}
          />
        </FormSection>
      )}
    </div>
  );
}

export default HomeCoverageStep;
