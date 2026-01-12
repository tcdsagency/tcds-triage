'use client';

/**
 * Coverage Step Component
 * =======================
 * Select coverage options for auto insurance.
 * Organized by policy-level and vehicle-level coverages.
 */

import { useQuoteWizard } from '../QuoteWizardProvider';
import { cn } from '@/lib/utils';
import { Shield, Info, Car, AlertTriangle, Check, HelpCircle } from 'lucide-react';

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

const UMUIN_OPTIONS = [
  { value: 'reject', label: 'Reject Coverage' },
  { value: '30/60', label: '30/60 (State Minimum)', description: '$30k per person / $60k per accident' },
  { value: '50/100', label: '50/100', description: '$50k per person / $100k per accident' },
  { value: '100/300', label: '100/300 (Recommended)', description: '$100k per person / $300k per accident' },
  { value: '250/500', label: '250/500', description: '$250k per person / $500k per accident' },
];

const DEDUCTIBLE_OPTIONS = [
  { value: 'waive', label: 'Waive Coverage' },
  { value: '100', label: '$100' },
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
  const { formData, updateNestedField, updateVehicle, errors } = useQuoteWizard();
  const coverage = formData.coverage;

  const updateCoverage = (field: string, value: string | boolean) => {
    updateNestedField('coverage', field, value);
  };

  return (
    <div className="space-y-8">
      {/* Policy-Level Liability Coverage */}
      <section>
        <div className="flex items-center gap-2 mb-2">
          <Shield className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Liability Coverage
          </h3>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Applies to all vehicles on the policy
        </p>

        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-5 border border-blue-200 dark:border-blue-700 space-y-4">
          <CoverageSelect
            label="Bodily Injury Liability"
            value={coverage.bodilyInjury}
            onChange={(v) => updateCoverage('bodilyInjury', v)}
            options={LIABILITY_OPTIONS}
            tooltip="Pays for injuries you cause to others in an accident. Higher limits protect your assets if sued."
            error={errors['coverage.bodilyInjury']}
            required
          />

          <CoverageSelect
            label="Property Damage Liability"
            value={coverage.propertyDamage}
            onChange={(v) => updateCoverage('propertyDamage', v)}
            options={PROPERTY_DAMAGE_OPTIONS}
            tooltip="Pays for damage you cause to others' property (vehicles, buildings, fences, etc.)"
            error={errors['coverage.propertyDamage']}
            required
          />

          <div>
            <CoverageSelect
              label="Uninsured/Underinsured Motorist (UM/UIM)"
              value={coverage.umUim}
              onChange={(v) => updateCoverage('umUim', v)}
              options={UMUIN_OPTIONS}
              tooltip="Protects you and passengers if hit by an uninsured or underinsured driver"
            />
            {coverage.umUim === 'reject' && (
              <div className="mt-2 flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-700">
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-800 dark:text-amber-200">
                  <strong>Warning:</strong> 1 in 8 drivers is uninsured. Rejecting UM/UIM leaves you unprotected if hit by an uninsured driver.
                </p>
              </div>
            )}
          </div>

          <CoverageSelect
            label="Medical Payments (MedPay)"
            value={coverage.medPay}
            onChange={(v) => updateCoverage('medPay', v)}
            options={MEDPAY_OPTIONS}
            tooltip="Pays medical expenses for you and passengers regardless of fault"
          />
        </div>
      </section>

      {/* Vehicle-Level Coverage */}
      <section>
        <div className="flex items-center gap-2 mb-2">
          <Car className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Physical Damage Coverage
          </h3>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Select coverage for each vehicle
        </p>

        <div className="space-y-6">
          {formData.vehicles.map((vehicle, index) => (
            <VehicleCoverageCard
              key={vehicle.id}
              vehicle={vehicle}
              index={index}
              onUpdate={(field, value) => updateVehicle(vehicle.id, field, value)}
              errors={errors}
            />
          ))}
        </div>
      </section>

      {/* Additional Coverages */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Shield className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Additional Coverages
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <AdditionalCoverageCard
            label="Rental Car Reimbursement"
            checked={coverage.rental}
            onChange={(v) => updateCoverage('rental', v)}
            price="~$3/mo"
            description="Covers cost of a rental car while your vehicle is being repaired after a covered claim"
          />

          <AdditionalCoverageCard
            label="Roadside Assistance"
            checked={coverage.roadside}
            onChange={(v) => updateCoverage('roadside', v)}
            price="~$2/mo"
            description="24/7 help for towing, flat tires, dead battery, lockouts, and fuel delivery"
          />
        </div>
      </section>

      {/* Discounts Preview */}
      <section className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-5 border border-emerald-200 dark:border-emerald-500/30">
        <h3 className="text-sm font-semibold text-emerald-800 dark:text-emerald-300 mb-3 flex items-center gap-2">
          <Check className="w-4 h-4" />
          Available Discounts
        </h3>
        <div className="flex flex-wrap gap-2">
          <DiscountBadge label="Multi-Policy" active={formData.discounts.multiPolicy} />
          <DiscountBadge label="Multi-Car" active={formData.vehicles.length > 1} />
          <DiscountBadge label="Good Driver" active={formData.discounts.goodDriver} />
          <DiscountBadge label="Homeowner" active={formData.discounts.homeowner} />
          <DiscountBadge label="Paperless" active={formData.discounts.paperless} />
          <DiscountBadge label="Auto-Pay" active={formData.discounts.autoPay} />
        </div>
        <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-3">
          Discounts will be applied on the Review step
        </p>
      </section>
    </div>
  );
}

// =============================================================================
// VEHICLE COVERAGE CARD
// =============================================================================

interface VehicleCoverageCardProps {
  vehicle: {
    id: string;
    year: string;
    make: string;
    model: string;
    compDeductible?: string;
    collDeductible?: string;
  };
  index: number;
  onUpdate: (field: string, value: string) => void;
  errors: Record<string, string>;
}

function VehicleCoverageCard({ vehicle, index, onUpdate, errors }: VehicleCoverageCardProps) {
  const vehicleLabel = vehicle.year && vehicle.make && vehicle.model
    ? `${vehicle.year} ${vehicle.make} ${vehicle.model}`
    : `Vehicle ${index + 1}`;

  return (
    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-5 border border-gray-200 dark:border-gray-700">
      <div className="flex items-center gap-2 mb-4">
        <Car className="w-4 h-4 text-gray-500 dark:text-gray-400" />
        <span className="font-medium text-gray-900 dark:text-gray-100">
          {vehicleLabel}
        </span>
        <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-200 dark:bg-gray-700 px-2 py-0.5 rounded">
          Vehicle {index + 1}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <CoverageSelect
          label="Comprehensive Deductible"
          value={vehicle.compDeductible || '500'}
          onChange={(v) => onUpdate('compDeductible', v)}
          options={DEDUCTIBLE_OPTIONS}
          tooltip="Covers theft, vandalism, weather damage, fire, and animal strikes"
        />

        <CoverageSelect
          label="Collision Deductible"
          value={vehicle.collDeductible || '500'}
          onChange={(v) => onUpdate('collDeductible', v)}
          options={DEDUCTIBLE_OPTIONS}
          tooltip="Covers damage to your vehicle from accidents, regardless of fault"
        />
      </div>

      {(vehicle.compDeductible === 'waive' || vehicle.collDeductible === 'waive') && (
        <div className="mt-3 flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-700">
          <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-800 dark:text-amber-200">
            <strong>Note:</strong> Waiving coverage means damage to this vehicle won&apos;t be covered.
            Lienholders typically require full coverage.
          </p>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// ADDITIONAL COVERAGE CARD
// =============================================================================

interface AdditionalCoverageCardProps {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  price: string;
  description: string;
}

function AdditionalCoverageCard({ label, checked, onChange, price, description }: AdditionalCoverageCardProps) {
  return (
    <label
      className={cn(
        'flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all',
        checked
          ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-500 dark:border-emerald-500'
          : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 w-5 h-5 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
      />
      <div className="flex-1">
        <div className="flex items-center justify-between">
          <span className={cn(
            'font-medium',
            checked ? 'text-emerald-900 dark:text-emerald-100' : 'text-gray-900 dark:text-gray-100'
          )}>
            {label}
          </span>
          <span className={cn(
            'text-sm font-medium',
            checked ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-500 dark:text-gray-400'
          )}>
            {price}
          </span>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          {description}
        </p>
      </div>
    </label>
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
            <HelpCircle className="w-4 h-4 text-gray-400 cursor-help" />
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity w-64 text-center z-10 pointer-events-none">
              {tooltip}
              <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-900" />
            </div>
          </div>
        )}
      </div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          'w-full px-3 py-2 rounded-lg border transition-colors',
          'text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800',
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

function DiscountBadge({ label, active }: { label: string; active: boolean }) {
  return (
    <span
      className={cn(
        'px-2.5 py-1 text-xs font-medium rounded-full flex items-center gap-1',
        active
          ? 'bg-emerald-200 dark:bg-emerald-800 text-emerald-800 dark:text-emerald-200'
          : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
      )}
    >
      {active && <Check className="w-3 h-3" />}
      {label}
    </span>
  );
}

export default CoverageStep;
