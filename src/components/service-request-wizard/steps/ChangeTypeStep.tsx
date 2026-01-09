'use client';

/**
 * Change Type Step
 * ================
 * Select the type of change to make.
 */

import { Car, User, Home, Shield, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useServiceRequestWizard } from '../ServiceRequestWizardProvider';
import { CHANGE_TYPES, CATEGORY_LABELS, getChangeTypesByCategory } from '../config/change-types';
import { ChangeCategory } from '../config/types';

const CATEGORY_ORDER: ChangeCategory[] = ['vehicle', 'driver', 'property', 'coverage', 'admin'];

const CATEGORY_COLORS: Record<ChangeCategory, string> = {
  vehicle: 'amber',
  driver: 'blue',
  property: 'emerald',
  coverage: 'purple',
  admin: 'red',
};

export function ChangeTypeStep() {
  const { selectChangeType, formData, errors } = useServiceRequestWizard();

  return (
    <div className="space-y-6">
      {/* Policy Header */}
      {formData.policy && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-900 dark:text-gray-100">
                  {formData.policy.policyNumber}
                </span>
                <Badge variant="secondary">{formData.policy.type}</Badge>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {formData.policy.insuredName} &bull; {formData.policy.carrier}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Title */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          What would you like to change?
        </h2>
        <p className="text-gray-500 dark:text-gray-400 mt-2">
          Select the type of change you need to make
        </p>
      </div>

      {/* Change Type Categories */}
      <div className="space-y-8">
        {CATEGORY_ORDER.map((category) => {
          const types = getChangeTypesByCategory(category);
          const categoryInfo = CATEGORY_LABELS[category];
          const color = CATEGORY_COLORS[category];

          return (
            <div key={category}>
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3 flex items-center gap-2">
                <categoryInfo.icon className="w-4 h-4" />
                {categoryInfo.label}
              </h3>
              <div
                className={cn(
                  'grid gap-3',
                  types.length <= 2 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 sm:grid-cols-3'
                )}
              >
                {types.map((change) => (
                  <button
                    key={change.id}
                    onClick={() => selectChangeType(change.id)}
                    className={cn(
                      'p-4 rounded-xl border-2 text-left transition-all',
                      'bg-white dark:bg-gray-900',
                      'hover:shadow-md',
                      formData.changeType === change.id
                        ? `border-${color}-500 bg-${color}-50 dark:bg-${color}-900/20`
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600',
                      category === 'admin' && 'border-red-200 hover:border-red-400'
                    )}
                  >
                    <change.icon
                      className={cn(
                        'w-6 h-6 mb-2',
                        category === 'vehicle' && 'text-amber-600 dark:text-amber-400',
                        category === 'driver' && 'text-blue-600 dark:text-blue-400',
                        category === 'property' && 'text-emerald-600 dark:text-emerald-400',
                        category === 'coverage' && 'text-purple-600 dark:text-purple-400',
                        category === 'admin' && 'text-red-600 dark:text-red-400'
                      )}
                    />
                    <h4 className="font-medium text-gray-900 dark:text-gray-100">
                      {change.name}
                    </h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {change.description}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {errors.changeType && (
        <p className="text-sm text-red-600 dark:text-red-400 text-center">{errors.changeType}</p>
      )}
    </div>
  );
}

export default ChangeTypeStep;
