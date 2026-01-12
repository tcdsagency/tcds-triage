'use client';

/**
 * Home Coverage Step Component
 * ============================
 * Select coverage options for homeowners/renters/mobile home quotes.
 */

import { useQuoteWizard } from '../QuoteWizardProvider';
import { cn } from '@/lib/utils';
import { Shield, Home, Info } from 'lucide-react';

const DWELLING_OPTIONS = [
  { value: '150000', label: '$150,000' },
  { value: '200000', label: '$200,000' },
  { value: '250000', label: '$250,000' },
  { value: '300000', label: '$300,000' },
  { value: '350000', label: '$350,000' },
  { value: '400000', label: '$400,000' },
  { value: '500000', label: '$500,000' },
  { value: '750000', label: '$750,000' },
  { value: '1000000', label: '$1,000,000' },
];

const PERSONAL_PROPERTY_OPTIONS = [
  { value: '25000', label: '$25,000' },
  { value: '50000', label: '$50,000' },
  { value: '75000', label: '$75,000' },
  { value: '100000', label: '$100,000' },
  { value: '150000', label: '$150,000' },
  { value: '200000', label: '$200,000' },
];

const LIABILITY_OPTIONS = [
  { value: '100000', label: '$100,000' },
  { value: '300000', label: '$300,000 (Recommended)' },
  { value: '500000', label: '$500,000' },
  { value: '1000000', label: '$1,000,000' },
];

const MEDPAY_OPTIONS = [
  { value: '1000', label: '$1,000' },
  { value: '2500', label: '$2,500' },
  { value: '5000', label: '$5,000 (Recommended)' },
  { value: '10000', label: '$10,000' },
];

const DEDUCTIBLE_OPTIONS = [
  { value: '500', label: '$500' },
  { value: '1000', label: '$1,000 (Recommended)' },
  { value: '2500', label: '$2,500' },
  { value: '5000', label: '$5,000' },
];

const HURRICANE_DEDUCTIBLE_OPTIONS = [
  { value: '1%', label: '1% of Dwelling' },
  { value: '2%', label: '2% of Dwelling (Common)' },
  { value: '5%', label: '5% of Dwelling' },
  { value: '$5000', label: '$5,000 flat' },
];

export function HomeCoverageStep() {
  const { formData, updateNestedField, quoteType } = useQuoteWizard();
  const coverage = formData.coverage;
  const isRenters = quoteType === 'renters';

  const updateCoverage = (field: string, value: string | boolean) => {
    updateNestedField('coverage', field, value);
  };

  return (
    <div className="space-y-8">
      {/* Dwelling Coverage (not for renters) */}
      {!isRenters && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Home className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
              Dwelling Coverage
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <CoverageSelect
              label="Dwelling (Coverage A)"
              value={coverage.dwelling}
              onChange={(v) => updateCoverage('dwelling', v)}
              options={DWELLING_OPTIONS}
              tooltip="Covers the structure of your home"
              required
            />

            <CoverageSelect
              label="Other Structures (Coverage B)"
              value={coverage.otherStructures}
              onChange={(v) => updateCoverage('otherStructures', v)}
              options={[
                { value: '10%', label: '10% of Dwelling (Standard)' },
                { value: '20%', label: '20% of Dwelling' },
                { value: '50000', label: '$50,000' },
              ]}
              tooltip="Covers detached garages, sheds, fences"
            />
          </div>
        </section>
      )}

      {/* Personal Property */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Shield className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
            Personal Property & Liability
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <CoverageSelect
            label={isRenters ? "Personal Property" : "Personal Property (Coverage C)"}
            value={coverage.personalProperty}
            onChange={(v) => updateCoverage('personalProperty', v)}
            options={PERSONAL_PROPERTY_OPTIONS}
            tooltip="Covers your belongings (furniture, electronics, clothing)"
            required={isRenters}
          />

          <CoverageSelect
            label="Liability (Coverage E)"
            value={coverage.liability}
            onChange={(v) => updateCoverage('liability', v)}
            options={LIABILITY_OPTIONS}
            tooltip="Protects you if someone is injured on your property"
            required
          />

          <CoverageSelect
            label="Medical Payments (Coverage F)"
            value={coverage.medicalPayments}
            onChange={(v) => updateCoverage('medicalPayments', v)}
            options={MEDPAY_OPTIONS}
            tooltip="Pays medical bills for guests injured on your property"
          />
        </div>
      </section>

      {/* Deductibles */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Shield className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
            Deductibles
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <CoverageSelect
            label="All Other Perils Deductible"
            value={coverage.deductible}
            onChange={(v) => updateCoverage('deductible', v)}
            options={DEDUCTIBLE_OPTIONS}
            tooltip="Your out-of-pocket cost before insurance pays"
          />

          {!isRenters && formData.propertyState && ['FL', 'TX', 'LA', 'NC', 'SC', 'GA', 'AL', 'MS'].includes(formData.propertyState) && (
            <CoverageSelect
              label="Hurricane/Wind Deductible"
              value={coverage.hurricaneDeductible}
              onChange={(v) => updateCoverage('hurricaneDeductible', v)}
              options={HURRICANE_DEDUCTIBLE_OPTIONS}
              tooltip="Separate deductible for hurricane/wind damage"
            />
          )}
        </div>
      </section>

      {/* Optional Coverages */}
      <section>
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
          Optional Coverages
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <CoverageToggle
            label="Water Backup"
            checked={coverage.waterBackup}
            onChange={(v) => updateCoverage('waterBackup', v)}
            description="Covers damage from sewer/drain backup"
          />

          <CoverageToggle
            label="Identity Theft"
            checked={coverage.identityTheft}
            onChange={(v) => updateCoverage('identityTheft', v)}
            description="Helps recover from identity theft"
          />

          <CoverageToggle
            label="Equipment Breakdown"
            checked={coverage.equipmentBreakdown}
            onChange={(v) => updateCoverage('equipmentBreakdown', v)}
            description="Covers HVAC, appliance failures"
          />
        </div>
      </section>

      {/* Premium Estimate */}
      <section className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-4 border border-emerald-200 dark:border-emerald-500/30">
        <h3 className="text-sm font-medium text-emerald-800 dark:text-emerald-300 mb-2">
          Coverage Summary
        </h3>
        <div className="grid grid-cols-2 gap-2 text-sm">
          {!isRenters && coverage.dwelling && (
            <div className="text-emerald-700 dark:text-emerald-400">
              Dwelling: ${Number(coverage.dwelling).toLocaleString()}
            </div>
          )}
          {coverage.personalProperty && (
            <div className="text-emerald-700 dark:text-emerald-400">
              Personal Property: ${Number(coverage.personalProperty).toLocaleString()}
            </div>
          )}
          {coverage.liability && (
            <div className="text-emerald-700 dark:text-emerald-400">
              Liability: ${Number(coverage.liability).toLocaleString()}
            </div>
          )}
          {coverage.deductible && (
            <div className="text-emerald-700 dark:text-emerald-400">
              Deductible: ${Number(coverage.deductible).toLocaleString()}
            </div>
          )}
        </div>
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
  options: { value: string; label: string }[];
  tooltip?: string;
  required?: boolean;
}

function CoverageSelect({
  label,
  value,
  onChange,
  options,
  tooltip,
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
          'border-gray-300 dark:border-gray-600',
          'focus:outline-none focus:ring-2 focus:ring-emerald-500'
        )}
      >
        <option value="">Select</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
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
    <label className="flex items-start gap-3 cursor-pointer p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-emerald-300 dark:hover:border-emerald-600 transition-colors">
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

export default HomeCoverageStep;
