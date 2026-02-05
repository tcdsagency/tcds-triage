'use client';

/**
 * ReviewStep
 * ==========
 * Final review step with eligibility banner, collapsible summary cards,
 * coverage summary, current insurance, discounts, and submission fields.
 */

import React, { useState } from 'react';
import { useFormContext } from 'react-hook-form';
import {
  User,
  Car,
  Users,
  Shield,
  ChevronRight,
  ChevronDown,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Check,
  Info,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useQuoteWizard } from '../../QuoteWizardProvider';
import { CanopyConnectSMS } from '@/components/CanopyConnectSMS';
import { CurrentInsuranceFields, DiscountFields, SubmissionFields } from '../shared';
import { FormSection } from '../../fields';

// =============================================================================
// COLLAPSIBLE CARD
// =============================================================================

interface CollapsibleCardProps {
  icon: React.ElementType;
  title: string;
  expanded: boolean;
  onToggle: () => void;
  onEdit?: () => void;
  summary?: string;
  children: React.ReactNode;
}

function CollapsibleCard({
  icon: Icon,
  title,
  expanded,
  onToggle,
  onEdit,
  summary,
  children,
}: CollapsibleCardProps) {
  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50 overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
        onClick={onToggle}
      >
        <Icon className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
        <span className="font-semibold text-gray-900 dark:text-gray-100 flex-1">
          {title}
        </span>
        {!expanded && summary && (
          <span className="text-sm text-gray-500 dark:text-gray-400 truncate max-w-xs">
            {summary}
          </span>
        )}
        {onEdit && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium px-2 py-1"
          >
            Edit
          </button>
        )}
        {expanded ? (
          <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
        ) : (
          <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
        )}
      </div>

      {/* Body */}
      {expanded && (
        <div className="px-4 pb-4 pt-1 border-t border-gray-100 dark:border-gray-700">
          {children}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// REVIEW STEP
// =============================================================================

export function ReviewStep() {
  const { watch } = useFormContext();
  const { eligibility, goToStep } = useQuoteWizard();

  // Local expanded state for collapsible sections
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    contact: false,
    vehicles: false,
    drivers: false,
  });

  const toggleSection = (key: string) => {
    setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Read form data
  const firstName = watch('firstName');
  const lastName = watch('lastName');
  const phone = watch('phone');
  const email = watch('email');
  const address = watch('address');
  const city = watch('city');
  const state = watch('state');
  const zip = watch('zip');
  const vehicles: { year?: string; make?: string; model?: string }[] = watch('vehicles') ?? [];
  const drivers: { firstName?: string; lastName?: string; relationship?: string }[] = watch('drivers') ?? [];
  const coverage = watch('coverage');
  const discounts = watch('discounts');

  // Build summaries
  const contactSummary = [firstName, lastName].filter(Boolean).join(' ')
    + (phone ? ` | ${phone}` : '')
    + (email ? ` | ${email}` : '');

  const addressLine = [address, city, state, zip].filter(Boolean).join(', ');

  const vehicleSummary = vehicles.length > 0
    ? vehicles.map((v, i) =>
        [v.year, v.make, v.model].filter(Boolean).join(' ') || `Vehicle ${i + 1}`
      ).join(', ')
    : '';

  const driverSummary = drivers.length > 0
    ? drivers.map((d, i) =>
        [d.firstName, d.lastName].filter(Boolean).join(' ') || `Driver ${i + 1}`
      ).join(', ')
    : '';

  return (
    <div className="space-y-6">
      {/* ================================================================= */}
      {/* ELIGIBILITY BANNER                                                */}
      {/* ================================================================= */}
      {eligibility && (
        <div
          className={cn(
            'rounded-lg border p-4 flex items-start gap-3',
            eligibility.status === 'ELIGIBLE' &&
              'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800',
            eligibility.status === 'REVIEW' &&
              'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800',
            eligibility.status === 'DECLINE' &&
              'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',
          )}
        >
          {eligibility.status === 'ELIGIBLE' && (
            <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
          )}
          {eligibility.status === 'REVIEW' && (
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
          )}
          {eligibility.status === 'DECLINE' && (
            <XCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
          )}
          <div className="flex-1">
            <p
              className={cn(
                'font-semibold',
                eligibility.status === 'ELIGIBLE' && 'text-green-800 dark:text-green-300',
                eligibility.status === 'REVIEW' && 'text-amber-800 dark:text-amber-300',
                eligibility.status === 'DECLINE' && 'text-red-800 dark:text-red-300',
              )}
            >
              {eligibility.status === 'ELIGIBLE' && 'Eligible for Submission'}
              {eligibility.status === 'REVIEW' && 'Review Required'}
              {eligibility.status === 'DECLINE' && 'Cannot Submit - Issues Found'}
            </p>
            {eligibility.alerts && eligibility.alerts.length > 0 && (
              <ul className="mt-2 space-y-1">
                {eligibility.alerts.map((alert: string, i: number) => (
                  <li
                    key={i}
                    className={cn(
                      'text-sm flex items-start gap-2',
                      eligibility.status === 'REVIEW' && 'text-amber-700 dark:text-amber-400',
                      eligibility.status === 'DECLINE' && 'text-red-700 dark:text-red-400',
                    )}
                  >
                    <span className="mt-0.5">-</span>
                    <span>{alert}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* COLLAPSIBLE SUMMARY CARDS                                         */}
      {/* ================================================================= */}
      <div className="space-y-3">
        {/* Contact Card */}
        <CollapsibleCard
          icon={User}
          title="Contact Information"
          expanded={expandedSections.contact}
          onToggle={() => toggleSection('contact')}
          onEdit={() => goToStep(0)}
          summary={contactSummary}
        >
          <div className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
              <div>
                <span className="font-medium text-gray-500 dark:text-gray-400">Name:</span>{' '}
                {[firstName, lastName].filter(Boolean).join(' ') || '-'}
              </div>
              <div>
                <span className="font-medium text-gray-500 dark:text-gray-400">Phone:</span>{' '}
                {phone || '-'}
              </div>
              <div>
                <span className="font-medium text-gray-500 dark:text-gray-400">Email:</span>{' '}
                {email || '-'}
              </div>
              <div>
                <span className="font-medium text-gray-500 dark:text-gray-400">Address:</span>{' '}
                {addressLine || '-'}
              </div>
            </div>
          </div>
        </CollapsibleCard>

        {/* Vehicles Card */}
        {vehicles.length > 0 && (
          <CollapsibleCard
            icon={Car}
            title="Vehicles"
            expanded={expandedSections.vehicles}
            onToggle={() => toggleSection('vehicles')}
            onEdit={() => goToStep(1)}
            summary={vehicleSummary}
          >
            <div className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
              {vehicles.map((v, i) => {
                const label = [v.year, v.make, v.model].filter(Boolean).join(' ') || `Vehicle ${i + 1}`;
                return (
                  <div key={i} className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                    <span>{label}</span>
                  </div>
                );
              })}
            </div>
          </CollapsibleCard>
        )}

        {/* Drivers Card */}
        {drivers.length > 0 && (
          <CollapsibleCard
            icon={Users}
            title="Drivers"
            expanded={expandedSections.drivers}
            onToggle={() => toggleSection('drivers')}
            onEdit={() => goToStep(2)}
            summary={driverSummary}
          >
            <div className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
              {drivers.map((d, i) => {
                const name = [d.firstName, d.lastName].filter(Boolean).join(' ') || `Driver ${i + 1}`;
                return (
                  <div key={i} className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                    <span>{name}</span>
                    {d.relationship && (
                      <span className="text-xs text-gray-400">({d.relationship})</span>
                    )}
                  </div>
                );
              })}
            </div>
          </CollapsibleCard>
        )}
      </div>

      {/* ================================================================= */}
      {/* COVERAGE SUMMARY                                                  */}
      {/* ================================================================= */}
      {coverage && (
        <FormSection title="Coverage Summary" icon={Shield}>
          <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
            {coverage.bodilyInjury && (
              <div>
                <span className="font-medium text-gray-500 dark:text-gray-400">Bodily Injury:</span>{' '}
                <span className="text-gray-900 dark:text-gray-100">{coverage.bodilyInjury}</span>
              </div>
            )}
            {coverage.propertyDamage && (
              <div>
                <span className="font-medium text-gray-500 dark:text-gray-400">Property Damage:</span>{' '}
                <span className="text-gray-900 dark:text-gray-100">{coverage.propertyDamage}</span>
              </div>
            )}
            {coverage.umUim && (
              <div>
                <span className="font-medium text-gray-500 dark:text-gray-400">UM/UIM:</span>{' '}
                <span className="text-gray-900 dark:text-gray-100">{coverage.umUim}</span>
              </div>
            )}
            {coverage.medPay && (
              <div>
                <span className="font-medium text-gray-500 dark:text-gray-400">Medical Payments:</span>{' '}
                <span className="text-gray-900 dark:text-gray-100">{coverage.medPay}</span>
              </div>
            )}
            {coverage.dwelling && (
              <div>
                <span className="font-medium text-gray-500 dark:text-gray-400">Dwelling:</span>{' '}
                <span className="text-gray-900 dark:text-gray-100">{coverage.dwelling}</span>
              </div>
            )}
            {coverage.personalProperty && (
              <div>
                <span className="font-medium text-gray-500 dark:text-gray-400">Personal Property:</span>{' '}
                <span className="text-gray-900 dark:text-gray-100">{coverage.personalProperty}</span>
              </div>
            )}
            {coverage.liability && (
              <div>
                <span className="font-medium text-gray-500 dark:text-gray-400">Liability:</span>{' '}
                <span className="text-gray-900 dark:text-gray-100">{coverage.liability}</span>
              </div>
            )}
            {coverage.deductible && (
              <div>
                <span className="font-medium text-gray-500 dark:text-gray-400">Deductible:</span>{' '}
                <span className="text-gray-900 dark:text-gray-100">{coverage.deductible}</span>
              </div>
            )}
            {coverage.rental && (
              <div>
                <span className="font-medium text-gray-500 dark:text-gray-400">Rental Car:</span>{' '}
                <span className="text-gray-900 dark:text-gray-100">Included</span>
              </div>
            )}
            {coverage.roadside && (
              <div>
                <span className="font-medium text-gray-500 dark:text-gray-400">Roadside:</span>{' '}
                <span className="text-gray-900 dark:text-gray-100">Included</span>
              </div>
            )}
            {coverage.umbrellaLimit && (
              <div>
                <span className="font-medium text-gray-500 dark:text-gray-400">Umbrella Limit:</span>{' '}
                <span className="text-gray-900 dark:text-gray-100">{coverage.umbrellaLimit}</span>
              </div>
            )}
          </div>
        </FormSection>
      )}

      {/* ================================================================= */}
      {/* CURRENT INSURANCE                                                 */}
      {/* ================================================================= */}
      <div className="space-y-3">
        <CurrentInsuranceFields />
        <div className="flex items-center gap-3 px-1">
          <Info className="w-4 h-4 text-gray-400 flex-shrink-0" />
          <span className="text-sm text-gray-500 dark:text-gray-400">
            Import current coverage automatically:
          </span>
          <CanopyConnectSMS
            customerPhone={phone}
            customerName={[firstName, lastName].filter(Boolean).join(' ')}
          />
        </div>
      </div>

      {/* ================================================================= */}
      {/* DISCOUNTS                                                         */}
      {/* ================================================================= */}
      {discounts && (
        <FormSection title="Discounts" icon={Check}>
          <DiscountFields />
        </FormSection>
      )}

      {/* ================================================================= */}
      {/* SUBMISSION                                                        */}
      {/* ================================================================= */}
      <SubmissionFields />
    </div>
  );
}

export default ReviewStep;
