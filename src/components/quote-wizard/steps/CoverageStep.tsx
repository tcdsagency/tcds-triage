'use client';

/**
 * Coverage Step Component
 * =======================
 * Select coverage options for auto insurance.
 */

import { useQuoteWizard } from '../QuoteWizardProvider';
import { cn } from '@/lib/utils';
import { Shield, Info } from 'lucide-react';

const LIABILITY_OPTIONS = [
  { value: '30/60', label: '30/60 (State Minimum)', description: '$30k per person / $60k per accident' },
  { value: '50/100', label: '50/100', description: '$50k per person / $100k per accident' },
  { value: '100/300', label: '100/300 (Recommended)', description: '$100k per person / $300k per accident' },
  { value: '250/500', label: '250/500', description: '$250k per person / $500k per accident' },
  { value: '500/500', label: '500/500', description: '$500k per person / $500k per accident' },
];

const PROPERTY_DAMAGE_OPTIONS = [
  { value: '25000', label: '$25,000 (State Minimum)' },
  { value: '50000', label: '$50,000' },
  { value: '100000', label: '$100,000 (Recommended)' },
  { value: '250000', label: '$250,000' },
  { value: '500000', label: '$500,000' },
];

const DEDUCTIBLE_OPTIONS = [
  { value: '250', label: '$250' },
  { value: '500', label: '$500 (Recommended)' },
  { value: '1000', label: '$1,000' },
  { value: '2500', label: '$2,500' },
];

const MEDPAY_OPTIONS = [
  { value: '0', label: 'None' },
  { value: '1000', label: '$1,000' },
  { value: '5000', label: '$5,000 (Recommended)' },
  { value: '10000', label: '$10,000' },
  { value: '25000', label: '$25,000' },
];

export function CoverageStep() {
  const { formData, updateNestedField, errors } = useQuoteWizard();
  const coverage = formData.coverage;

  const updateCoverage = (field: string, value: string | boolean) => {
    updateNestedField('coverage', field, value);
  };

  return (
    <div className="space-y-8">
      {/* Liability Coverage */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Shield className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
            Liability Coverage
          </h3>
        </div>

        <div className="space-y-4">
          <CoverageSelect
            label="Bodily Injury Liability"
            value={coverage.bodilyInjury}
            onChange={(v) => updateCoverage('bodilyInjury', v)}
            options={LIABILITY_OPTIONS}
            tooltip="Pays for injuries you cause to others in an accident"
            error={errors['coverage.bodilyInjury']}
            required
          />

          <CoverageSelect
            label="Property Damage Liability"
            value={coverage.propertyDamage}
            onChange={(v) => updateCoverage('propertyDamage', v)}
            options={PROPERTY_DAMAGE_OPTIONS}
            tooltip="Pays for damage you cause to others' property"
            error={errors['coverage.propertyDamage']}
            required
          />

          <CoverageSelect
            label="Uninsured/Underinsured Motorist (UM/UIM)"
            value={coverage.umUim}
            onChange={(v) => updateCoverage('umUim', v)}
            options={LIABILITY_OPTIONS}
            tooltip="Protects you if hit by an uninsured or underinsured driver"
          />
        </div>
      </section>

      {/* Physical Damage */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Shield className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
            Physical Damage Coverage
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <CoverageSelect
            label="Comprehensive Deductible"
            value={coverage.comprehensive}
            onChange={(v) => updateCoverage('comprehensive', v)}
            options={DEDUCTIBLE_OPTIONS}
            tooltip="Covers theft, vandalism, weather damage, and more"
          />

          <CoverageSelect
            label="Collision Deductible"
            value={coverage.collision}
            onChange={(v) => updateCoverage('collision', v)}
            options={DEDUCTIBLE_OPTIONS}
            tooltip="Covers damage from accidents regardless of fault"
          />
        </div>
      </section>

      {/* Medical & Additional */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Shield className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
            Medical & Additional Coverage
          </h3>
        </div>

        <div className="space-y-4">
          <CoverageSelect
            label="Medical Payments"
            value={coverage.medPay}
            onChange={(v) => updateCoverage('medPay', v)}
            options={MEDPAY_OPTIONS}
            tooltip="Pays for medical expenses for you and passengers"
          />

          <div className="flex flex-wrap gap-6">
            <CoverageToggle
              label="Rental Car Reimbursement"
              checked={coverage.rental}
              onChange={(v) => updateCoverage('rental', v)}
              description="Pays for a rental while your car is being repaired"
            />

            <CoverageToggle
              label="Roadside Assistance"
              checked={coverage.roadside}
              onChange={(v) => updateCoverage('roadside', v)}
              description="Covers towing, flat tires, lockouts, and more"
            />
          </div>
        </div>
      </section>

      {/* Discounts Preview */}
      <section className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-4 border border-emerald-200 dark:border-emerald-500/30">
        <h3 className="text-sm font-medium text-emerald-800 dark:text-emerald-300 mb-3">
          Available Discounts
        </h3>
        <div className="flex flex-wrap gap-2">
          <DiscountBadge label="Multi-Policy" active={formData.discounts.multiPolicy} />
          <DiscountBadge label="Good Driver" active={formData.discounts.goodDriver} />
          <DiscountBadge label="Homeowner" active={formData.discounts.homeowner} />
          <DiscountBadge label="Paperless" active={formData.discounts.paperless} />
          <DiscountBadge label="Auto-Pay" active={formData.discounts.autoPay} />
        </div>
        <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-2">
          Discounts will be applied on the Review step
        </p>
      </section>
    </div>
  );
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

interface CoverageSelectProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string; description?: string }[];
  tooltip?: string;
  error?: string;
  required?: boolean;
}

function CoverageSelect({
  label,
  value,
  onChange,
  options,
  tooltip,
  error,
  required,
}: CoverageSelectProps) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
        {tooltip && (
          <div className="group relative">
            <Info className="w-4 h-4 text-gray-400 cursor-help" />
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
              {tooltip}
            </div>
          </div>
        )}
      </div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          'w-full px-3 py-2 rounded-lg border transition-colors',
          'text-gray-900 bg-white',
          error
            ? 'border-red-300 dark:border-red-500'
            : 'border-gray-300 dark:border-gray-600',
          'focus:outline-none focus:ring-2 focus:ring-emerald-500'
        )}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && (
        <p className="mt-1 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
}

interface CoverageToggleProps {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  description?: string;
}

function CoverageToggle({ label, checked, onChange, description }: CoverageToggleProps) {
  return (
    <label className="flex items-start gap-3 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
      />
      <div>
        <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{label}</span>
        {description && (
          <p className="text-xs text-gray-500 dark:text-gray-400">{description}</p>
        )}
      </div>
    </label>
  );
}

function DiscountBadge({ label, active }: { label: string; active: boolean }) {
  return (
    <span
      className={cn(
        'px-2 py-1 text-xs font-medium rounded-full',
        active
          ? 'bg-emerald-200 dark:bg-emerald-800 text-emerald-800 dark:text-emerald-200'
          : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
      )}
    >
      {label}
    </span>
  );
}

export default CoverageStep;
