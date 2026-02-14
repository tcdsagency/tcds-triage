'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import CollapsibleSection from './CollapsibleSection';
import type { CanonicalDiscount } from '@/types/renewal.types';

interface DiscountPillsProps {
  discounts: CanonicalDiscount[];
  baselineDiscounts?: CanonicalDiscount[];
}

const DISCOUNT_LABELS: Record<string, string> = {
  accident_free_discount: 'Accident Free',
  eft_discount: 'EFT',
  homeowner_discount: 'Homeowner',
  multi_car_discount: 'Multi-Car',
  multi_policy_discount: 'Multi-Policy',
  continuous_insurance_discount: 'Continuous Insurance',
  safe_driving_discount: 'Safe Driving',
  paperless_discount: 'Paperless',
  claim_free_discount: 'Claim Free',
  paid_in_full_discount: 'Paid In Full',
  renewal_discount: 'Renewal',
  online_discount: 'Online',
  auto_pay_discount: 'Auto Pay',
  loyalty_discount: 'Loyalty',
  protective_devices: 'Protective Devices',
  account_discount: 'Account',
  established_customer: 'Established Customer',
  esmart_discount: 'eSmart',
  bundle_discount: 'Bundle',
  good_driver_discount: 'Good Driver',
  senior_discount: 'Senior',
  defensive_driver_discount: 'Defensive Driver',
  early_signing_discount: 'Early Signing',
};

function discountLabel(d: CanonicalDiscount): string {
  return d.description || DISCOUNT_LABELS[d.code] || d.code || 'Unknown';
}

function normalizeCode(d: CanonicalDiscount): string {
  return (d.code || d.description || '').toLowerCase().trim();
}

export default function DiscountPills({ discounts, baselineDiscounts }: DiscountPillsProps) {
  const { kept, added, removed } = useMemo(() => {
    const renewalCodes = new Set(discounts.map(normalizeCode));
    const baselineCodes = new Set((baselineDiscounts || []).map(normalizeCode));

    const keptItems: CanonicalDiscount[] = [];
    const addedItems: CanonicalDiscount[] = [];
    const removedItems: CanonicalDiscount[] = [];

    for (const d of discounts) {
      const code = normalizeCode(d);
      if (baselineCodes.has(code)) {
        keptItems.push(d);
      } else {
        addedItems.push(d);
      }
    }

    for (const d of (baselineDiscounts || [])) {
      const code = normalizeCode(d);
      if (!renewalCodes.has(code)) {
        removedItems.push(d);
      }
    }

    return { kept: keptItems, added: addedItems, removed: removedItems };
  }, [discounts, baselineDiscounts]);

  const total = kept.length + added.length + removed.length;

  if (total === 0) {
    return (
      <CollapsibleSection title="Discounts" badge="0">
        <div className="p-4">
          <p className="text-sm text-gray-400 dark:text-gray-500 italic">
            No discounts found on this policy.
          </p>
        </div>
      </CollapsibleSection>
    );
  }

  const hasChanges = added.length > 0 || removed.length > 0;

  return (
    <CollapsibleSection
      title="Discounts"
      badge={`${discounts.length}`}
      defaultOpen={hasChanges}
    >
      <div className="p-4 space-y-3">
        {/* Removed discounts */}
        {removed.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase text-red-600 dark:text-red-400 mb-1.5">
              Removed ({removed.length})
            </p>
            <div className="flex flex-wrap gap-2">
              {removed.map((d, i) => (
                <span
                  key={`removed-${normalizeCode(d)}-${i}`}
                  className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 line-through"
                >
                  {discountLabel(d)}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Added discounts */}
        {added.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase text-blue-600 dark:text-blue-400 mb-1.5">
              Added ({added.length})
            </p>
            <div className="flex flex-wrap gap-2">
              {added.map((d, i) => (
                <span
                  key={`added-${normalizeCode(d)}-${i}`}
                  className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                >
                  {discountLabel(d)}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Kept discounts */}
        {kept.length > 0 && (
          <div>
            {hasChanges && (
              <p className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400 mb-1.5">
                Unchanged ({kept.length})
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              {kept.map((d, i) => (
                <span
                  key={`kept-${normalizeCode(d)}-${i}`}
                  className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                >
                  {discountLabel(d)}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </CollapsibleSection>
  );
}
