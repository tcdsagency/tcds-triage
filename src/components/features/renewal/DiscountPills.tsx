'use client';

import CollapsibleSection from './CollapsibleSection';
import type { CanonicalDiscount } from '@/types/renewal.types';

interface DiscountPillsProps {
  discounts: CanonicalDiscount[];
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

export default function DiscountPills({ discounts }: DiscountPillsProps) {
  if (discounts.length === 0) return null;

  return (
    <CollapsibleSection
      title="Active Discounts"
      badge={`${discounts.length}`}
    >
      <div className="p-4 flex flex-wrap gap-2">
        {discounts.map((d, i) => (
          <span
            key={d.code + i}
            className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
          >
            {d.description || DISCOUNT_LABELS[d.code] || d.code}
          </span>
        ))}
      </div>
    </CollapsibleSection>
  );
}
