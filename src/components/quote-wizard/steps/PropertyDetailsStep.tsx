'use client';

/**
 * Property Details Step Component
 * ===============================
 * Collects construction, roof, and system details for home quotes.
 */

import { useQuoteWizard } from '../QuoteWizardProvider';
import { cn } from '@/lib/utils';
import { Wrench, Home, Zap, Shield } from 'lucide-react';

const CONSTRUCTION_TYPES = [
  { value: 'frame', label: 'Wood Frame' },
  { value: 'masonry', label: 'Masonry/Brick' },
  { value: 'masonry_veneer', label: 'Masonry Veneer' },
  { value: 'steel', label: 'Steel Frame' },
  { value: 'log', label: 'Log Home' },
];

const ROOF_MATERIALS = [
  { value: 'asphalt', label: 'Asphalt Shingle' },
  { value: 'metal', label: 'Metal' },
  { value: 'tile', label: 'Tile/Clay' },
  { value: 'slate', label: 'Slate' },
  { value: 'wood', label: 'Wood Shake' },
  { value: 'flat', label: 'Flat/Built-up' },
];

const FOUNDATION_TYPES = [
  { value: 'slab', label: 'Slab' },
  { value: 'crawl', label: 'Crawl Space' },
  { value: 'basement', label: 'Basement' },
  { value: 'pier', label: 'Pier/Post' },
];

const GARAGE_TYPES = [
  { value: 'none', label: 'No Garage' },
  { value: 'attached_1', label: 'Attached 1-Car' },
  { value: 'attached_2', label: 'Attached 2-Car' },
  { value: 'attached_3', label: 'Attached 3+ Car' },
  { value: 'detached_1', label: 'Detached 1-Car' },
  { value: 'detached_2', label: 'Detached 2-Car' },
  { value: 'carport', label: 'Carport' },
];

const HEATING_TYPES = [
  { value: 'central_gas', label: 'Central Gas/Forced Air' },
  { value: 'central_electric', label: 'Central Electric' },
  { value: 'heat_pump', label: 'Heat Pump' },
  { value: 'baseboard', label: 'Electric Baseboard' },
  { value: 'radiant', label: 'Radiant/Floor' },
  { value: 'wood_stove', label: 'Wood Stove' },
  { value: 'none', label: 'None' },
];

const UPDATE_YEARS = [
  { value: 'never', label: 'Original/Never' },
  { value: '0-5', label: 'Within 5 years' },
  { value: '6-10', label: '6-10 years ago' },
  { value: '11-20', label: '11-20 years ago' },
  { value: '20+', label: 'Over 20 years ago' },
];

