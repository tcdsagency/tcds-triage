'use client';

import React from 'react';
import { FormInput, FormSelect, FormFieldGrid } from '../../fields';
import { US_STATES } from '../../config/options';

const stateOptions = US_STATES.map((s) => ({ value: s, label: s }));

interface AddressFieldsProps {
  prefix?: string;
  disabled?: boolean;
}

export function AddressFields({ prefix, disabled }: AddressFieldsProps) {
  const fieldName = (field: string) => {
    if (!prefix) return field;
    return `${prefix}${field.charAt(0).toUpperCase()}${field.slice(1)}`;
  };

  return (
    <div className="space-y-4">
      <FormInput
        name={fieldName('address')}
        label="Street Address"
        required
        disabled={disabled}
        className="sm:col-span-full"
      />
      <FormFieldGrid cols={3}>
        <FormInput
          name={fieldName('city')}
          label="City"
          required
          disabled={disabled}
          className="sm:col-span-2"
        />
        <FormSelect
          name={fieldName('state')}
          label="State"
          options={stateOptions}
          required
          disabled={disabled}
          placeholder="Select state..."
        />
      </FormFieldGrid>
      <FormFieldGrid cols={3}>
        <FormInput
          name={fieldName('zip')}
          label="ZIP Code"
          required
          disabled={disabled}
        />
      </FormFieldGrid>
    </div>
  );
}

export default AddressFields;
