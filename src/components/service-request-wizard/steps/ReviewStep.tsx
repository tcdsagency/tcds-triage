'use client';

/**
 * Review Step
 * ===========
 * Final review before submission.
 */

import { ChevronRight, Calendar, FileText, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useServiceRequestWizard } from '../ServiceRequestWizardProvider';
import { getChangeTypeById } from '../config/change-types';

export function ReviewStep() {
  const { formData, updateField, goToStep, errors } = useServiceRequestWizard();
  const changeType = formData.changeType ? getChangeTypeById(formData.changeType) : null;

  const renderSummary = () => {
    switch (formData.changeType) {
      case 'add_vehicle':
        return (
          <SummaryCard title="New Vehicle" onEdit={() => goToStep(2)}>
            <SummaryRow
              label="Vehicle"
              value={`${formData.vehicle.year} ${formData.vehicle.make} ${formData.vehicle.model}`}
            />
            <SummaryRow label="VIN" value={formData.vehicle.vin || 'Not provided'} />
            <SummaryRow label="Ownership" value={formData.vehicle.ownership} />
            <SummaryRow label="Primary Use" value={formData.vehicle.primaryUse} />
            {formData.vehicle.lienholderName && (
              <SummaryRow label="Lienholder" value={formData.vehicle.lienholderName} />
            )}
          </SummaryCard>
        );

      case 'remove_vehicle':
        return (
          <SummaryCard title="Vehicle Removal" onEdit={() => goToStep(2)}>
            <SummaryRow label="Vehicle" value={formData.vehicleToRemove || 'Not specified'} />
            <SummaryRow label="Reason" value={formData.removalReason} />
            {formData.newOwnerInfo && (
              <SummaryRow label="New Owner" value={formData.newOwnerInfo} />
            )}
          </SummaryCard>
        );

      case 'replace_vehicle':
        return (
          <SummaryCard title="Vehicle Replacement" onEdit={() => goToStep(2)}>
            <SummaryRow label="Old Vehicle" value={formData.vehicleToRemove || 'Not specified'} />
            <SummaryRow
              label="New Vehicle"
              value={`${formData.vehicle.year} ${formData.vehicle.make} ${formData.vehicle.model}`}
            />
            <SummaryRow label="VIN" value={formData.vehicle.vin || 'Not provided'} />
          </SummaryCard>
        );

      case 'add_driver':
        return (
          <SummaryCard title="New Driver" onEdit={() => goToStep(2)}>
            <SummaryRow
              label="Name"
              value={`${formData.driver.firstName} ${formData.driver.lastName}`}
            />
            <SummaryRow label="Date of Birth" value={formData.driver.dob} />
            <SummaryRow label="License" value={formData.driver.licenseNumber} />
            <SummaryRow label="License State" value={formData.driver.licenseState} />
            <SummaryRow label="Relationship" value={formData.driver.relationship} />
            {formData.driver.hasViolations && (
              <SummaryRow label="Violations" value="Yes - see details" />
            )}
          </SummaryCard>
        );

      case 'remove_driver':
        return (
          <SummaryCard title="Driver Removal" onEdit={() => goToStep(2)}>
            <SummaryRow label="Driver" value={formData.driverToRemove || 'Not specified'} />
            <SummaryRow label="Reason" value={formData.driverRemovalReason} />
          </SummaryCard>
        );

      case 'address_change':
        return (
          <SummaryCard title="Address Change" onEdit={() => goToStep(2)}>
            <SummaryRow
              label="New Address"
              value={`${formData.address.newAddress}, ${formData.address.newCity}, ${formData.address.newState} ${formData.address.newZip}`}
            />
            <SummaryRow
              label="Garaging"
              value={
                formData.address.garagingLocation === 'same' ? 'Same as new address' : 'Different'
              }
            />
            <SummaryRow
              label="Update All Policies"
              value={formData.address.updateAllPolicies ? 'Yes' : 'No'}
            />
          </SummaryCard>
        );

      case 'add_mortgagee':
      case 'remove_mortgagee':
        return (
          <SummaryCard
            title={formData.changeType === 'add_mortgagee' ? 'Add Lienholder' : 'Remove Lienholder'}
            onEdit={() => goToStep(2)}
          >
            <SummaryRow label="Lienholder" value={formData.mortgagee.lienholderName} />
            {formData.mortgagee.loanNumber && (
              <SummaryRow label="Loan Number" value={formData.mortgagee.loanNumber} />
            )}
            <SummaryRow label="Vehicle/Property" value={formData.mortgagee.vehicleOrProperty} />
          </SummaryCard>
        );

      case 'coverage_change':
        return (
          <SummaryCard title="Coverage Change" onEdit={() => goToStep(2)}>
            <SummaryRow label="Coverage Type" value={formData.coverageChange.coverageType} />
            <SummaryRow
              label="Current Limit"
              value={formData.coverageChange.currentLimit || 'Not specified'}
            />
            <SummaryRow label="New Limit" value={formData.coverageChange.newLimit} />
            {formData.coverageChange.reason && (
              <SummaryRow label="Reason" value={formData.coverageChange.reason} />
            )}
          </SummaryCard>
        );

      case 'cancel_policy':
        return (
          <SummaryCard title="Policy Cancellation" onEdit={() => goToStep(2)}>
            <SummaryRow label="Reason" value={formData.cancellation.reason} />
            {formData.cancellation.reasonDetails && (
              <SummaryRow label="Details" value={formData.cancellation.reasonDetails} />
            )}
            <SummaryRow
              label="Has New Coverage"
              value={formData.cancellation.hasNewCoverage ? 'Yes' : 'No'}
            />
            {formData.cancellation.newCarrier && (
              <SummaryRow label="New Carrier" value={formData.cancellation.newCarrier} />
            )}
            <SummaryRow label="Refund Method" value={formData.cancellation.refundMethod} />
          </SummaryCard>
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Review Your Request
        </h2>
        <p className="text-gray-500 dark:text-gray-400 mt-2">
          Please review the details below before submitting
        </p>
      </div>

      {/* Policy Info */}
      {formData.policy && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-900 dark:text-gray-100">
                  {formData.policy.policyNumber}
                </span>
                <Badge variant="secondary">{formData.policy.type}</Badge>
                {changeType && (
                  <Badge
                    className={cn(
                      'text-xs',
                      changeType.category === 'admin'
                        ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                        : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                    )}
                  >
                    {changeType.name}
                  </Badge>
                )}
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {formData.policy.insuredName} &bull; {formData.policy.carrier}
              </p>
            </div>
            <button
              onClick={() => goToStep(0)}
              className="text-sm text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 flex items-center gap-1"
            >
              Change <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Effective Date */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
            <Calendar className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="flex-1">
            <p className="text-sm text-gray-500 dark:text-gray-400">Effective Date</p>
            <p className="font-semibold text-gray-900 dark:text-gray-100">
              {formData.effectiveDate}
            </p>
          </div>
          <button
            onClick={() => goToStep(2)}
            className="text-sm text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 flex items-center gap-1"
          >
            Edit <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Change Summary */}
      {renderSummary()}

      {/* Notes */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
            <FileText className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <h4 className="font-medium text-gray-900 dark:text-gray-100">Additional Notes</h4>
        </div>
        <textarea
          value={formData.notes}
          onChange={(e) => updateField('notes', e.target.value)}
          placeholder="Add any additional notes for this request..."
          rows={3}
          className={cn(
            'w-full px-3 py-2 rounded-lg border transition-colors',
            'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100',
            'border-gray-300 dark:border-gray-600',
            'focus:outline-none focus:ring-2 focus:ring-emerald-500'
          )}
        />
      </div>

      {/* Submit Error */}
      {errors.submit && (
        <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-4 border border-red-200 dark:border-red-500/30 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0" />
          <p className="text-sm text-red-700 dark:text-red-400">{errors.submit}</p>
        </div>
      )}

      {/* Confirmation Note */}
      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 border border-blue-200 dark:border-blue-500/30">
        <p className="text-sm text-blue-700 dark:text-blue-400">
          By clicking &quot;Submit Request&quot;, this change will be submitted for processing.
          You will receive a confirmation with the request ID.
        </p>
      </div>
    </div>
  );
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

function SummaryCard({
  title,
  onEdit,
  children,
}: {
  title: string;
  onEdit: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden shadow-sm">
      <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
        <h4 className="font-medium text-gray-900 dark:text-gray-100">{title}</h4>
        <button
          onClick={onEdit}
          className="text-sm text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 flex items-center gap-1"
        >
          Edit <ChevronRight className="w-4 h-4" />
        </button>
      </div>
      <div className="p-4 space-y-2">{children}</div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="text-sm text-gray-500 dark:text-gray-400 w-32 flex-shrink-0">{label}:</span>
      <span className="text-sm text-gray-900 dark:text-gray-100">{value}</span>
    </div>
  );
}

export default ReviewStep;