export function PropertyDetailsStep() {
  const { formData, updateField, errors } = useQuoteWizard();

  return (
    <div className="space-y-8">
      {/* Construction */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Wrench className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
            Construction
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Construction Type <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.constructionType}
              onChange={(e) => updateField('constructionType', e.target.value)}
              className={cn(
                'w-full px-3 py-2 rounded-lg border transition-colors',
                'text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900',
                errors.constructionType
                  ? 'border-red-300 dark:border-red-500'
                  : 'border-gray-300 dark:border-gray-600',
                'focus:outline-none focus:ring-2 focus:ring-emerald-500'
              )}
            >
              <option value="">Select construction type</option>
              {CONSTRUCTION_TYPES.map((type) => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
            {errors.constructionType && (
              <p className="mt-1 text-sm text-red-600">{errors.constructionType}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Foundation Type
            </label>
            <select
              value={formData.foundationType}
              onChange={(e) => updateField('foundationType', e.target.value)}
              className={cn(
                'w-full px-3 py-2 rounded-lg border transition-colors',
                'text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900',
                'border-gray-300 dark:border-gray-600',
                'focus:outline-none focus:ring-2 focus:ring-emerald-500'
              )}
            >
              <option value="">Select foundation</option>
              {FOUNDATION_TYPES.map((type) => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Garage
            </label>
            <select
              value={formData.garageType}
              onChange={(e) => updateField('garageType', e.target.value)}
              className={cn(
                'w-full px-3 py-2 rounded-lg border transition-colors',
                'text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900',
                'border-gray-300 dark:border-gray-600',
                'focus:outline-none focus:ring-2 focus:ring-emerald-500'
              )}
            >
              <option value="">Select garage type</option>
              {GARAGE_TYPES.map((type) => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* Roof */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Home className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
            Roof
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Roof Material <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.roofMaterial}
              onChange={(e) => updateField('roofMaterial', e.target.value)}
              className={cn(
                'w-full px-3 py-2 rounded-lg border transition-colors',
                'text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900',
                errors.roofMaterial
                  ? 'border-red-300 dark:border-red-500'
                  : 'border-gray-300 dark:border-gray-600',
                'focus:outline-none focus:ring-2 focus:ring-emerald-500'
              )}
            >
              <option value="">Select roof material</option>
              {ROOF_MATERIALS.map((type) => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
            {errors.roofMaterial && (
              <p className="mt-1 text-sm text-red-600">{errors.roofMaterial}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Roof Age (Years)
            </label>
            <input
              type="number"
              value={formData.roofAge}
              onChange={(e) => updateField('roofAge', e.target.value)}
              placeholder="e.g., 5"
              min="0"
              max="100"
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

      {/* Systems */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Zap className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
            Systems & Updates
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Heating Type
            </label>
            <select
              value={formData.heatingType}
              onChange={(e) => updateField('heatingType', e.target.value)}
              className={cn(
                'w-full px-3 py-2 rounded-lg border transition-colors',
                'text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900',
                'border-gray-300 dark:border-gray-600',
                'focus:outline-none focus:ring-2 focus:ring-emerald-500'
              )}
            >
              <option value="">Select heating type</option>
              {HEATING_TYPES.map((type) => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Electrical Update
            </label>
            <select
              value={formData.electricalUpdate}
              onChange={(e) => updateField('electricalUpdate', e.target.value)}
              className={cn(
                'w-full px-3 py-2 rounded-lg border transition-colors',
                'text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900',
                'border-gray-300 dark:border-gray-600',
                'focus:outline-none focus:ring-2 focus:ring-emerald-500'
              )}
            >
              <option value="">Select</option>
              {UPDATE_YEARS.map((type) => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Plumbing Update
            </label>
            <select
              value={formData.plumbingUpdate}
              onChange={(e) => updateField('plumbingUpdate', e.target.value)}
              className={cn(
                'w-full px-3 py-2 rounded-lg border transition-colors',
                'text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900',
                'border-gray-300 dark:border-gray-600',
                'focus:outline-none focus:ring-2 focus:ring-emerald-500'
              )}
            >
              <option value="">Select</option>
              {UPDATE_YEARS.map((type) => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* Safety Features */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Shield className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
            Safety Features
          </h3>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.hasSecuritySystem}
              onChange={(e) => updateField('hasSecuritySystem', e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">Security System</span>
          </label>

          {formData.hasSecuritySystem && (
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.securityMonitored}
                onChange={(e) => updateField('securityMonitored', e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">Monitored</span>
            </label>
          )}

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.hasFireAlarm}
              onChange={(e) => updateField('hasFireAlarm', e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">Smoke Detectors</span>
          </label>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.hasSprinklers}
              onChange={(e) => updateField('hasSprinklers', e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">Fire Sprinklers</span>
          </label>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.hasDeadbolts}
              onChange={(e) => updateField('hasDeadbolts', e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">Deadbolt Locks</span>
          </label>
        </div>

        {/* Liability Exposures */}
        <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
          <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-4">
            Liability Exposures
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.hasPool}
                onChange={(e) => updateField('hasPool', e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">Swimming Pool</span>
            </label>

            {formData.hasPool && (
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.poolFenced}
                  onChange={(e) => updateField('poolFenced', e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Pool Fenced</span>
              </label>
            )}

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.hasTrampoline}
                onChange={(e) => updateField('hasTrampoline', e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">Trampoline</span>
            </label>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.hasDog}
                onChange={(e) => updateField('hasDog', e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">Dog</span>
            </label>

            {formData.hasDog && (
              <div className="col-span-2">
                <input
                  type="text"
                  value={formData.dogBreed}
                  onChange={(e) => updateField('dogBreed', e.target.value)}
                  placeholder="Dog breed"
                  className={cn(
                    'w-full px-3 py-2 rounded-lg border transition-colors',
                    'text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900',
                    'border-gray-300 dark:border-gray-600',
                    'focus:outline-none focus:ring-2 focus:ring-emerald-500'
                  )}
                />
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

export default PropertyDetailsStep;
