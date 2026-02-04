'use client';

import React from 'react';
import { useFormContext } from 'react-hook-form';
import { Home, Shield } from 'lucide-react';
import {
  FormInput,
  FormSelect,
  FormCheckbox,
  FormSection,
  FormFieldGrid,
} from '../../fields';
import {
  CONSTRUCTION_TYPES,
  FOUNDATION_TYPES,
  GARAGE_TYPES,
  ROOF_MATERIALS,
  HEATING_TYPES,
  UPDATE_YEARS,
} from '../../config/options';

export function PropertyDetailsFields() {
  const { watch } = useFormContext();
  const hasPool = watch('hasPool');
  const hasDog = watch('hasDog');
  const hasSecuritySystem = watch('hasSecuritySystem');

  return (
    <div className="space-y-6">
      {/* Construction */}
      <FormSection title="Construction Details" icon={Home}>
        <FormFieldGrid cols={3}>
          <FormSelect
            name="constructionType"
            label="Construction Type"
            options={CONSTRUCTION_TYPES}
          />
          <FormSelect
            name="foundationType"
            label="Foundation Type"
            options={FOUNDATION_TYPES}
          />
          <FormSelect
            name="garageType"
            label="Garage Type"
            options={GARAGE_TYPES}
          />
        </FormFieldGrid>
      </FormSection>

      {/* Roof */}
      <FormSection title="Roof Information">
        <FormFieldGrid cols={2}>
          <FormSelect
            name="roofMaterial"
            label="Roof Material"
            options={ROOF_MATERIALS}
          />
          <FormInput
            name="roofAge"
            label="Roof Age (years)"
            type="number"
          />
        </FormFieldGrid>
      </FormSection>

      {/* Systems */}
      <FormSection title="Home Systems">
        <FormFieldGrid cols={3}>
          <FormSelect
            name="heatingType"
            label="Heating Type"
            options={HEATING_TYPES}
          />
          <FormSelect
            name="electricalUpdate"
            label="Electrical Update"
            options={UPDATE_YEARS}
          />
          <FormSelect
            name="plumbingUpdate"
            label="Plumbing Update"
            options={UPDATE_YEARS}
          />
        </FormFieldGrid>
      </FormSection>

      {/* Safety */}
      <FormSection title="Safety Features" icon={Shield}>
        <FormFieldGrid cols={2}>
          <FormCheckbox
            name="hasSecuritySystem"
            label="Security System"
          />
          {hasSecuritySystem && (
            <FormCheckbox
              name="securityMonitored"
              label="Professionally Monitored"
            />
          )}
          <FormCheckbox name="hasFireAlarm" label="Fire/Smoke Alarm" />
          <FormCheckbox name="hasSprinklers" label="Sprinkler System" />
          <FormCheckbox name="hasDeadbolts" label="Deadbolt Locks" />
        </FormFieldGrid>
        <FormFieldGrid cols={2}>
          <FormInput
            name="distanceToFireStation"
            label="Distance to Fire Station (miles)"
            type="number"
          />
          <FormInput
            name="distanceToHydrant"
            label="Distance to Fire Hydrant (feet)"
            type="number"
          />
        </FormFieldGrid>
      </FormSection>

      {/* Liability Exposures */}
      <FormSection title="Liability Exposures">
        <FormFieldGrid cols={2}>
          <FormCheckbox name="hasPool" label="Swimming Pool" />
          {hasPool && (
            <>
              <FormInput name="poolType" label="Pool Type" />
              <FormCheckbox
                name="poolFenced"
                label="Pool is fenced"
              />
            </>
          )}
          <FormCheckbox name="hasTrampoline" label="Trampoline" />
          <FormCheckbox name="hasDog" label="Dog on Premises" />
          {hasDog && (
            <FormInput name="dogBreed" label="Dog Breed" />
          )}
        </FormFieldGrid>
      </FormSection>
    </div>
  );
}

export default PropertyDetailsFields;
