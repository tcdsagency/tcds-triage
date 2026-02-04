'use client';

import React from 'react';
import { useFormContext } from 'react-hook-form';
import { User, Phone, MapPin, Users } from 'lucide-react';
import {
  FormInput,
  FormSelect,
  FormDateInput,
  FormSection,
  FormFieldGrid,
} from '../../fields';
import {
  US_STATES,
  GENDER_OPTIONS,
  MARITAL_STATUS_OPTIONS,
} from '../../config/options';

const stateOptions = US_STATES.map((s) => ({ value: s, label: s }));

interface ContactFieldsProps {
  showLicense?: boolean;
  showSpouse?: boolean;
  showAddress?: boolean;
}

export function ContactFields({
  showLicense,
  showSpouse,
  showAddress,
}: ContactFieldsProps) {
  const { watch } = useFormContext();
  const maritalStatus = watch('maritalStatus');

  return (
    <div className="space-y-6">
      {/* Personal Info */}
      <FormSection title="Personal Information" icon={User}>
        <FormFieldGrid cols={2}>
          <FormInput name="firstName" label="First Name" required autoFocus />
          <FormInput name="lastName" label="Last Name" required />
        </FormFieldGrid>
        <FormFieldGrid cols={3}>
          <FormDateInput name="dob" label="Date of Birth" required />
          <FormSelect name="gender" label="Gender" options={GENDER_OPTIONS} />
          <FormSelect
            name="maritalStatus"
            label="Marital Status"
            options={MARITAL_STATUS_OPTIONS}
          />
        </FormFieldGrid>
        {showLicense && (
          <FormFieldGrid cols={2}>
            <FormInput name="licenseNumber" label="License Number" />
            <FormSelect
              name="licenseState"
              label="License State"
              options={stateOptions}
              placeholder="Select state..."
            />
          </FormFieldGrid>
        )}
      </FormSection>

      {/* Contact */}
      <FormSection title="Contact Information" icon={Phone}>
        <FormFieldGrid cols={2}>
          <FormInput name="phone" label="Phone" type="tel" required />
          <FormInput name="email" label="Email" type="email" />
        </FormFieldGrid>
      </FormSection>

      {/* Address */}
      {showAddress && (
        <FormSection title="Mailing Address" icon={MapPin}>
          <FormInput name="address" label="Street Address" required />
          <FormFieldGrid cols={3}>
            <FormInput name="city" label="City" required />
            <FormSelect
              name="state"
              label="State"
              options={stateOptions}
              required
              placeholder="Select state..."
            />
            <FormInput name="zip" label="ZIP Code" required />
          </FormFieldGrid>
        </FormSection>
      )}

      {/* Spouse */}
      {showSpouse && maritalStatus === 'married' && (
        <FormSection title="Spouse Information" icon={Users}>
          <FormFieldGrid cols={2}>
            <FormInput name="spouseFirstName" label="Spouse First Name" />
            <FormInput name="spouseLastName" label="Spouse Last Name" />
          </FormFieldGrid>
          <FormDateInput name="spouseDob" label="Spouse Date of Birth" />
          {showLicense && (
            <FormFieldGrid cols={2}>
              <FormInput
                name="spouseLicenseNumber"
                label="Spouse License Number"
              />
              <FormSelect
                name="spouseLicenseState"
                label="Spouse License State"
                options={stateOptions}
                placeholder="Select state..."
              />
            </FormFieldGrid>
          )}
        </FormSection>
      )}
    </div>
  );
}

export default ContactFields;
