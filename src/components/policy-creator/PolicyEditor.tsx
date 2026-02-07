'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import {
  ChevronDown,
  ChevronRight,
  Save,
  Download,
  X,
  AlertTriangle,
  Car,
  User,
  Home,
  Building2,
  Shield,
  Trash2,
  Plus,
} from 'lucide-react';
import { ConfidenceBadge } from './ConfidenceBadge';
import type {
  PolicyCreatorDocument,
  CanonicalCoverage,
  CanonicalVehicle,
  CanonicalDriver,
  CanonicalProperty,
  CanonicalMortgagee,
} from '@/types/policy-creator.types';

interface PolicyEditorProps {
  document: PolicyCreatorDocument;
  onSave: (updates: Partial<PolicyCreatorDocument>) => Promise<void>;
  onGenerate: () => Promise<void>;
  onClose: () => void;
  saving: boolean;
  generating: boolean;
}

interface SectionProps {
  title: string;
  icon: typeof Shield;
  defaultOpen?: boolean;
  children: React.ReactNode;
  badge?: React.ReactNode;
}

function Section({ title, icon: Icon, defaultOpen = false, children, badge }: SectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border dark:border-gray-700 rounded-lg overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-gray-500 dark:text-gray-400" />
          <span className="font-medium text-gray-900 dark:text-gray-100">{title}</span>
          {badge}
        </div>
        {isOpen ? (
          <ChevronDown className="w-4 h-4 text-gray-500" />
        ) : (
          <ChevronRight className="w-4 h-4 text-gray-500" />
        )}
      </button>
      {isOpen && <div className="p-4 space-y-4">{children}</div>}
    </div>
  );
}

interface FieldProps {
  label: string;
  value: string | number | null | undefined;
  onChange: (value: string) => void;
  type?: 'text' | 'number' | 'date' | 'select';
  options?: { value: string; label: string }[];
  required?: boolean;
  confidence?: number;
  className?: string;
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  options,
  required,
  confidence,
  className,
}: FieldProps) {
  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-1">
        <label className="block text-xs text-gray-500 dark:text-gray-400">
          {label}
          {required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
        {confidence !== undefined && <ConfidenceBadge confidence={confidence} />}
      </div>
      {type === 'select' && options ? (
        <select
          value={value?.toString() || ''}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-2 py-1.5 border dark:border-gray-600 rounded text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
        >
          <option value="">Select...</option>
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      ) : (
        <input
          type={type}
          value={value?.toString() || ''}
          onChange={(e) => onChange(e.target.value)}
          className={cn(
            'w-full px-2 py-1.5 border dark:border-gray-600 rounded text-sm',
            'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100',
            required && !value && 'border-red-300 dark:border-red-500'
          )}
        />
      )}
    </div>
  );
}

const LOB_OPTIONS = [
  { value: 'Personal Auto', label: 'Personal Auto' },
  { value: 'Homeowners', label: 'Homeowners' },
  { value: 'Dwelling Fire', label: 'Dwelling Fire' },
  { value: 'Renters', label: 'Renters' },
  { value: 'Umbrella', label: 'Umbrella' },
  { value: 'Flood', label: 'Flood' },
  { value: 'Motorcycle', label: 'Motorcycle' },
  { value: 'Recreational Vehicle', label: 'Recreational Vehicle' },
  { value: 'Mobile Home', label: 'Mobile Home' },
  { value: 'Commercial Auto', label: 'Commercial Auto' },
  { value: 'General Liability', label: 'General Liability' },
  { value: 'BOP', label: 'BOP' },
  { value: 'Commercial Property', label: 'Commercial Property' },
  { value: 'Workers Comp', label: 'Workers Comp' },
];

