'use client';

/**
 * Review Step Component
 * =====================
 * Final review and submission step for quotes.
 * Features collapsible sections and clear coverage breakdown.
 */

import { useState } from 'react';
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
  ChevronDown,
  Check,
  Info,
  FileText,
} from 'lucide-react';
import { CanopyConnectSMS } from '@/components/CanopyConnectSMS';

export function ReviewStep() {
  const { formData, updateField, updateNestedField, eligibility, goToStep } = useQuoteWizard();

  // Collapsible section states
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    contact: false,
    vehicles: false,
    drivers: false,
    coverage: true, // Coverage always expanded by default
  });

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  return (
    <div className="space-y-6">
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

      {/* Collapsible Summary Cards */}
      <div className="space-y-3">
        {/* Contact Summary */}
        <CollapsibleCard
          icon={User}
          title="Contact Information"
          expanded={expandedSections.contact}
          onToggle={() => toggleSection('contact')}
          onEdit={() => goToStep(0)}
          summary={`${formData.firstName} ${formData.lastName} • ${formData.phone}`}
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
        </CollapsibleCard>

        {/* Vehicles Summary */}
        <CollapsibleCard
          icon={Car}
          title={`Vehicles (${formData.vehicles.length})`}
          expanded={expandedSections.vehicles}
          onToggle={() => toggleSection('vehicles')}
          onEdit={() => goToStep(1)}
          summary={formData.vehicles.map(v => `${v.year} ${v.make} ${v.model}`).join(', ')}
        >
          <div className="space-y-2">
            {formData.vehicles.map((v, i) => (
              <div key={v.id} className="flex items-center justify-between py-1.5 border-b border-gray-100 dark:border-gray-700 last:border-0">
                <div>
                  <span className="text-gray-900 dark:text-gray-100 font-medium">
                    {v.year} {v.make} {v.model}
                  </span>
                  {v.vin && (
                    <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                      VIN: {v.vin}
                    </span>
                  )}
                </div>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {v.primaryUse === 'commute' && 'Commute'}
                  {v.primaryUse === 'pleasure' && 'Pleasure'}
                  {v.primaryUse === 'business' && 'Business'}
                </span>
              </div>
            ))}
          </div>
        </CollapsibleCard>

        {/* Drivers Summary */}
        <CollapsibleCard
          icon={Users}
          title={`Drivers (${formData.drivers.length})`}
          expanded={expandedSections.drivers}
          onToggle={() => toggleSection('drivers')}
          onEdit={() => goToStep(2)}
          summary={formData.drivers.map(d => `${d.firstName} ${d.lastName}`).join(', ')}
        >
          <div className="space-y-2">
            {formData.drivers.map((d) => (
              <div key={d.id} className="flex items-center justify-between py-1.5 border-b border-gray-100 dark:border-gray-700 last:border-0">
                <div>
                  <span className="text-gray-900 dark:text-gray-100 font-medium">
                    {d.firstName} {d.lastName}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400 ml-2 capitalize">
                    ({d.relationship})
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {d.hasAccidents && (
                    <span className="text-xs px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded">
                      Accidents
                    </span>
                  )}
                  {d.hasViolations && (
                    <span className="text-xs px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded">
                      Violations
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CollapsibleCard>

        {/* Coverage Summary - Always Expanded */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border-2 border-emerald-200 dark:border-emerald-700 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 bg-emerald-50 dark:bg-emerald-900/20 border-b border-emerald-200 dark:border-emerald-700">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              <h4 className="font-semibold text-gray-900 dark:text-gray-100">Coverage Summary</h4>
            </div>
            <button
              onClick={() => goToStep(3)}
              className="flex items-center gap-1 text-sm text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors"
            >
              Edit
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="p-4 space-y-6">
            {/* Policy-Level Coverage */}
            <div>
              <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                <Shield className="w-4 h-4" />
                Liability Coverage (All Vehicles)
              </h5>
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 pl-6">
                <SummaryRow label="Bodily Injury" value={formData.coverage.bodilyInjury} />
                <SummaryRow label="Property Damage" value={`$${Number(formData.coverage.propertyDamage).toLocaleString()}`} />
                <SummaryRow label="UM/UIM" value={formData.coverage.umUim === 'reject' ? 'Rejected' : formData.coverage.umUim} />
                <SummaryRow label="Med Pay" value={Number(formData.coverage.medPay) === 0 ? 'None' : `$${Number(formData.coverage.medPay).toLocaleString()}`} />
              </div>
            </div>

            {/* Vehicle-Level Coverage */}
            <div>
              <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                <Car className="w-4 h-4" />
                Physical Damage Coverage (Per Vehicle)
              </h5>
              <div className="space-y-3 pl-6">
                {formData.vehicles.map((v, i) => (
                  <div key={v.id} className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {v.year} {v.make} {v.model}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-200 dark:bg-gray-600 px-1.5 py-0.5 rounded">
                        #{i + 1}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">Comp: </span>
                        <span className="text-gray-900 dark:text-gray-100">
                          {(v as any).compDeductible === 'waive' ? 'Waived' : `$${(v as any).compDeductible || '500'} ded`}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">Coll: </span>
                        <span className="text-gray-900 dark:text-gray-100">
                          {(v as any).collDeductible === 'waive' ? 'Waived' : `$${(v as any).collDeductible || '500'} ded`}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Additional Coverages */}
            {(formData.coverage.rental || formData.coverage.roadside) && (
              <div>
                <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                  <Check className="w-4 h-4" />
                  Additional Coverages
                </h5>
                <div className="flex flex-wrap gap-2 pl-6">
                  {formData.coverage.rental && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 rounded-full">
                      <Check className="w-3 h-3" />
                      Rental Car Reimbursement
                    </span>
                  )}
                  {formData.coverage.roadside && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 rounded-full">
                      <Check className="w-3 h-3" />
                      Roadside Assistance
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Current Insurance */}
      <section className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-5 border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
            Current Insurance
          </h3>
          <CanopyConnectSMS
            customerPhone={formData.phone}
            customerName={formData.firstName}
            variant="outline"
            size="sm"
          />
        </div>
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
              <FormInput
                label="Current Carrier"
                value={formData.currentCarrier}
                onChange={(v) => updateField('currentCarrier', v)}
                placeholder="Company name"
              />
              <FormInput
                label="Current Premium"
                value={formData.currentPremium}
                onChange={(v) => updateField('currentPremium', v)}
                placeholder="$0.00"
              />
              <FormInput
                label="Years with Carrier"
                value={formData.yearsWithCarrier}
                onChange={(v) => updateField('yearsWithCarrier', v)}
                placeholder="0"
              />
            </div>
          )}
        </div>
      </section>

      {/* Discounts */}
      <section className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-5 border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
          Available Discounts
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
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
      <section className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-5 border border-gray-200 dark:border-gray-700">
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
                  'text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800',
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
              rows={3}
              placeholder="Add any additional notes for this quote..."
              className={cn(
                'w-full px-3 py-2 rounded-lg border transition-colors',
                'text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800',
                'border-gray-300 dark:border-gray-600',
                'focus:outline-none focus:ring-2 focus:ring-emerald-500'
              )}
            />
          </div>
        </div>
      </section>

      {/* Important Notice */}
      <div className="flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-700">
        <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-blue-800 dark:text-blue-200">
          <p className="font-medium mb-1">Important Notice</p>
          <p className="text-blue-700 dark:text-blue-300">
            By submitting this quote, you confirm that all information provided is accurate to the best of your knowledge.
            Inaccurate information may result in policy cancellation or claim denial.
          </p>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

interface CollapsibleCardProps {
  icon: any;
  title: string;
  expanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
  summary: string;
  children: React.ReactNode;
}

function CollapsibleCard({ icon: Icon, title, expanded, onToggle, onEdit, summary, children }: CollapsibleCardProps) {
  return (
    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <Icon className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <h4 className="font-medium text-gray-900 dark:text-gray-100">{title}</h4>
            {!expanded && (
              <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{summary}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(); }}
            className="text-sm text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors"
          >
            Edit
          </button>
          {expanded ? (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronRight className="w-5 h-5 text-gray-400" />
          )}
        </div>
      </div>
      {expanded && (
        <div className="px-4 pb-4 pt-2 border-t border-gray-200 dark:border-gray-700">
          {children}
        </div>
      )}
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

function FormInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        {label}
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(
          'w-full px-3 py-2 rounded-lg border transition-colors',
          'text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800',
          'border-gray-300 dark:border-gray-600',
          'focus:outline-none focus:ring-2 focus:ring-emerald-500'
        )}
      />
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
