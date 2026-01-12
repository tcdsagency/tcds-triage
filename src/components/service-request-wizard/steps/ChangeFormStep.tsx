'use client';

/**
 * Change Form Step
 * ================
 * Dynamic form based on change type.
 */

import { useState } from 'react';
import {
  Car,
  User,
  MapPin,
  Home,
  Shield,
  XCircle,
  Search,
  Loader2,
  AlertTriangle,
  Calendar,
  Lightbulb,
  MessageSquare,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useServiceRequestWizard } from '../ServiceRequestWizardProvider';
import { getChangeTypeById, US_STATES, OWNERSHIP_OPTIONS, VEHICLE_USE_OPTIONS, VEHICLE_REMOVAL_REASONS, DRIVER_REMOVAL_REASONS, RELATIONSHIP_OPTIONS, GENDER_OPTIONS, CANCELLATION_REASONS } from '../config/change-types';
import { getTipsForChangeType, type AgentTip } from '../config/agent-assist';

export function ChangeFormStep() {
  const { formData, updateField, updateNestedField, errors, loadingPolicyDetails } = useServiceRequestWizard();
  const [vinDecoding, setVinDecoding] = useState(false);
  const [showTips, setShowTips] = useState(true);

  const changeType = formData.changeType ? getChangeTypeById(formData.changeType) : null;
  const tips = getTipsForChangeType(formData.changeType);
  const policyVehicles = formData.policyDetails?.vehicles || [];
  const policyDrivers = formData.policyDetails?.drivers || [];

  const decodeVin = async (vin: string) => {
    if (vin.length !== 17) return;
    setVinDecoding(true);
    try {
      const res = await fetch(
        `https://vpic.nhtsa.dot.gov/api/vehicles/decodevin/${vin}?format=json`
      );
      const data = await res.json();
      const results = data.Results || [];
      const getValue = (v: string) => results.find((r: any) => r.Variable === v)?.Value || '';
      const year = getValue('Model Year');
      const make = getValue('Make');
      const model = getValue('Model');

      updateNestedField('vehicle', 'year', year);
      updateNestedField('vehicle', 'make', make);
      updateNestedField('vehicle', 'model', model);
    } catch (e) {
      console.error(e);
    }
    setVinDecoding(false);
  };

  // Shared effective date input
  const EffectiveDateField = () => (
    <div>
      <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        <Calendar className="w-4 h-4" />
        Effective Date <span className="text-red-500">*</span>
      </label>
      <Input
        type="date"
        value={formData.effectiveDate}
        onChange={(e) => updateField('effectiveDate', e.target.value)}
        className={cn(
          'bg-white text-gray-900',
          errors.effectiveDate
            ? 'border-red-300 dark:border-red-500'
            : 'border-gray-300 dark:border-gray-600'
        )}
      />
      {errors.effectiveDate && (
        <p className="mt-1 text-sm text-red-600">{errors.effectiveDate}</p>
      )}
    </div>
  );

  // Render form based on change type
  const renderForm = () => {
    switch (formData.changeType) {
      // =========================================================================
      // ADD VEHICLE
      // =========================================================================
      case 'add_vehicle':
        return (
          <div className="space-y-6">
            <FormSection icon={Car} title="New Vehicle Information">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    VIN <span className="text-red-500">*</span>
                  </label>
                  <div className="flex gap-2">
                    <Input
                      value={formData.vehicle.vin}
                      onChange={(e) =>
                        updateNestedField('vehicle', 'vin', e.target.value.toUpperCase())
                      }
                      placeholder="1HGCM82633A123456"
                      maxLength={17}
                      className="font-mono bg-white text-gray-900"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => decodeVin(formData.vehicle.vin)}
                      disabled={formData.vehicle.vin.length !== 17 || vinDecoding}
                    >
                      {vinDecoding ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Search className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>

                <FormField
                  label="Year"
                  value={formData.vehicle.year}
                  onChange={(v) => updateNestedField('vehicle', 'year', v)}
                  placeholder="2024"
                  required
                  error={errors['vehicle.year']}
                />
                <FormField
                  label="Make"
                  value={formData.vehicle.make}
                  onChange={(v) => updateNestedField('vehicle', 'make', v)}
                  placeholder="Toyota"
                  required
                  error={errors['vehicle.make']}
                />
                <FormField
                  label="Model"
                  value={formData.vehicle.model}
                  onChange={(v) => updateNestedField('vehicle', 'model', v)}
                  placeholder="Camry"
                  required
                  error={errors['vehicle.model']}
                />
                <FormSelect
                  label="Ownership"
                  value={formData.vehicle.ownership}
                  onChange={(v) => updateNestedField('vehicle', 'ownership', v)}
                  options={OWNERSHIP_OPTIONS}
                />
                <FormSelect
                  label="Primary Use"
                  value={formData.vehicle.primaryUse}
                  onChange={(v) => updateNestedField('vehicle', 'primaryUse', v)}
                  options={VEHICLE_USE_OPTIONS}
                />
                <FormField
                  label="Annual Mileage"
                  value={formData.vehicle.annualMileage}
                  onChange={(v) => updateNestedField('vehicle', 'annualMileage', v)}
                  placeholder="12000"
                />
              </div>

              {(formData.vehicle.ownership === 'financed' ||
                formData.vehicle.ownership === 'leased') && (
                <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">
                    Lienholder Information
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                      label="Lienholder Name"
                      value={formData.vehicle.lienholderName}
                      onChange={(v) => updateNestedField('vehicle', 'lienholderName', v)}
                      placeholder="Chase Auto Finance"
                      required
                    />
                    <FormField
                      label="Lienholder Address (if available)"
                      value={formData.vehicle.lienholderAddress}
                      onChange={(v) => updateNestedField('vehicle', 'lienholderAddress', v)}
                      placeholder="P.O. Box 12345, City, ST 12345"
                    />
                  </div>
                </div>
              )}

              {/* Replacement Question */}
              <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                <label className="flex items-center gap-3 cursor-pointer mb-4">
                  <input
                    type="checkbox"
                    checked={formData.isReplacing}
                    onChange={(e) => updateField('isReplacing', e.target.checked)}
                    className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300 font-medium">
                    Is this replacing another vehicle on the policy?
                  </span>
                </label>

                {formData.isReplacing && policyVehicles.length > 0 && (
                  <div className="ml-7 space-y-4">
                    <FormSelect
                      label="Which vehicle is being replaced?"
                      value={formData.replacingVehicleId}
                      onChange={(v) => updateField('replacingVehicleId', v)}
                      options={[
                        { value: '', label: 'Select vehicle...' },
                        ...policyVehicles.map((v) => ({ value: v.id, label: v.displayName })),
                      ]}
                      required
                    />
                    <InfoBox>
                      The old vehicle will be removed from the policy when the new vehicle is added.
                    </InfoBox>
                  </div>
                )}

                {formData.isReplacing && policyVehicles.length === 0 && (
                  <div className="ml-7">
                    <FormField
                      label="Vehicle being replaced"
                      value={formData.vehicleToRemove}
                      onChange={(v) => updateField('vehicleToRemove', v)}
                      placeholder="Year Make Model"
                    />
                  </div>
                )}
              </div>

              <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                <EffectiveDateField />
              </div>
            </FormSection>
            <AgentAssistPanel tips={tips} showTips={showTips} setShowTips={setShowTips} />
          </div>
        );

      // =========================================================================
      // REMOVE VEHICLE
      // =========================================================================
      case 'remove_vehicle':
        const selectedVehicle = policyVehicles.find(v => v.id === formData.selectedVehicleId);
        return (
          <div className="space-y-6">
            <FormSection icon={Car} title="Vehicle Removal">
              {loadingPolicyDetails ? (
                <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 py-4">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Loading policy vehicles...</span>
                </div>
              ) : policyVehicles.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormSelect
                    label="Select Vehicle to Remove"
                    value={formData.selectedVehicleId}
                    onChange={(v) => {
                      updateField('selectedVehicleId', v);
                      const vehicle = policyVehicles.find(veh => veh.id === v);
                      if (vehicle) {
                        updateField('vehicleToRemove', vehicle.displayName);
                      }
                    }}
                    options={[
                      { value: '', label: 'Select a vehicle...' },
                      ...policyVehicles.map((v) => ({
                        value: v.id,
                        label: v.displayName + (v.vin ? ` (${v.vin.slice(-6)})` : ''),
                      })),
                    ]}
                    required
                    className="sm:col-span-2"
                  />
                  {selectedVehicle && (
                    <div className="sm:col-span-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg text-sm">
                      <p className="font-medium text-gray-900 dark:text-gray-100">{selectedVehicle.displayName}</p>
                      {selectedVehicle.vin && (
                        <p className="text-gray-500 dark:text-gray-400">VIN: {selectedVehicle.vin}</p>
                      )}
                    </div>
                  )}
                  <FormSelect
                    label="Reason for Removal"
                    value={formData.removalReason}
                    onChange={(v) => updateField('removalReason', v)}
                    options={VEHICLE_REMOVAL_REASONS}
                    required
                  />
                  <EffectiveDateField />
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    label="Vehicle to Remove"
                    value={formData.vehicleToRemove}
                    onChange={(v) => updateField('vehicleToRemove', v)}
                    placeholder="2020 Toyota Camry"
                    required
                    className="sm:col-span-2"
                  />
                  <FormSelect
                    label="Reason for Removal"
                    value={formData.removalReason}
                    onChange={(v) => updateField('removalReason', v)}
                    options={VEHICLE_REMOVAL_REASONS}
                    required
                  />
                  <EffectiveDateField />
                </div>
              )}

              {/* Replacement & Possession Questions */}
              <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700 space-y-4">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isReplacing}
                    onChange={(e) => updateField('isReplacing', e.target.checked)}
                    className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300 font-medium">
                    Will there be a replacement vehicle?
                  </span>
                </label>

                {formData.isReplacing && (
                  <InfoBox>
                    Recommend adding the new vehicle first to ensure continuous coverage.
                  </InfoBox>
                )}

                <div className="mt-4">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!formData.stillInPossession}
                      onChange={(e) => updateField('stillInPossession', !e.target.checked)}
                      className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300 font-medium">
                      Vehicle is already out of possession
                    </span>
                  </label>

                  {!formData.stillInPossession && (
                    <div className="ml-7 mt-3">
                      <FormField
                        label="Date vehicle left possession"
                        value={formData.outOfPossessionDate}
                        onChange={(v) => updateField('outOfPossessionDate', v)}
                        type="date"
                        required
                      />
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Coverage can be backdated to this date
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {formData.removalReason === 'sold' && (
                <div className="mt-4">
                  <FormField
                    label="New Owner (if known)"
                    value={formData.newOwnerInfo}
                    onChange={(v) => updateField('newOwnerInfo', v)}
                    placeholder="Buyer name/info"
                  />
                </div>
              )}

              {policyVehicles.length === 1 && formData.selectedVehicleId && (
                <WarningBox>
                  This is the only vehicle on the policy. The policy may need to be cancelled or
                  a replacement vehicle added.
                </WarningBox>
              )}
            </FormSection>
            <AgentAssistPanel tips={tips} showTips={showTips} setShowTips={setShowTips} />
          </div>
        );

      // =========================================================================
      // REPLACE VEHICLE
      // =========================================================================
      case 'replace_vehicle':
        const vehicleToReplace = policyVehicles.find(v => v.id === formData.selectedVehicleId);
        return (
          <div className="space-y-6">
            {/* Vehicle Being Replaced */}
            <FormSection icon={Car} title="Vehicle Being Replaced">
              {loadingPolicyDetails ? (
                <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 py-4">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Loading policy vehicles...</span>
                </div>
              ) : policyVehicles.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormSelect
                    label="Select Vehicle to Replace"
                    value={formData.selectedVehicleId}
                    onChange={(v) => {
                      updateField('selectedVehicleId', v);
                      const vehicle = policyVehicles.find(veh => veh.id === v);
                      if (vehicle) {
                        updateField('vehicleToRemove', vehicle.displayName);
                      }
                    }}
                    options={[
                      { value: '', label: 'Select a vehicle...' },
                      ...policyVehicles.map((v) => ({
                        value: v.id,
                        label: v.displayName + (v.vin ? ` (${v.vin.slice(-6)})` : ''),
                      })),
                    ]}
                    required
                    className="sm:col-span-2"
                  />
                  {vehicleToReplace && (
                    <div className="sm:col-span-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg text-sm">
                      <p className="font-medium text-gray-900 dark:text-gray-100">{vehicleToReplace.displayName}</p>
                      {vehicleToReplace.vin && (
                        <p className="text-gray-500 dark:text-gray-400">VIN: {vehicleToReplace.vin}</p>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    label="Vehicle Being Replaced"
                    value={formData.vehicleToRemove}
                    onChange={(v) => updateField('vehicleToRemove', v)}
                    placeholder="2020 Toyota Camry"
                    required
                    className="sm:col-span-2"
                  />
                </div>
              )}
            </FormSection>

            {/* New Vehicle Information */}
            <FormSection icon={Car} title="New Vehicle Information">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    VIN <span className="text-red-500">*</span>
                  </label>
                  <div className="flex gap-2">
                    <Input
                      value={formData.vehicle.vin}
                      onChange={(e) =>
                        updateNestedField('vehicle', 'vin', e.target.value.toUpperCase())
                      }
                      placeholder="1HGCM82633A123456"
                      maxLength={17}
                      className="font-mono bg-white text-gray-900"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => decodeVin(formData.vehicle.vin)}
                      disabled={formData.vehicle.vin.length !== 17 || vinDecoding}
                    >
                      {vinDecoding ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Search className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>

                <FormField
                  label="Year"
                  value={formData.vehicle.year}
                  onChange={(v) => updateNestedField('vehicle', 'year', v)}
                  placeholder="2024"
                  required
                  error={errors['vehicle.year']}
                />
                <FormField
                  label="Make"
                  value={formData.vehicle.make}
                  onChange={(v) => updateNestedField('vehicle', 'make', v)}
                  placeholder="Toyota"
                  required
                  error={errors['vehicle.make']}
                />
                <FormField
                  label="Model"
                  value={formData.vehicle.model}
                  onChange={(v) => updateNestedField('vehicle', 'model', v)}
                  placeholder="Camry"
                  required
                  error={errors['vehicle.model']}
                />
                <FormSelect
                  label="Ownership"
                  value={formData.vehicle.ownership}
                  onChange={(v) => updateNestedField('vehicle', 'ownership', v)}
                  options={OWNERSHIP_OPTIONS}
                />
                <FormSelect
                  label="Primary Use"
                  value={formData.vehicle.primaryUse}
                  onChange={(v) => updateNestedField('vehicle', 'primaryUse', v)}
                  options={VEHICLE_USE_OPTIONS}
                />
                <FormField
                  label="Annual Mileage"
                  value={formData.vehicle.annualMileage}
                  onChange={(v) => updateNestedField('vehicle', 'annualMileage', v)}
                  placeholder="12000"
                />
              </div>

              {(formData.vehicle.ownership === 'financed' ||
                formData.vehicle.ownership === 'leased') && (
                <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">
                    Lienholder Information
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                      label="Lienholder Name"
                      value={formData.vehicle.lienholderName}
                      onChange={(v) => updateNestedField('vehicle', 'lienholderName', v)}
                      placeholder="Chase Auto Finance"
                      required
                    />
                    <FormField
                      label="Lienholder Address (if available)"
                      value={formData.vehicle.lienholderAddress}
                      onChange={(v) => updateNestedField('vehicle', 'lienholderAddress', v)}
                      placeholder="P.O. Box 12345, City, ST 12345"
                    />
                  </div>
                </div>
              )}

              <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                <EffectiveDateField />
              </div>
            </FormSection>
            <AgentAssistPanel tips={tips} showTips={showTips} setShowTips={setShowTips} />
          </div>
        );

      // =========================================================================
      // ADD DRIVER
      // =========================================================================
      case 'add_driver':
        return (
          <div className="space-y-6">
            <FormSection icon={User} title="New Driver Information">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  label="First Name"
                  value={formData.driver.firstName}
                  onChange={(v) => updateNestedField('driver', 'firstName', v)}
                  placeholder="John"
                  required
                  error={errors['driver.firstName']}
                />
                <FormField
                  label="Last Name"
                  value={formData.driver.lastName}
                  onChange={(v) => updateNestedField('driver', 'lastName', v)}
                  placeholder="Doe"
                  required
                  error={errors['driver.lastName']}
                />
                <FormField
                  label="Date of Birth"
                  value={formData.driver.dob}
                  onChange={(v) => updateNestedField('driver', 'dob', v)}
                  type="date"
                  required
                  error={errors['driver.dob']}
                />
                <FormSelect
                  label="Gender"
                  value={formData.driver.gender}
                  onChange={(v) => updateNestedField('driver', 'gender', v)}
                  options={[{ value: '', label: 'Select...' }, ...GENDER_OPTIONS]}
                />
                <FormField
                  label="License Number"
                  value={formData.driver.licenseNumber}
                  onChange={(v) => updateNestedField('driver', 'licenseNumber', v)}
                  placeholder="DL123456789"
                  required
                  error={errors['driver.licenseNumber']}
                />
                <FormSelect
                  label="License State"
                  value={formData.driver.licenseState}
                  onChange={(v) => updateNestedField('driver', 'licenseState', v)}
                  options={[
                    { value: '', label: 'Select state...' },
                    ...US_STATES.map((s) => ({ value: s, label: s })),
                  ]}
                  required
                />
                <FormSelect
                  label="Relationship"
                  value={formData.driver.relationship}
                  onChange={(v) => updateNestedField('driver', 'relationship', v)}
                  options={[{ value: '', label: 'Select...' }, ...RELATIONSHIP_OPTIONS]}
                  required
                />
                <FormField
                  label="Years Licensed"
                  value={formData.driver.yearsLicensed}
                  onChange={(v) => updateNestedField('driver', 'yearsLicensed', v)}
                  placeholder="5"
                />
              </div>

              <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                <label className="flex items-center gap-3 cursor-pointer mb-4">
                  <input
                    type="checkbox"
                    checked={formData.driver.hasViolations}
                    onChange={(e) =>
                      updateNestedField('driver', 'hasViolations', e.target.checked)
                    }
                    className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    Driver has violations or accidents in past 5 years
                  </span>
                </label>
                {formData.driver.hasViolations && (
                  <FormField
                    label="Violation/Accident Details"
                    value={formData.driver.violationDetails}
                    onChange={(v) => updateNestedField('driver', 'violationDetails', v)}
                    placeholder="List violations, dates, and details..."
                    type="textarea"
                  />
                )}
              </div>

              <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                <EffectiveDateField />
              </div>
            </FormSection>
            <AgentAssistPanel tips={tips} showTips={showTips} setShowTips={setShowTips} />
          </div>
        );

      // =========================================================================
      // REMOVE DRIVER
      // =========================================================================
      case 'remove_driver':
        const selectedDriver = policyDrivers.find(d => d.id === formData.selectedDriverId);
        return (
          <div className="space-y-6">
            <FormSection icon={User} title="Remove Driver">
              {loadingPolicyDetails ? (
                <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 py-4">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Loading policy drivers...</span>
                </div>
              ) : policyDrivers.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormSelect
                    label="Select Driver to Remove"
                    value={formData.selectedDriverId}
                    onChange={(v) => {
                      updateField('selectedDriverId', v);
                      const driver = policyDrivers.find(d => d.id === v);
                      if (driver) {
                        updateField('driverToRemove', driver.displayName);
                      }
                    }}
                    options={[
                      { value: '', label: 'Select a driver...' },
                      ...policyDrivers.map((d) => ({
                        value: d.id,
                        label: `${d.displayName}${d.relationship ? ` (${d.relationship})` : ''}`,
                      })),
                    ]}
                    required
                    className="sm:col-span-2"
                  />
                  {selectedDriver && (
                    <div className="sm:col-span-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg text-sm">
                      <p className="font-medium text-gray-900 dark:text-gray-100">{selectedDriver.displayName}</p>
                      {selectedDriver.dateOfBirth && (
                        <p className="text-gray-500 dark:text-gray-400">DOB: {selectedDriver.dateOfBirth}</p>
                      )}
                      {selectedDriver.relationship && (
                        <p className="text-gray-500 dark:text-gray-400">Relationship: {selectedDriver.relationship}</p>
                      )}
                    </div>
                  )}
                  <FormSelect
                    label="Reason for Removal"
                    value={formData.driverRemovalReason}
                    onChange={(v) => updateField('driverRemovalReason', v)}
                    options={DRIVER_REMOVAL_REASONS}
                    required
                  />
                  <EffectiveDateField />
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    label="Driver to Remove"
                    value={formData.driverToRemove}
                    onChange={(v) => updateField('driverToRemove', v)}
                    placeholder="John Doe"
                    required
                    className="sm:col-span-2"
                  />
                  <FormSelect
                    label="Reason for Removal"
                    value={formData.driverRemovalReason}
                    onChange={(v) => updateField('driverRemovalReason', v)}
                    options={DRIVER_REMOVAL_REASONS}
                    required
                  />
                  <EffectiveDateField />
                </div>
              )}

              {formData.driverRemovalReason === 'excluded' && (
                <WarningBox title="Exclusion Form Required">
                  A signed driver exclusion form is required. The excluded driver cannot operate
                  ANY vehicle on this policy.
                </WarningBox>
              )}

              {policyDrivers.length === 1 && formData.selectedDriverId && (
                <WarningBox>
                  This is the only driver on the policy. Ensure a replacement driver is added or
                  discuss policy options.
                </WarningBox>
              )}
            </FormSection>
            <AgentAssistPanel tips={tips} showTips={showTips} setShowTips={setShowTips} />
          </div>
        );

      // =========================================================================
      // ADDRESS CHANGE
      // =========================================================================
      case 'address_change':
        return (
          <div className="space-y-6">
            <FormSection icon={MapPin} title="New Address">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  label="Street Address"
                  value={formData.address.newAddress}
                  onChange={(v) => updateNestedField('address', 'newAddress', v)}
                  placeholder="123 Main St"
                  required
                  error={errors['address.newAddress']}
                  className="sm:col-span-2"
                />
                <FormField
                  label="City"
                  value={formData.address.newCity}
                  onChange={(v) => updateNestedField('address', 'newCity', v)}
                  placeholder="Birmingham"
                  required
                  error={errors['address.newCity']}
                />
                <div className="grid grid-cols-2 gap-2">
                  <FormSelect
                    label="State"
                    value={formData.address.newState}
                    onChange={(v) => updateNestedField('address', 'newState', v)}
                    options={[
                      { value: '', label: 'Select...' },
                      ...US_STATES.map((s) => ({ value: s, label: s })),
                    ]}
                    required
                    error={errors['address.newState']}
                  />
                  <FormField
                    label="ZIP"
                    value={formData.address.newZip}
                    onChange={(v) => updateNestedField('address', 'newZip', v)}
                    placeholder="35203"
                    required
                    error={errors['address.newZip']}
                  />
                </div>
                <EffectiveDateField />
                <FormSelect
                  label="Vehicle Garaging Location"
                  value={formData.address.garagingLocation}
                  onChange={(v) => updateNestedField('address', 'garagingLocation', v)}
                  options={[
                    { value: 'same', label: 'Same as New Address' },
                    { value: 'different', label: 'Different Location' },
                  ]}
                />
              </div>
              <div className="mt-4">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.address.updateAllPolicies}
                    onChange={(e) =>
                      updateNestedField('address', 'updateAllPolicies', e.target.checked)
                    }
                    className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    Update all policies with this new address
                  </span>
                </label>
              </div>
            </FormSection>
            <AgentAssistPanel tips={tips} showTips={showTips} setShowTips={setShowTips} />
          </div>
        );

      // =========================================================================
      // MORTGAGEE
      // =========================================================================
      case 'add_mortgagee':
      case 'remove_mortgagee':
        return (
          <div className="space-y-6">
            <FormSection
              icon={Home}
              title={formData.changeType === 'add_mortgagee' ? 'Add Lienholder' : 'Remove Lienholder'}
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  label="Lienholder Name"
                  value={formData.mortgagee.lienholderName}
                  onChange={(v) => updateNestedField('mortgagee', 'lienholderName', v)}
                  placeholder="Bank of America"
                  required
                />
                {formData.changeType === 'add_mortgagee' && (
                  <>
                    <FormField
                      label="Loan/Account Number"
                      value={formData.mortgagee.loanNumber}
                      onChange={(v) => updateNestedField('mortgagee', 'loanNumber', v)}
                      placeholder="123456789"
                    />
                    <FormField
                      label="Lienholder Address"
                      value={formData.mortgagee.lienholderAddress}
                      onChange={(v) => updateNestedField('mortgagee', 'lienholderAddress', v)}
                      placeholder="P.O. Box 12345, City, ST 12345"
                      required
                      className="sm:col-span-2"
                    />
                  </>
                )}
                <FormField
                  label="Vehicle/Property"
                  value={formData.mortgagee.vehicleOrProperty}
                  onChange={(v) => updateNestedField('mortgagee', 'vehicleOrProperty', v)}
                  placeholder="2024 Toyota Camry OR 123 Main St"
                  required
                  className="sm:col-span-2"
                />
                <EffectiveDateField />
              </div>
            </FormSection>
            <AgentAssistPanel tips={tips} showTips={showTips} setShowTips={setShowTips} />
          </div>
        );

      // =========================================================================
      // COVERAGE CHANGE
      // =========================================================================
      case 'coverage_change':
        return (
          <div className="space-y-6">
            <FormSection icon={Shield} title="Coverage Change">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormSelect
                  label="Coverage Type"
                  value={formData.coverageChange.coverageType}
                  onChange={(v) => updateNestedField('coverageChange', 'coverageType', v)}
                  options={[
                    { value: '', label: 'Select coverage...' },
                    { value: 'liability', label: 'Bodily Injury/Property Damage Liability' },
                    { value: 'um_uim', label: 'Uninsured/Underinsured Motorist' },
                    { value: 'comprehensive', label: 'Comprehensive Deductible' },
                    { value: 'collision', label: 'Collision Deductible' },
                    { value: 'dwelling', label: 'Dwelling Coverage' },
                    { value: 'personal_property', label: 'Personal Property' },
                    { value: 'liability_home', label: 'Personal Liability' },
                  ]}
                  required
                />
                <EffectiveDateField />
                <FormField
                  label="Current Limit/Deductible"
                  value={formData.coverageChange.currentLimit}
                  onChange={(v) => updateNestedField('coverageChange', 'currentLimit', v)}
                  placeholder="$100,000/$300,000"
                />
                <FormField
                  label="New Limit/Deductible"
                  value={formData.coverageChange.newLimit}
                  onChange={(v) => updateNestedField('coverageChange', 'newLimit', v)}
                  placeholder="$250,000/$500,000"
                  required
                />
                <FormField
                  label="Reason for Change"
                  value={formData.coverageChange.reason}
                  onChange={(v) => updateNestedField('coverageChange', 'reason', v)}
                  placeholder="Why is this change being requested?"
                  type="textarea"
                  className="sm:col-span-2"
                />
              </div>
            </FormSection>
            <AgentAssistPanel tips={tips} showTips={showTips} setShowTips={setShowTips} />
          </div>
        );

      // =========================================================================
      // CANCEL POLICY
      // =========================================================================
      case 'cancel_policy':
        return (
          <div className="space-y-6">
            <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-4 border border-red-200 dark:border-red-500/30 flex items-start gap-3">
              <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400 flex-shrink-0" />
              <div>
                <p className="font-medium text-red-800 dark:text-red-300">
                  Important: Cancellation Notice
                </p>
                <p className="text-sm text-red-700 dark:text-red-400 mt-1">
                  Cancelling this policy will end all coverage. Make sure replacement coverage is
                  in place before the cancellation date.
                </p>
              </div>
            </div>

            <FormSection icon={XCircle} title="Policy Cancellation">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <EffectiveDateField />
                <FormSelect
                  label="Reason for Cancellation"
                  value={formData.cancellation.reason}
                  onChange={(v) => updateNestedField('cancellation', 'reason', v)}
                  options={[{ value: '', label: 'Select reason...' }, ...CANCELLATION_REASONS]}
                  required
                />
                <FormField
                  label="Additional Details"
                  value={formData.cancellation.reasonDetails}
                  onChange={(v) => updateNestedField('cancellation', 'reasonDetails', v)}
                  placeholder="Any additional information..."
                  type="textarea"
                  className="sm:col-span-2"
                />
              </div>

              <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                <label className="flex items-center gap-3 cursor-pointer mb-4">
                  <input
                    type="checkbox"
                    checked={formData.cancellation.hasNewCoverage}
                    onChange={(e) =>
                      updateNestedField('cancellation', 'hasNewCoverage', e.target.checked)
                    }
                    className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    Customer has obtained new coverage elsewhere
                  </span>
                </label>
                {formData.cancellation.hasNewCoverage && (
                  <FormField
                    label="New Carrier"
                    value={formData.cancellation.newCarrier}
                    onChange={(v) => updateNestedField('cancellation', 'newCarrier', v)}
                    placeholder="New insurance company name"
                  />
                )}
                <div className="mt-4">
                  <FormSelect
                    label="Refund Method"
                    value={formData.cancellation.refundMethod}
                    onChange={(v) => updateNestedField('cancellation', 'refundMethod', v)}
                    options={[
                      { value: 'check', label: 'Mail Check' },
                      { value: 'ach', label: 'ACH to Bank Account' },
                      { value: 'card', label: 'Credit Card Refund' },
                      { value: 'apply', label: 'Apply to Other Policy' },
                    ]}
                  />
                </div>
              </div>
            </FormSection>
            <AgentAssistPanel tips={tips} showTips={showTips} setShowTips={setShowTips} />
          </div>
        );

      default:
        return (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            <p>Please select a change type first</p>
          </div>
        );
    }
  };

  return <div>{renderForm()}</div>;
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

function FormSection({
  icon: Icon,
  title,
  children,
}: {
  icon: any;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden shadow-sm">
      <div className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
        <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
          <Icon className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
        </div>
        <h3 className="font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

function FormField({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  required,
  error,
  className,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
  error?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {type === 'textarea' ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={cn(
            'w-full px-3 py-2 rounded-lg border transition-colors min-h-[80px]',
            'bg-white text-gray-900',
            error
              ? 'border-red-300 dark:border-red-500'
              : 'border-gray-300 dark:border-gray-600',
            'focus:outline-none focus:ring-2 focus:ring-emerald-500'
          )}
        />
      ) : (
        <Input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={cn(
            'bg-white text-gray-900',
            error
              ? 'border-red-300 dark:border-red-500'
              : 'border-gray-300 dark:border-gray-600'
          )}
        />
      )}
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
}

function FormSelect({
  label,
  value,
  onChange,
  options,
  required,
  error,
  className,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  required?: boolean;
  error?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          'w-full px-3 py-2 rounded-lg border transition-colors',
          'bg-white text-gray-900',
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
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
}

function WarningBox({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-500/30 rounded-lg flex items-start gap-2">
      <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
      <div>
        {title && (
          <p className="text-sm font-medium text-amber-800 dark:text-amber-300">{title}</p>
        )}
        <p className="text-sm text-amber-700 dark:text-amber-400">{children}</p>
      </div>
    </div>
  );
}

function InfoBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-500/30 rounded-lg flex items-start gap-2">
      <Lightbulb className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
      <p className="text-sm text-blue-700 dark:text-blue-400">{children}</p>
    </div>
  );
}

function AgentAssistPanel({
  tips,
  showTips,
  setShowTips,
}: {
  tips: AgentTip[];
  showTips: boolean;
  setShowTips: (show: boolean) => void;
}) {
  const [expandedTip, setExpandedTip] = useState<string | null>(null);

  if (tips.length === 0) return null;

  return (
    <div className="bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 rounded-xl border border-purple-200 dark:border-purple-500/30 overflow-hidden shadow-sm">
      <button
        onClick={() => setShowTips(!showTips)}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-purple-100/50 dark:hover:bg-purple-800/20 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
            <Lightbulb className="w-5 h-5 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <h3 className="font-semibold text-purple-900 dark:text-purple-100">Agent Assist</h3>
            <p className="text-sm text-purple-600 dark:text-purple-400">
              {tips.length} tip{tips.length !== 1 ? 's' : ''} & script{tips.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        {showTips ? (
          <ChevronUp className="w-5 h-5 text-purple-600 dark:text-purple-400" />
        ) : (
          <ChevronDown className="w-5 h-5 text-purple-600 dark:text-purple-400" />
        )}
      </button>

      {showTips && (
        <div className="px-4 pb-4 space-y-3">
          {tips.map((tip) => (
            <div
              key={tip.id}
              className="bg-white dark:bg-gray-900 rounded-lg border border-purple-100 dark:border-purple-800 overflow-hidden"
            >
              <button
                onClick={() => setExpandedTip(expandedTip === tip.id ? null : tip.id)}
                className="w-full flex items-center justify-between p-3 text-left hover:bg-purple-50 dark:hover:bg-purple-900/30 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="text-purple-500">•</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100 text-sm">
                    {tip.title}
                  </span>
                </div>
                {tip.script && (
                  <MessageSquare className="w-4 h-4 text-purple-400" />
                )}
              </button>

              {expandedTip === tip.id && (
                <div className="px-3 pb-3 pt-0 space-y-2 border-t border-purple-100 dark:border-purple-800">
                  <p className="text-sm text-gray-600 dark:text-gray-400 pt-2">{tip.tip}</p>
                  {tip.script && (
                    <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3 mt-2 border border-amber-200 dark:border-amber-700">
                      <p className="text-xs text-amber-700 dark:text-amber-300 font-medium mb-1">
                        Suggested Script:
                      </p>
                      <p className="text-sm text-gray-900 dark:text-gray-100 italic">
                        &quot;{tip.script}&quot;
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default ChangeFormStep;