export function PolicyEditor({
  document,
  onSave,
  onGenerate,
  onClose,
  saving,
  generating,
}: PolicyEditorProps) {
  const [editData, setEditData] = useState<Partial<PolicyCreatorDocument>>({ ...document });

  const updateField = (field: keyof PolicyCreatorDocument, value: unknown) => {
    setEditData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    await onSave(editData);
  };

  const isAuto = ['Personal Auto', 'Commercial Auto', 'Motorcycle', 'Recreational Vehicle'].includes(
    editData.lineOfBusiness || ''
  );
  const isHome = ['Homeowners', 'Dwelling Fire', 'Renters', 'Mobile Home'].includes(
    editData.lineOfBusiness || ''
  );

  const overallConfidence = document.confidenceScores?.overall;

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-800 border-l dark:border-gray-700">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b dark:border-gray-700">
        <div>
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">Edit Policy</h3>
          {overallConfidence !== undefined && (
            <ConfidenceBadge confidence={overallConfidence} className="mt-1" />
          )}
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
        >
          <X className="w-5 h-5 text-gray-500" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Error Message */}
        {document.extractionError && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-lg text-sm flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>{document.extractionError}</span>
          </div>
        )}

        {/* Policy Info */}
        <Section title="Policy Info" icon={Shield} defaultOpen>
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Policy Number"
              value={editData.policyNumber}
              onChange={(v) => updateField('policyNumber', v)}
              required
            />
            <Field
              label="Carrier"
              value={editData.carrier}
              onChange={(v) => updateField('carrier', v)}
              required
            />
            <Field
              label="Line of Business"
              value={editData.lineOfBusiness}
              onChange={(v) => updateField('lineOfBusiness', v)}
              type="select"
              options={LOB_OPTIONS}
              required
            />
            <Field
              label="Total Premium"
              value={editData.totalPremium}
              onChange={(v) => updateField('totalPremium', parseFloat(v) || null)}
              type="number"
            />
            <Field
              label="Effective Date"
              value={editData.effectiveDate}
              onChange={(v) => updateField('effectiveDate', v)}
              type="date"
              required
            />
            <Field
              label="Expiration Date"
              value={editData.expirationDate}
              onChange={(v) => updateField('expirationDate', v)}
              type="date"
            />
          </div>
        </Section>

        {/* Insured Info */}
        <Section title="Insured" icon={User} defaultOpen>
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="First Name"
              value={editData.insuredFirstName}
              onChange={(v) => updateField('insuredFirstName', v)}
            />
            <Field
              label="Last Name"
              value={editData.insuredLastName}
              onChange={(v) => updateField('insuredLastName', v)}
            />
            <Field
              label="Full Name / Business"
              value={editData.insuredName}
              onChange={(v) => updateField('insuredName', v)}
              className="col-span-2"
            />
            <Field
              label="Address"
              value={editData.insuredAddress}
              onChange={(v) => updateField('insuredAddress', v)}
              className="col-span-2"
            />
            <Field
              label="City"
              value={editData.insuredCity}
              onChange={(v) => updateField('insuredCity', v)}
            />
            <div className="grid grid-cols-2 gap-2">
              <Field
                label="State"
                value={editData.insuredState}
                onChange={(v) => updateField('insuredState', v)}
              />
              <Field
                label="ZIP"
                value={editData.insuredZip}
                onChange={(v) => updateField('insuredZip', v)}
              />
            </div>
            <Field
              label="Phone"
              value={editData.insuredPhone}
              onChange={(v) => updateField('insuredPhone', v)}
            />
            <Field
              label="Email"
              value={editData.insuredEmail}
              onChange={(v) => updateField('insuredEmail', v)}
            />
          </div>
        </Section>

        {/* Coverages */}
        <Section
          title="Coverages"
          icon={Shield}
          badge={
            <span className="ml-2 px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs rounded">
              {(editData.coverages?.length || 0) +
                (editData.vehicles?.reduce((a, v) => a + (v.coverages?.length || 0), 0) || 0) +
                (editData.properties?.reduce((a, p) => a + (p.coverages?.length || 0), 0) || 0)}
            </span>
          }
        >
          <CoverageTable
            coverages={editData.coverages || []}
            onChange={(coverages) => updateField('coverages', coverages)}
          />
        </Section>

        {/* Vehicles (for Auto) */}
        {isAuto && (
          <Section
            title="Vehicles"
            icon={Car}
            badge={
              <span className="ml-2 px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs rounded">
                {editData.vehicles?.length || 0}
              </span>
            }
          >
            <VehicleList
              vehicles={editData.vehicles || []}
              onChange={(vehicles) => updateField('vehicles', vehicles)}
            />
          </Section>
        )}

        {/* Drivers (for Auto) */}
        {isAuto && (
          <Section
            title="Drivers"
            icon={User}
            badge={
              <span className="ml-2 px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs rounded">
                {editData.drivers?.length || 0}
              </span>
            }
          >
            <DriverList
              drivers={editData.drivers || []}
              onChange={(drivers) => updateField('drivers', drivers)}
            />
          </Section>
        )}

        {/* Properties (for Home) */}
        {isHome && (
          <Section
            title="Properties"
            icon={Home}
            badge={
              <span className="ml-2 px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs rounded">
                {editData.properties?.length || 0}
              </span>
            }
          >
            <PropertyList
              properties={editData.properties || []}
              onChange={(properties) => updateField('properties', properties)}
            />
          </Section>
        )}

        {/* Mortgagees */}
        <Section
          title="Mortgagees / Lienholders"
          icon={Building2}
          badge={
            editData.mortgagees?.length ? (
              <span className="ml-2 px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs rounded">
                {editData.mortgagees.length}
              </span>
            ) : null
          }
        >
          <MortgageeList
            mortgagees={editData.mortgagees || []}
            onChange={(mortgagees) => updateField('mortgagees', mortgagees)}
          />
        </Section>
      </div>

      {/* Footer Actions */}
      <div className="p-4 border-t dark:border-gray-700 space-y-2">
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 py-2 rounded-lg font-medium',
              'bg-blue-600 text-white hover:bg-blue-700',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
        <button
          onClick={onGenerate}
          disabled={generating || document.status === 'error'}
          className={cn(
            'w-full flex items-center justify-center gap-2 py-2 rounded-lg font-medium',
            'bg-green-600 text-white hover:bg-green-700',
            'disabled:opacity-50 disabled:cursor-not-allowed'
          )}
        >
          <Download className="w-4 h-4" />
          {generating ? 'Generating...' : 'Generate AL3-XML'}
        </button>
      </div>
    </div>
  );
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

