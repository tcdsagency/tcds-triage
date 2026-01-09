'use client';

/**
 * Review Step Component
 * =====================
 * Final review and submission step for quotes.
 */

import { useQuoteWizard } from '../QuoteWizardProvider';
import { cn } from '@/lib/utils';
import {
  User,
  Car,
  Users,
  Shield,
  Calendar,
  CheckCircle,
  AlertTriangle,
  XCircle,
  ChevronRight,
} from 'lucide-react';

export function ReviewStep() {
  const { formData, updateField, updateNestedField, eligibility, goToStep } = useQuoteWizard();

  // Format coverage label
  const formatCoverage = (key: string, value: string | boolean): string => {
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (key.includes('Injury') || key.includes('Uim')) return value;
    if (!isNaN(Number(value))) return `$${Number(value).toLocaleString()}`;
    return value;
  };

  return (
    <div className="space-y-8">
      {/* Eligibility Status */}
      {eligibility && (
        <div
          className={cn(
            'p-4 rounded-xl border',
            eligibility.status === 'ELIGIBLE' && 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-500/30',
            eligibility.status === 'REVIEW' && 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-500/30',
            eligibility.status === 'DECLINE' && 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-500/30'
          )}
        >
          <div className="flex items-center gap-3">
            {eligibility.status === 'ELIGIBLE' && (
              <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            )}
            {eligibility.status === 'REVIEW' && (
              <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            )}
            {eligibility.status === 'DECLINE' && (
              <XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
            )}
            <div>
              <p className={cn(
                'font-medium',
                eligibility.status === 'ELIGIBLE' && 'text-emerald-800 dark:text-emerald-300',
                eligibility.status === 'REVIEW' && 'text-amber-800 dark:text-amber-300',
                eligibility.status === 'DECLINE' && 'text-red-800 dark:text-red-300'
              )}>
                {eligibility.status === 'ELIGIBLE' && 'Eligible for Submission'}
                {eligibility.status === 'REVIEW' && 'Review Required'}
                {eligibility.status === 'DECLINE' && 'Cannot Submit - Issues Found'}
              </p>
              {eligibility.alerts && eligibility.alerts.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {eligibility.alerts.slice(0, 3).map((alert, i) => (
                    <li key={i} className="text-sm text-gray-600 dark:text-gray-400">
                      • {alert.message}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid gap-4">
        {/* Contact Summary */}
        <SummaryCard
          icon={User}
          title="Contact Information"
          onEdit={() => goToStep(0)}
        >
          <div className="grid grid-cols-2 gap-x-6 gap-y-2">
            <SummaryRow label="Name" value={`${formData.firstName} ${formData.lastName}`} />
            <SummaryRow label="Phone" value={formData.phone} />
            <SummaryRow label="Email" value={formData.email || 'Not provided'} />
            <SummaryRow label="DOB" value={formData.dob} />
            <SummaryRow
              label="Address"
              value={`${formData.address}, ${formData.city}, ${formData.state} ${formData.zip}`}
              className="col-span-2"
            />
          </div>
        </SummaryCard>

        {/* Vehicles Summary */}
        <SummaryCard
          icon={Car}
          title={`Vehicles (${formData.vehicles.length})`}
          onEdit={() => goToStep(1)}
        >
          <div className="space-y-2">
            {formData.vehicles.map((v, i) => (
              <div key={v.id} className="flex items-center justify-between py-1">
                <span className="text-gray-900 dark:text-gray-100">
                  {v.year} {v.make} {v.model}
                </span>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {v.primaryUse === 'commute' && 'Commute'}
                  {v.primaryUse === 'pleasure' && 'Pleasure'}
                  {v.primaryUse === 'business' && 'Business'}
                </span>
              </div>
            ))}
          </div>
        </SummaryCard>

        {/* Drivers Summary */}
        <SummaryCard
          icon={Users}
          title={`Drivers (${formData.drivers.length})`}
          onEdit={() => goToStep(2)}
        >
          <div className="space-y-2">
            {formData.drivers.map((d) => (
              <div key={d.id} className="flex items-center justify-between py-1">
                <span className="text-gray-900 dark:text-gray-100">
                  {d.firstName} {d.lastName}
                </span>
                <span className="text-sm text-gray-500 dark:text-gray-400 capitalize">
                  {d.relationship}
                </span>
              </div>
            ))}
          </div>
        </SummaryCard>

        {/* Coverage Summary */}
        <SummaryCard
          icon={Shield}
          title="Coverage Options"
          onEdit={() => goToStep(3)}
        >
          <div className="grid grid-cols-2 gap-x-6 gap-y-2">
            <SummaryRow label="Bodily Injury" value={formData.coverage.bodilyInjury} />
            <SummaryRow label="Property Damage" value={`$${Number(formData.coverage.propertyDamage).toLocaleString()}`} />
            <SummaryRow label="UM/UIM" value={formData.coverage.umUim} />
            <SummaryRow label="Med Pay" value={`$${Number(formData.coverage.medPay).toLocaleString()}`} />
            <SummaryRow label="Comprehensive" value={`$${formData.coverage.comprehensive} deductible`} />
            <SummaryRow label="Collision" value={`$${formData.coverage.collision} deductible`} />
          </div>
        </SummaryCard>
      </div>

      {/* Current Insurance */}
      <section>
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
          Current Insurance
        </h3>
        <div className="space-y-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.hasCurrentInsurance}
              onChange={(e) => updateField('hasCurrentInsurance', e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              Currently insured
            </span>
          </label>

          {formData.hasCurrentInsurance && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 ml-7">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Current Carrier
                </label>
                <input
                  type="text"
                  value={formData.currentCarrier}
                  onChange={(e) => updateField('currentCarrier', e.target.value)}
                  placeholder="Company name"
                  className={cn(
                    'w-full px-3 py-2 rounded-lg border transition-colors',
                    'text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900',
                    'border-gray-300 dark:border-gray-600',
                    'focus:outline-none focus:ring-2 focus:ring-emerald-500'
                  )}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Current Premium
                </label>
                <input
                  type="text"
                  value={formData.currentPremium}
                  onChange={(e) => updateField('currentPremium', e.target.value)}
                  placeholder="$0.00"
                  className={cn(
                    'w-full px-3 py-2 rounded-lg border transition-colors',
                    'text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900',
                    'border-gray-300 dark:border-gray-600',
                    'focus:outline-none focus:ring-2 focus:ring-emerald-500'
                  )}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Years with Carrier
                </label>
                <input
                  type="text"
                  value={formData.yearsWithCarrier}
                  onChange={(e) => updateField('yearsWithCarrier', e.target.value)}
                  placeholder="0"
                  className={cn(
                    'w-full px-3 py-2 rounded-lg border transition-colors',
                    'text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900',
                    'border-gray-300 dark:border-gray-600',
                    'focus:outline-none focus:ring-2 focus:ring-emerald-500'
                  )}
                />
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Discounts */}
      <section>
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
          Available Discounts
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <DiscountCheckbox
            label="Multi-Policy"
            checked={formData.discounts.multiPolicy}
            onChange={(v) => updateNestedField('discounts', 'multiPolicy', v)}
          />
          <DiscountCheckbox
            label="Homeowner"
            checked={formData.discounts.homeowner}
            onChange={(v) => updateNestedField('discounts', 'homeowner', v)}
          />
          <DiscountCheckbox
            label="Good Driver"
            checked={formData.discounts.goodDriver}
            onChange={(v) => updateNestedField('discounts', 'goodDriver', v)}
          />
          <DiscountCheckbox
            label="Good Student"
            checked={formData.discounts.goodStudent}
            onChange={(v) => updateNestedField('discounts', 'goodStudent', v)}
          />
          <DiscountCheckbox
            label="Defensive Driver"
            checked={formData.discounts.defensive}
            onChange={(v) => updateNestedField('discounts', 'defensive', v)}
          />
          <DiscountCheckbox
            label="Low Mileage"
            checked={formData.discounts.lowMileage}
            onChange={(v) => updateNestedField('discounts', 'lowMileage', v)}
          />
          <DiscountCheckbox
            label="Paperless"
            checked={formData.discounts.paperless}
            onChange={(v) => updateNestedField('discounts', 'paperless', v)}
          />
          <DiscountCheckbox
            label="Auto-Pay"
            checked={formData.discounts.autoPay}
            onChange={(v) => updateNestedField('discounts', 'autoPay', v)}
          />
        </div>
      </section>

      {/* Effective Date & Notes */}
      <section>
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
          Submission Details
        </h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Requested Effective Date <span className="text-red-500">*</span>
            </label>
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-gray-400" />
              <input
                type="date"
                value={formData.effectiveDate}
                onChange={(e) => updateField('effectiveDate', e.target.value)}
                className={cn(
                  'px-3 py-2 rounded-lg border transition-colors',
                  'text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900',
                  'border-gray-300 dark:border-gray-600',
                  'focus:outline-none focus:ring-2 focus:ring-emerald-500'
                )}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Agent Notes
            </label>
            <textarea
              value={formData.agentNotes}
              onChange={(e) => updateField('agentNotes', e.target.value)}
              rows={4}
              placeholder="Add any additional notes for this quote..."
              className={cn(
                'w-full px-3 py-2 rounded-lg border transition-colors',
                'text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900',
                'border-gray-300 dark:border-gray-600',
                'focus:outline-none focus:ring-2 focus:ring-emerald-500'
              )}
            />
          </div>
        </div>
      </section>
    </div>
  );
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

interface SummaryCardProps {
  icon: any;
  title: string;
  onEdit: () => void;
  children: React.ReactNode;
}

function SummaryCard({ icon: Icon, title, onEdit, children }: SummaryCardProps) {
  return (
    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Icon className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          <h4 className="font-medium text-gray-900 dark:text-gray-100">{title}</h4>
        </div>
        <button
          onClick={onEdit}
          className="flex items-center gap-1 text-sm text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors"
        >
          Edit
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
      {children}
    </div>
  );
}

function SummaryRow({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <span className="text-sm text-gray-500 dark:text-gray-400">{label}: </span>
      <span className="text-sm text-gray-900 dark:text-gray-100">{value}</span>
    </div>
  );
}

function DiscountCheckbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
      />
      <span className="text-sm text-gray-700 dark:text-gray-300">{label}</span>
    </label>
  );
}

export default ReviewStep;
