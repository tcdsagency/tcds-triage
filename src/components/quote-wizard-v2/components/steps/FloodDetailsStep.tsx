'use client';

/**
 * FloodDetailsStep
 * ================
 * Flood-specific details: foundation type, elevation certificate, and
 * conditional elevation fields (BFE / lowest floor).
 */

import React from 'react';
import { useFormContext } from 'react-hook-form';
import {
  FormSelect,
  FormCheckbox,
  FormInput,
  FormSection,
  FormFieldGrid,
} from '../../fields';
import { FOUNDATION_TYPES } from '../../config/options';

export function FloodDetailsStep() {
  const { watch } = useFormContext();
  const hasElevationCert = watch('elevationCertificate');

  return (
    <div className="space-y-6">
      {/* Foundation */}
      <FormSection title="Foundation">
        <FormFieldGrid cols={2}>
          <FormSelect
            name="foundationType"
            label="Foundation Type"
            options={FOUNDATION_TYPES}
          />
        </FormFieldGrid>
      </FormSection>

      {/* Elevation Information */}
      <FormSection title="Elevation Information">
        <FormCheckbox
          name="elevationCertificate"
          label="Do you have an elevation certificate?"
        />
        {hasElevationCert && (
          <FormFieldGrid cols={2}>
            <FormInput
              name="baseFloodElevation"
              label="Base Flood Elevation (BFE)"
              type="number"
            />
            <FormInput
              name="lowestFloorElevation"
              label="Lowest Floor Elevation"
              type="number"
            />
          </FormFieldGrid>
        )}
      </FormSection>
    </div>
  );
}

export default FloodDetailsStep;