function CoverageTable({
  coverages,
  onChange,
}: {
  coverages: CanonicalCoverage[];
  onChange: (coverages: CanonicalCoverage[]) => void;
}) {
  const updateCoverage = (index: number, field: keyof CanonicalCoverage, value: unknown) => {
    const updated = [...coverages];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  };

  const removeCoverage = (index: number) => {
    onChange(coverages.filter((_, i) => i !== index));
  };

  const addCoverage = () => {
    onChange([
      ...coverages,
      { id: `cov-new-${Date.now()}`, code: '', type: '', description: '' },
    ]);
  };

  if (coverages.length === 0) {
    return (
      <div className="text-center py-4">
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">No policy-level coverages</p>
        <button
          onClick={addCoverage}
          className="text-sm text-blue-600 hover:underline flex items-center gap-1 mx-auto"
        >
          <Plus className="w-4 h-4" /> Add Coverage
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-gray-500 dark:text-gray-400">
              <th className="text-left pb-2">Code</th>
              <th className="text-left pb-2">Description</th>
              <th className="text-right pb-2">Limit</th>
              <th className="text-right pb-2">Deductible</th>
              <th className="text-right pb-2">Premium</th>
              <th className="w-8"></th>
            </tr>
          </thead>
          <tbody className="divide-y dark:divide-gray-700">
            {coverages.map((cov, i) => (
              <tr key={cov.id || i}>
                <td className="py-1">
                  <input
                    type="text"
                    value={cov.code || ''}
                    onChange={(e) => updateCoverage(i, 'code', e.target.value)}
                    className="w-16 px-1 py-0.5 border dark:border-gray-600 rounded text-xs bg-white dark:bg-gray-700"
                    placeholder="BI"
                  />
                </td>
                <td className="py-1">
                  <input
                    type="text"
                    value={cov.description || ''}
                    onChange={(e) => updateCoverage(i, 'description', e.target.value)}
                    className="w-full px-1 py-0.5 border dark:border-gray-600 rounded text-xs bg-white dark:bg-gray-700"
                    placeholder="Bodily Injury"
                  />
                </td>
                <td className="py-1 text-right">
                  <input
                    type="number"
                    value={cov.limit || ''}
                    onChange={(e) => updateCoverage(i, 'limit', parseFloat(e.target.value) || null)}
                    className="w-24 px-1 py-0.5 border dark:border-gray-600 rounded text-xs text-right bg-white dark:bg-gray-700"
                  />
                </td>
                <td className="py-1 text-right">
                  <input
                    type="number"
                    value={cov.deductible || ''}
                    onChange={(e) => updateCoverage(i, 'deductible', parseFloat(e.target.value) || null)}
                    className="w-20 px-1 py-0.5 border dark:border-gray-600 rounded text-xs text-right bg-white dark:bg-gray-700"
                  />
                </td>
                <td className="py-1 text-right">
                  <input
                    type="number"
                    value={cov.premium || ''}
                    onChange={(e) => updateCoverage(i, 'premium', parseFloat(e.target.value) || null)}
                    className="w-20 px-1 py-0.5 border dark:border-gray-600 rounded text-xs text-right bg-white dark:bg-gray-700"
                  />
                </td>
                <td>
                  <button
                    onClick={() => removeCoverage(i)}
                    className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button
        onClick={addCoverage}
        className="text-sm text-blue-600 hover:underline flex items-center gap-1"
      >
        <Plus className="w-4 h-4" /> Add Coverage
      </button>
    </div>
  );
}

function VehicleList({
  vehicles,
  onChange,
}: {
  vehicles: CanonicalVehicle[];
  onChange: (vehicles: CanonicalVehicle[]) => void;
}) {
  const updateVehicle = (index: number, updates: Partial<CanonicalVehicle>) => {
    const updated = [...vehicles];
    updated[index] = { ...updated[index], ...updates };
    onChange(updated);
  };

  const removeVehicle = (index: number) => {
    onChange(vehicles.filter((_, i) => i !== index));
  };

  const addVehicle = () => {
    onChange([
      ...vehicles,
      { id: `veh-new-${Date.now()}`, number: vehicles.length + 1 },
    ]);
  };

  if (vehicles.length === 0) {
    return (
      <div className="text-center py-4">
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">No vehicles</p>
        <button
          onClick={addVehicle}
          className="text-sm text-blue-600 hover:underline flex items-center gap-1 mx-auto"
        >
          <Plus className="w-4 h-4" /> Add Vehicle
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {vehicles.map((veh, i) => (
        <div key={veh.id || i} className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
          <div className="flex justify-between items-start mb-2">
            <div className="font-medium text-gray-900 dark:text-gray-100">
              Vehicle {veh.number || i + 1}
              {veh.year && veh.make && veh.model && (
                <span className="ml-2 font-normal text-gray-500">
                  {veh.year} {veh.make} {veh.model}
                </span>
              )}
            </div>
            <button
              onClick={() => removeVehicle(i)}
              className="p-1 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/20 rounded"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-4 gap-2">
            <input
              type="number"
              value={veh.year || ''}
              onChange={(e) => updateVehicle(i, { year: parseInt(e.target.value) || undefined })}
              placeholder="Year"
              className="px-2 py-1 border dark:border-gray-600 rounded text-sm bg-white dark:bg-gray-700"
            />
            <input
              type="text"
              value={veh.make || ''}
              onChange={(e) => updateVehicle(i, { make: e.target.value })}
              placeholder="Make"
              className="px-2 py-1 border dark:border-gray-600 rounded text-sm bg-white dark:bg-gray-700"
            />
            <input
              type="text"
              value={veh.model || ''}
              onChange={(e) => updateVehicle(i, { model: e.target.value })}
              placeholder="Model"
              className="px-2 py-1 border dark:border-gray-600 rounded text-sm bg-white dark:bg-gray-700"
            />
            <input
              type="text"
              value={veh.vin || ''}
              onChange={(e) => updateVehicle(i, { vin: e.target.value.toUpperCase() })}
              placeholder="VIN"
              className="px-2 py-1 border dark:border-gray-600 rounded text-sm bg-white dark:bg-gray-700"
            />
          </div>
          {veh.coverages && veh.coverages.length > 0 && (
            <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              {veh.coverages.length} coverage(s)
            </div>
          )}
        </div>
      ))}
      <button
        onClick={addVehicle}
        className="text-sm text-blue-600 hover:underline flex items-center gap-1"
      >
        <Plus className="w-4 h-4" /> Add Vehicle
      </button>
    </div>
  );
}

function DriverList({
  drivers,
  onChange,
}: {
  drivers: CanonicalDriver[];
  onChange: (drivers: CanonicalDriver[]) => void;
}) {
  const updateDriver = (index: number, updates: Partial<CanonicalDriver>) => {
    const updated = [...drivers];
    updated[index] = { ...updated[index], ...updates };
    onChange(updated);
  };

  const removeDriver = (index: number) => {
    onChange(drivers.filter((_, i) => i !== index));
  };

  const addDriver = () => {
    onChange([
      ...drivers,
      { id: `drv-new-${Date.now()}`, number: drivers.length + 1 },
    ]);
  };

  if (drivers.length === 0) {
    return (
      <div className="text-center py-4">
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">No drivers</p>
        <button
          onClick={addDriver}
          className="text-sm text-blue-600 hover:underline flex items-center gap-1 mx-auto"
        >
          <Plus className="w-4 h-4" /> Add Driver
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {drivers.map((drv, i) => (
        <div key={drv.id || i} className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
          <div className="flex justify-between items-start mb-2">
            <div className="font-medium text-gray-900 dark:text-gray-100">
              Driver {drv.number || i + 1}
              {drv.firstName && drv.lastName && (
                <span className="ml-2 font-normal text-gray-500">
                  {drv.firstName} {drv.lastName}
                </span>
              )}
            </div>
            <button
              onClick={() => removeDriver(i)}
              className="p-1 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/20 rounded"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <input
              type="text"
              value={drv.firstName || ''}
              onChange={(e) => updateDriver(i, { firstName: e.target.value })}
              placeholder="First Name"
              className="px-2 py-1 border dark:border-gray-600 rounded text-sm bg-white dark:bg-gray-700"
            />
            <input
              type="text"
              value={drv.lastName || ''}
              onChange={(e) => updateDriver(i, { lastName: e.target.value })}
              placeholder="Last Name"
              className="px-2 py-1 border dark:border-gray-600 rounded text-sm bg-white dark:bg-gray-700"
            />
            <input
              type="date"
              value={drv.dateOfBirth || ''}
              onChange={(e) => updateDriver(i, { dateOfBirth: e.target.value })}
              className="px-2 py-1 border dark:border-gray-600 rounded text-sm bg-white dark:bg-gray-700"
            />
          </div>
        </div>
      ))}
      <button
        onClick={addDriver}
        className="text-sm text-blue-600 hover:underline flex items-center gap-1"
      >
        <Plus className="w-4 h-4" /> Add Driver
      </button>
    </div>
  );
}

function PropertyList({
  properties,
  onChange,
}: {
  properties: CanonicalProperty[];
  onChange: (properties: CanonicalProperty[]) => void;
}) {
  const updateProperty = (index: number, updates: Partial<CanonicalProperty>) => {
    const updated = [...properties];
    updated[index] = { ...updated[index], ...updates };
    onChange(updated);
  };

  const removeProperty = (index: number) => {
    onChange(properties.filter((_, i) => i !== index));
  };

  const addProperty = () => {
    onChange([
      ...properties,
      { id: `prop-new-${Date.now()}`, number: properties.length + 1 },
    ]);
  };

  if (properties.length === 0) {
    return (
      <div className="text-center py-4">
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">No properties</p>
        <button
          onClick={addProperty}
          className="text-sm text-blue-600 hover:underline flex items-center gap-1 mx-auto"
        >
          <Plus className="w-4 h-4" /> Add Property
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {properties.map((prop, i) => (
        <div key={prop.id || i} className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
          <div className="flex justify-between items-start mb-2">
            <div className="font-medium text-gray-900 dark:text-gray-100">
              Property {prop.number || i + 1}
              {prop.address && (
                <span className="ml-2 font-normal text-gray-500">{prop.address}</span>
              )}
            </div>
            <button
              onClick={() => removeProperty(i)}
              className="p-1 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/20 rounded"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              value={prop.address || ''}
              onChange={(e) => updateProperty(i, { address: e.target.value })}
              placeholder="Address"
              className="col-span-2 px-2 py-1 border dark:border-gray-600 rounded text-sm bg-white dark:bg-gray-700"
            />
            <input
              type="text"
              value={prop.city || ''}
              onChange={(e) => updateProperty(i, { city: e.target.value })}
              placeholder="City"
              className="px-2 py-1 border dark:border-gray-600 rounded text-sm bg-white dark:bg-gray-700"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                value={prop.state || ''}
                onChange={(e) => updateProperty(i, { state: e.target.value })}
                placeholder="State"
                className="px-2 py-1 border dark:border-gray-600 rounded text-sm bg-white dark:bg-gray-700"
              />
              <input
                type="text"
                value={prop.zip || ''}
                onChange={(e) => updateProperty(i, { zip: e.target.value })}
                placeholder="ZIP"
                className="px-2 py-1 border dark:border-gray-600 rounded text-sm bg-white dark:bg-gray-700"
              />
            </div>
          </div>
          {prop.coverages && prop.coverages.length > 0 && (
            <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              {prop.coverages.length} coverage(s)
            </div>
          )}
        </div>
      ))}
      <button
        onClick={addProperty}
        className="text-sm text-blue-600 hover:underline flex items-center gap-1"
      >
        <Plus className="w-4 h-4" /> Add Property
      </button>
    </div>
  );
}

function MortgageeList({
  mortgagees,
  onChange,
}: {
  mortgagees: CanonicalMortgagee[];
  onChange: (mortgagees: CanonicalMortgagee[]) => void;
}) {
  const updateMortgagee = (index: number, updates: Partial<CanonicalMortgagee>) => {
    const updated = [...mortgagees];
    updated[index] = { ...updated[index], ...updates };
    onChange(updated);
  };

  const removeMortgagee = (index: number) => {
    onChange(mortgagees.filter((_, i) => i !== index));
  };

  const addMortgagee = () => {
    onChange([
      ...mortgagees,
      { id: `mort-new-${Date.now()}`, number: mortgagees.length + 1, interestType: 'MG', name: '' },
    ]);
  };

  if (mortgagees.length === 0) {
    return (
      <div className="text-center py-4">
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">No mortgagees or lienholders</p>
        <button
          onClick={addMortgagee}
          className="text-sm text-blue-600 hover:underline flex items-center gap-1 mx-auto"
        >
          <Plus className="w-4 h-4" /> Add Mortgagee
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {mortgagees.map((mort, i) => (
        <div key={mort.id || i} className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
          <div className="flex justify-between items-start mb-2">
            <div className="font-medium text-gray-900 dark:text-gray-100">{mort.name || 'New Mortgagee'}</div>
            <button
              onClick={() => removeMortgagee(i)}
              className="p-1 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/20 rounded"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <select
              value={mort.interestType}
              onChange={(e) => updateMortgagee(i, { interestType: e.target.value as 'MG' | 'LH' | 'LP' | 'AI' })}
              className="px-2 py-1 border dark:border-gray-600 rounded text-sm bg-white dark:bg-gray-700"
            >
              <option value="MG">Mortgagee</option>
              <option value="LH">Lienholder</option>
              <option value="LP">Loss Payee</option>
              <option value="AI">Additional Insured</option>
            </select>
            <input
              type="text"
              value={mort.loanNumber || ''}
              onChange={(e) => updateMortgagee(i, { loanNumber: e.target.value })}
              placeholder="Loan #"
              className="px-2 py-1 border dark:border-gray-600 rounded text-sm bg-white dark:bg-gray-700"
            />
            <input
              type="text"
              value={mort.name}
              onChange={(e) => updateMortgagee(i, { name: e.target.value })}
              placeholder="Name"
              className="col-span-2 px-2 py-1 border dark:border-gray-600 rounded text-sm bg-white dark:bg-gray-700"
            />
          </div>
        </div>
      ))}
      <button
        onClick={addMortgagee}
        className="text-sm text-blue-600 hover:underline flex items-center gap-1"
      >
        <Plus className="w-4 h-4" /> Add Mortgagee
      </button>
    </div>
  );
}
