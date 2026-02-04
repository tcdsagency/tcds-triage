'use client';

/**
 * RentalStep
 * ==========
 * Renters-specific step for unit type and move-in date.
 */

import React from 'react';
import { FormSelect, FormDateInput, FormFieldGrid } from '../../fields';

const UNIT_TYPE_OPTIONS = [
  { value: 'apartment', label: 'Apartment' },
  { value: 'condo', label: 'Condo' },
  { value: 'townhouse', label: 'Townhouse' },
  { value: 'house', label: 'House' },
  { value: 'duplex', label: 'Duplex' },
];

export function RentalStep() {
  return (
    <FormFieldGrid cols={2}>
      <FormSelect
        name="unitType"
        label="Unit Type"
        options={UNIT_TYPE_OPTIONS}
      />
      <FormDateInput name="moveInDate" label="Move-In Date" />
    </FormFieldGrid>
  );
}

export default RentalStep;
