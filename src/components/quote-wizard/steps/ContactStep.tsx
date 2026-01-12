'use client';

/**
 * Contact Step Component
 * ======================
 * Collects primary insured contact information.
 */

import { useQuoteWizard } from '../QuoteWizardProvider';
import { cn } from '@/lib/utils';

const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
];

export function ContactStep() {
  const { formData, updateField, errors } = useQuoteWizard();

  return (
    <div className="space-y-8">
      {/* Personal Information */}
      <section>
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
          Personal Information
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField
            label="First Name"
            value={formData.firstName}
            onChange={(v) => updateField('firstName', v)}
            error={errors.firstName}
            required
            autoFocus
          />
          <FormField
            label="Last Name"
            value={formData.lastName}
            onChange={(v) => updateField('lastName', v)}
            error={errors.lastName}
            required
          />
          <FormField
            label="Date of Birth"
            type="date"
            value={formData.dob}
            onChange={(v) => updateField('dob', v)}
            error={errors.dob}
            required
          />
          <FormField
            label="Gender"
            type="select"
            value={formData.gender}
            onChange={(v) => updateField('gender', v)}
            options={[
              { value: '', label: 'Select...' },
              { value: 'male', label: 'Male' },
              { value: 'female', label: 'Female' },
              { value: 'other', label: 'Other' },
            ]}
          />
          <FormField
            label="Marital Status"
            type="select"
            value={formData.maritalStatus}
            onChange={(v) => updateField('maritalStatus', v)}
            options={[
              { value: '', label: 'Select...' },
              { value: 'single', label: 'Single' },
              { value: 'married', label: 'Married' },
              { value: 'divorced', label: 'Divorced' },
              { value: 'widowed', label: 'Widowed' },
              { value: 'separated', label: 'Separated' },
            ]}
          />
        </div>
      </section>

      {/* Contact Information */}
      <section>
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
          Contact Information
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField
            label="Phone Number"
            type="tel"
            value={formData.phone}
            onChange={(v) => updateField('phone', v)}
            error={errors.phone}
            required
            placeholder="(555) 123-4567"
          />
          <FormField
            label="Email Address"
            type="email"
            value={formData.email}
            onChange={(v) => updateField('email', v)}
            error={errors.email}
            placeholder="email@example.com"
          />
        </div>
      </section>

      {/* Address */}
      <section>
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
          Mailing Address
        </h3>
        <div className="space-y-4">
          <FormField
            label="Street Address"
            value={formData.address}
            onChange={(v) => updateField('address', v)}
            error={errors.address}
            required
            placeholder="123 Main St"
          />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="col-span-2">
              <FormField
                label="City"
                value={formData.city}
                onChange={(v) => updateField('city', v)}
                error={errors.city}
                required
              />
            </div>
            <FormField
              label="State"
              type="select"
              value={formData.state}
              onChange={(v) => updateField('state', v)}
              error={errors.state}
              required
              options={[
                { value: '', label: 'State' },
                ...US_STATES.map((s) => ({ value: s, label: s })),
              ]}
            />
            <FormField
              label="ZIP Code"
              value={formData.zip}
              onChange={(v) => updateField('zip', v)}
              error={errors.zip}
              required
              placeholder="12345"
            />
          </div>
        </div>
      </section>

      {/* Spouse (conditional) */}
      {formData.maritalStatus === 'married' && (
        <section>
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
            Spouse Information
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <FormField
              label="Spouse First Name"
              value={formData.spouseFirstName}
              onChange={(v) => updateField('spouseFirstName', v)}
            />
            <FormField
              label="Spouse Last Name"
              value={formData.spouseLastName}
              onChange={(v) => updateField('spouseLastName', v)}
            />
            <FormField
              label="Spouse Date of Birth"
              type="date"
              value={formData.spouseDob}
              onChange={(v) => updateField('spouseDob', v)}
            />
          </div>
        </section>
      )}
    </div>
  );
}

// =============================================================================
// FORM FIELD COMPONENT
// =============================================================================

interface FormFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  type?: 'text' | 'email' | 'tel' | 'date' | 'select' | 'number';
  required?: boolean;
  placeholder?: string;
  autoFocus?: boolean;
  options?: { value: string; label: string }[];
}

function FormField({
  label,
  value,
  onChange,
  error,
  type = 'text',
  required,
  placeholder,
  autoFocus,
  options,
}: FormFieldProps) {
  const inputClasses = cn(
    'w-full px-3 py-2 rounded-lg border transition-colors',
    'text-gray-900 bg-white',
    'focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500',
    error
      ? 'border-red-300 dark:border-red-500'
      : 'border-gray-300 dark:border-gray-600'
  );

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {type === 'select' ? (
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={inputClasses}
        >
          {options?.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      ) : (
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoFocus={autoFocus}
          className={inputClasses}
        />
      )}
      {error && (
        <p className="mt-1 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
}

export default ContactStep;
