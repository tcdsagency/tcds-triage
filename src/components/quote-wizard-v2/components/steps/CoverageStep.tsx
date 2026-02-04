'use client';

import React from 'react';
import { useFormContext } from 'react-hook-form';
import { Shield, Car, PlusCircle } from 'lucide-react';
import {
  FormSelect,
  FormCheckbox,
  FormSection,
  FormFieldGrid,
} from '../../fields';
import {
  LIABILITY_OPTIONS,
  PROPERTY_DAMAGE_OPTIONS,
  UMUIN_OPTIONS,
  MEDPAY_OPTIONS,
  DEDUCTIBLE_OPTIONS,
} from '../../config/options';

export function CoverageStep() {
  const { watch } = useFormContext();
  const vehicles: { year?: string; make?: string; model?: string }[] =
    watch('vehicles') ?? [];

  return (
    <div className="space-y-8">
      {/* Liability Section */}
      <FormSection title="Liability Coverage" icon={Shield}>
        <FormFieldGrid cols={2}>
          <FormSelect
            name="coverage.bodilyInjury"
            label="Bodily Injury"
            options={LIABILITY_OPTIONS}
          />
          <FormSelect
            name="coverage.propertyDamage"
            label="Property Damage"
            options={PROPERTY_DAMAGE_OPTIONS}
          />
        </FormFieldGrid>
        <FormFieldGrid cols={2}>
          <FormSelect
            name="coverage.umUim"
            label="UM/UIM"
            options={UMUIN_OPTIONS}
          />
          <FormSelect
            name="coverage.medPay"
            label="Medical Payments"
            options={MEDPAY_OPTIONS}
          />
        </FormFieldGrid>
      </FormSection>

      {/* Per-Vehicle Physical Damage */}
      <FormSection title="Physical Damage" icon={Car}>
        {vehicles.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No vehicles added yet. Go back to the vehicles step to add at least
            one vehicle.
          </p>
        ) : (
          <div className="space-y-4">
            {vehicles.map((vehicle, i) => {
              const label = [vehicle.year, vehicle.make, vehicle.model]
                .filter(Boolean)
                .join(' ') || `Vehicle ${i + 1}`;

              return (
                <div
                  key={i}
                  className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-4 space-y-3"
                >
                  <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                    {label}
                  </h4>
                  <FormFieldGrid cols={2}>
                    <FormSelect
                      name={`vehicles.${i}.compDeductible`}
                      label="Comprehensive"
                      options={DEDUCTIBLE_OPTIONS}
                    />
                    <FormSelect
                      name={`vehicles.${i}.collDeductible`}
                      label="Collision"
                      options={DEDUCTIBLE_OPTIONS}
                    />
                  </FormFieldGrid>
                </div>
              );
            })}
          </div>
        )}
      </FormSection>

      {/* Additional Coverages */}
      <FormSection title="Additional Coverages" icon={PlusCircle}>
        <div className="space-y-4">
          <FormCheckbox
            name="coverage.rental"
            label="Rental Car Reimbursement"
            description="Covers rental car costs while your vehicle is being repaired"
          />
          <FormCheckbox
            name="coverage.roadside"
            label="Roadside Assistance"
            description="24/7 roadside help including towing"
          />
        </div>
      </FormSection>
    </div>
  );
}

export default CoverageStep;
