'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronRight, AlertTriangle } from 'lucide-react';
import type { RenewalSnapshot, BaselineSnapshot, MaterialChange, CanonicalCoverage, CanonicalVehicle, CanonicalDiscount, CanonicalClaim, PropertyContext } from '@/types/renewal.types';

// Human-readable labels for coverage types (fallback when description is a raw code)
const COVERAGE_TYPE_LABELS: Record<string, string> = {
  dwelling: 'Dwelling',
  personal_property: 'Personal Property',
  personal_liability: 'Personal Liability',
  medical_payments: 'Medical Payments',
  medical_payments_to_others: 'Medical Payments to Others',
  other_structures: 'Other Structures',
  loss_of_use: 'Loss of Use',
  water_damage: 'Water Damage',
  tropical_cyclone: 'Tropical Cyclone',
  identity_fraud: 'Identity Fraud',
  roof_surfaces: 'Roof Surfaces',
  building_structures_extended: 'Extended Replacement Cost',
  responsible_payment_discount: 'Responsible Payment Discount',
  loyalty_discount: 'Loyalty Discount',
  protective_devices: 'Protective Devices',
  welcome_discount: 'Welcome Discount',
  bodily_injury: 'Bodily Injury',
  property_damage: 'Property Damage',
  collision: 'Collision',
  comprehensive: 'Comprehensive',
  uninsured_motorist: 'Uninsured Motorist',
  uninsured_motorist_bi: 'Uninsured Motorist BI',
  uninsured_motorist_pd: 'Uninsured Motorist PD',
  underinsured_motorist: 'Underinsured Motorist',
  rental_reimbursement: 'Rental Reimbursement',
  towing: 'Towing/Roadside',
  roadside_assistance: 'Roadside Assistance',
  pip: 'Personal Injury Protection',
  personal_injury_protection: 'Personal Injury Protection',
  med_pay: 'Medical Payments',
  combined_single_limit: 'Combined Single Limit',
  gap_coverage: 'GAP Coverage',
  extended_dwelling: 'Extended Dwelling',
  personal_property_replacement: 'Personal Property Replacement',
  sewer_water_backup: 'Sewer/Water Backup',
  equipment_breakdown: 'Equipment Breakdown',
  roof_replacement_cost: 'Roof Replacement Cost',
  additional_insured: 'Additional Insured',
  additional_coverage_a: 'Additional Coverage A',
  early_signing_discount: 'Early Signing Discount',
  esmart_discount: 'eSmart Discount',
  account_discount: 'Account Discount',
  established_customer: 'Established Customer',
  // Progressive discount types
  accident_free_discount: 'Accident Free Discount',
  eft_discount: 'EFT Discount',
  homeowner_discount: 'Homeowner Discount',
  multi_car_discount: 'Multi-Car Discount',
  multi_policy_discount: 'Multi-Policy Discount',
  continuous_insurance_discount: 'Continuous Insurance Discount',
  safe_driving_discount: 'Safe Driving Discount',
  paperless_discount: 'Paperless Discount',
  claim_free_discount: 'Claim Free Discount',
  auto_pay_discount: 'Auto Pay Discount',
  mobile_home_discount: 'Mobile Home Discount',
  senior_discount: 'Senior Discount',
  good_driver_discount: 'Good Driver Discount',
  defensive_driver_discount: 'Defensive Driver Discount',
  association_discount: 'Association Discount',
  bundle_discount: 'Bundle Discount',
};

interface ComparisonTableProps {
  renewalSnapshot: RenewalSnapshot | null;
  baselineSnapshot: BaselineSnapshot | null;
  materialChanges: MaterialChange[];
}

export default function ComparisonTable({
  renewalSnapshot,
  baselineSnapshot,
  materialChanges,
}: ComparisonTableProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['premium', 'coverages']));

  const toggleSection = (section: string) => {
    const next = new Set(expandedSections);
    if (next.has(section)) next.delete(section);
    else next.add(section);
    setExpandedSections(next);
  };

  if (!renewalSnapshot && !baselineSnapshot) {
    return (
      <div className="text-sm text-gray-500 dark:text-gray-400 py-4 text-center">
        No comparison data available
      </div>
    );
  }

  const materialByField = new Map(materialChanges.map((c) => [c.field, c]));

  const formatCurrency = (val: number | undefined | null) =>
    val != null ? `$${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-';

  return (
    <div className="space-y-1">
      {/* Premium Section */}
      <SectionHeader
        title="Premium"
        expanded={expandedSections.has('premium')}
        onToggle={() => toggleSection('premium')}
        hasMaterial={materialChanges.some((c) => c.category === 'premium' && c.severity === 'material_negative')}
      />
      {expandedSections.has('premium') && (
        <div className="border border-gray-200 dark:border-gray-700 rounded-md overflow-hidden">
          <ComparisonRow
            label="Total Premium"
            current={formatCurrency(baselineSnapshot?.premium)}
            renewal={formatCurrency(renewalSnapshot?.premium)}
            change={getChangeType(materialByField.get('premium'))}
            isMaterial={materialByField.has('premium')}
          />
        </div>
      )}

      {/* Coverages Section */}
      <SectionHeader
        title="Coverages"
        expanded={expandedSections.has('coverages')}
        onToggle={() => toggleSection('coverages')}
        hasMaterial={materialChanges.some((c) =>
          ['coverage_limit', 'coverage_removed', 'coverage_added', 'deductible'].includes(c.category) &&
          c.severity === 'material_negative'
        )}
      />
      {expandedSections.has('coverages') && (
        <div className="border border-gray-200 dark:border-gray-700 rounded-md overflow-hidden">
          {renderCoverageComparison(baselineSnapshot?.coverages, renewalSnapshot?.coverages, materialByField)}
        </div>
      )}

      {/* Vehicles Section */}
      <SectionHeader
        title="Vehicles"
        expanded={expandedSections.has('vehicles')}
        onToggle={() => toggleSection('vehicles')}
        hasMaterial={materialChanges.some((c) =>
          ['vehicle_removed', 'vehicle_added'].includes(c.category) && c.severity === 'material_negative'
        )}
      />
      {expandedSections.has('vehicles') && (
        <div className="border border-gray-200 dark:border-gray-700 rounded-md overflow-hidden">
          {renderVehicleComparison(baselineSnapshot?.vehicles, renewalSnapshot?.vehicles, materialByField)}
        </div>
      )}

      {/* Deductibles Section */}
      <SectionHeader
        title="Deductibles"
        expanded={expandedSections.has('deductibles')}
        onToggle={() => toggleSection('deductibles')}
        hasMaterial={materialChanges.some((c) => c.category === 'deductible' && c.severity === 'material_negative')}
      />
      {expandedSections.has('deductibles') && (
        <div className="border border-gray-200 dark:border-gray-700 rounded-md overflow-hidden">
          {renderDeductibleComparison(baselineSnapshot?.coverages, renewalSnapshot?.coverages, materialByField)}
        </div>
      )}

      {/* Discounts Section */}
      <SectionHeader
        title="Discounts"
        expanded={expandedSections.has('discounts')}
        onToggle={() => toggleSection('discounts')}
        hasMaterial={materialChanges.some((c) =>
          ['discount_removed', 'discount_added'].includes(c.category) && c.severity === 'material_negative'
        )}
      />
      {expandedSections.has('discounts') && (
        <div className="border border-gray-200 dark:border-gray-700 rounded-md overflow-hidden">
          {renderDiscountComparison(baselineSnapshot?.discounts, renewalSnapshot?.discounts, materialByField)}
        </div>
      )}

      {/* Claims Section */}
      {(renewalSnapshot?.claims?.length || baselineSnapshot?.claims?.length) ? (
        <>
          <SectionHeader
            title="Claims"
            expanded={expandedSections.has('claims')}
            onToggle={() => toggleSection('claims')}
            hasMaterial={materialChanges.some((c) => c.category === 'claim' && c.severity === 'material_negative')}
          />
          {expandedSections.has('claims') && (
            <div className="border border-gray-200 dark:border-gray-700 rounded-md overflow-hidden">
              {renderClaimsSection(baselineSnapshot?.claims, renewalSnapshot?.claims, materialChanges)}
            </div>
          )}
        </>
      ) : null}

      {/* Property Section (homeowners) */}
      {baselineSnapshot?.propertyContext ? (
        <>
          <SectionHeader
            title="Property"
            expanded={expandedSections.has('property')}
            onToggle={() => toggleSection('property')}
            hasMaterial={materialChanges.some((c) => c.category === 'property' && c.severity === 'material_negative')}
          />
          {expandedSections.has('property') && (
            <div className="border border-gray-200 dark:border-gray-700 rounded-md overflow-hidden">
              {renderPropertySection(baselineSnapshot.propertyContext, materialChanges)}
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

function SectionHeader({
  title,
  expanded,
  onToggle,
  hasMaterial,
}: {
  title: string;
  expanded: boolean;
  onToggle: () => void;
  hasMaterial: boolean;
}) {
  return (
    <button
      onClick={onToggle}
      className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-900/50 rounded-md hover:bg-gray-100 dark:hover:bg-gray-900/80 transition-colors"
    >
      <div className="flex items-center gap-2">
        {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{title}</span>
      </div>
      {hasMaterial && <AlertTriangle className="h-4 w-4 text-red-500" />}
    </button>
  );
}

function ComparisonRow({
  label,
  current,
  renewal,
  change,
  isMaterial,
}: {
  label: string;
  current: string;
  renewal: string;
  change?: 'better' | 'worse' | 'same' | 'different';
  isMaterial?: boolean;
}) {
  const rowColor =
    change === 'better'
      ? 'bg-green-50/50 dark:bg-green-900/10'
      : change === 'worse'
        ? 'bg-red-50/50 dark:bg-red-900/10'
        : change === 'different'
          ? 'bg-yellow-50/50 dark:bg-yellow-900/10'
          : '';

  return (
    <div
      className={cn(
        'grid grid-cols-[1fr_1fr_1fr] gap-2 px-3 py-2 border-b border-gray-100 dark:border-gray-800 last:border-b-0 text-sm',
        rowColor
      )}
    >
      <div className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
        {isMaterial && <AlertTriangle className="h-3 w-3 text-red-500 shrink-0" />}
        <span className="truncate">{label}</span>
      </div>
      <div className="text-gray-900 dark:text-gray-100">{current}</div>
      <div className={cn(
        'font-medium',
        change === 'better' ? 'text-green-600 dark:text-green-400' :
        change === 'worse' ? 'text-red-600 dark:text-red-400' :
        'text-gray-900 dark:text-gray-100'
      )}>
        {renewal}
      </div>
    </div>
  );
}

// =============================================================================
// RENDER HELPERS
// =============================================================================

function getChangeType(change?: MaterialChange): 'better' | 'worse' | 'same' | 'different' | undefined {
  if (!change) return undefined;
  if (change.severity === 'material_positive') return 'better';
  if (change.severity === 'material_negative') return 'worse';
  return 'different';
}

function formatLimit(cov: CanonicalCoverage | undefined): string {
  if (!cov) return 'N/A';
  if (cov.limitAmount != null) return `$${cov.limitAmount.toLocaleString()}`;
  if (cov.limit) {
    // Try to parse zero-padded limit string
    const cleaned = cov.limit.replace(/^0+/, '') || '0';
    const num = parseInt(cleaned, 10);
    if (!isNaN(num) && num > 0) return `$${num.toLocaleString()}`;
    return cov.limit;
  }
  return '-';
}

function renderCoverageComparison(
  baseline: CanonicalCoverage[] | undefined,
  renewal: CanonicalCoverage[] | undefined,
  materialByField: Map<string, MaterialChange>
) {
  // Build unique coverage entries using type+description to handle duplicates
  interface CovEntry { key: string; type: string; baseline?: CanonicalCoverage; renewal?: CanonicalCoverage; }
  const entries: CovEntry[] = [];
  const entryMap = new Map<string, CovEntry>();

  const getKey = (c: CanonicalCoverage) => {
    // Use type + description to disambiguate (e.g., two personal_property with different descriptions)
    const desc = c.description || '';
    return `${c.type}::${desc}`;
  };

  baseline?.forEach((c) => {
    const key = getKey(c);
    const existing = entryMap.get(key);
    if (existing) {
      existing.baseline = c;
    } else {
      const entry: CovEntry = { key, type: c.type, baseline: c };
      entryMap.set(key, entry);
      entries.push(entry);
    }
  });

  renewal?.forEach((c) => {
    const key = getKey(c);
    const existing = entryMap.get(key);
    if (existing) {
      existing.renewal = c;
    } else {
      const entry: CovEntry = { key, type: c.type, renewal: c };
      entryMap.set(key, entry);
      entries.push(entry);
    }
  });

  if (entries.length === 0) {
    return <div className="px-3 py-2 text-sm text-gray-500">No coverage data</div>;
  }

  return (
    <>
      <div className="grid grid-cols-[1fr_1fr_1fr] gap-2 px-3 py-1.5 bg-gray-100 dark:bg-gray-800 text-xs font-medium text-gray-500 dark:text-gray-400">
        <div>Coverage</div>
        <div>Current Limit</div>
        <div>Renewal Limit</div>
      </div>
      {entries.map((entry) => {
        const { baseline: b, renewal: r, type } = entry;
        const mc = materialByField.get(`coverage.${type}`) || materialByField.get(`coverage.${type}.limit`);

        // Use description, but fall back to type label if description is a short raw code
        const rawDesc = b?.description || r?.description || '';
        const isRawCode = rawDesc.length <= 6 && /^[A-Z]+$/.test(rawDesc);
        const label = isRawCode ? (COVERAGE_TYPE_LABELS[type] || rawDesc || type) : (rawDesc || COVERAGE_TYPE_LABELS[type] || type);

        return (
          <ComparisonRow
            key={entry.key}
            label={label}
            current={b ? formatLimit(b) : 'N/A'}
            renewal={r ? formatLimit(r) : 'REMOVED'}
            change={!r ? 'worse' : !b ? 'better' : getChangeType(mc)}
            isMaterial={mc?.severity === 'material_negative'}
          />
        );
      })}
    </>
  );
}

function renderVehicleComparison(
  baseline: CanonicalVehicle[] | undefined,
  renewal: CanonicalVehicle[] | undefined,
  materialByField: Map<string, MaterialChange>
) {
  const allVins = new Set<string>();
  baseline?.forEach((v) => v.vin && allVins.add(v.vin));
  renewal?.forEach((v) => v.vin && allVins.add(v.vin));

  if (allVins.size === 0 && !baseline?.length && !renewal?.length) {
    return <div className="px-3 py-2 text-sm text-gray-500">No vehicle data</div>;
  }

  const baselineByVin = new Map(baseline?.filter((v) => v.vin).map((v) => [v.vin!, v]) || []);
  const renewalByVin = new Map(renewal?.filter((v) => v.vin).map((v) => [v.vin!, v]) || []);

  return (
    <>
      <div className="grid grid-cols-[1fr_1fr_1fr] gap-2 px-3 py-1.5 bg-gray-100 dark:bg-gray-800 text-xs font-medium text-gray-500 dark:text-gray-400">
        <div>Vehicle</div>
        <div>Current</div>
        <div>Renewal</div>
      </div>
      {Array.from(allVins).map((vin) => {
        const b = baselineByVin.get(vin);
        const r = renewalByVin.get(vin);
        const desc = (v: CanonicalVehicle | undefined) =>
          v ? `${v.year || ''} ${v.make || ''} ${v.model || ''}`.trim() || vin : 'N/A';
        const mc = materialByField.get(`vehicle.${vin}`);

        return (
          <ComparisonRow
            key={vin}
            label={desc(b || r)}
            current={b ? 'Present' : 'N/A'}
            renewal={r ? 'Present' : 'REMOVED'}
            change={!r ? 'worse' : !b ? 'better' : 'same'}
            isMaterial={mc?.severity === 'material_negative'}
          />
        );
      })}
    </>
  );
}

function renderDeductibleComparison(
  baseline: CanonicalCoverage[] | undefined,
  renewal: CanonicalCoverage[] | undefined,
  materialByField: Map<string, MaterialChange>
) {
  const formatDed = (val: number | undefined) => val != null ? `$${val.toLocaleString()}` : '-';

  // Collect coverages that have deductibles, handling duplicates
  interface DedEntry { key: string; type: string; baseline?: CanonicalCoverage; renewal?: CanonicalCoverage; }
  const entries: DedEntry[] = [];
  const entryMap = new Map<string, DedEntry>();

  const getKey = (c: CanonicalCoverage) => `${c.type}::${c.description || ''}`;

  baseline?.filter((c) => c.deductibleAmount != null).forEach((c) => {
    const key = getKey(c);
    if (!entryMap.has(key)) {
      const entry: DedEntry = { key, type: c.type, baseline: c };
      entryMap.set(key, entry);
      entries.push(entry);
    }
  });

  renewal?.filter((c) => c.deductibleAmount != null).forEach((c) => {
    const key = getKey(c);
    const existing = entryMap.get(key);
    if (existing) {
      existing.renewal = c;
    } else {
      const entry: DedEntry = { key, type: c.type, renewal: c };
      entryMap.set(key, entry);
      entries.push(entry);
    }
  });

  if (entries.length === 0) {
    return <div className="px-3 py-2 text-sm text-gray-500">No deductible data</div>;
  }

  return (
    <>
      <div className="grid grid-cols-[1fr_1fr_1fr] gap-2 px-3 py-1.5 bg-gray-100 dark:bg-gray-800 text-xs font-medium text-gray-500 dark:text-gray-400">
        <div>Coverage</div>
        <div>Current Ded.</div>
        <div>Renewal Ded.</div>
      </div>
      {entries.map((entry) => {
        const { baseline: b, renewal: r, type } = entry;
        const mc = materialByField.get(`coverage.${type}.deductible`);

        return (
          <ComparisonRow
            key={entry.key}
            label={(() => {
              const rawDesc = b?.description || r?.description || '';
              const isRawCode = rawDesc.length <= 6 && /^[A-Z]+$/.test(rawDesc);
              return isRawCode ? (COVERAGE_TYPE_LABELS[type] || rawDesc || type) : (rawDesc || COVERAGE_TYPE_LABELS[type] || type);
            })()}
            current={formatDed(b?.deductibleAmount)}
            renewal={formatDed(r?.deductibleAmount)}
            change={getChangeType(mc)}
            isMaterial={mc?.severity === 'material_negative'}
          />
        );
      })}
    </>
  );
}

function renderDiscountComparison(
  baseline: CanonicalDiscount[] | undefined,
  renewal: CanonicalDiscount[] | undefined,
  materialByField: Map<string, MaterialChange>
) {
  const allCodes = new Set<string>();
  baseline?.forEach((d) => allCodes.add(d.code.toUpperCase()));
  renewal?.forEach((d) => allCodes.add(d.code.toUpperCase()));

  if (allCodes.size === 0 && !baseline?.length && !renewal?.length) {
    return <div className="px-3 py-2 text-sm text-gray-500">No discount data</div>;
  }

  const baselineByCode = new Map(baseline?.map((d) => [d.code.toUpperCase(), d]) || []);
  const renewalByCode = new Map(renewal?.map((d) => [d.code.toUpperCase(), d]) || []);

  return (
    <>
      <div className="grid grid-cols-[1fr_1fr_1fr] gap-2 px-3 py-1.5 bg-gray-100 dark:bg-gray-800 text-xs font-medium text-gray-500 dark:text-gray-400">
        <div>Discount</div>
        <div>Current</div>
        <div>Renewal</div>
      </div>
      {Array.from(allCodes).map((code) => {
        const b = baselineByCode.get(code);
        const r = renewalByCode.get(code);
        const mc = materialByField.get(`discount.${code}`);

        return (
          <ComparisonRow
            key={code}
            label={b?.description || r?.description || COVERAGE_TYPE_LABELS[code.toLowerCase()] || code}
            current={b ? (b.percent ? `${b.percent}%` : b.amount ? `$${b.amount}` : 'Applied') : 'N/A'}
            renewal={r ? (r.percent ? `${r.percent}%` : r.amount ? `$${r.amount}` : 'Applied') : 'REMOVED'}
            change={!r ? 'worse' : !b ? 'better' : 'same'}
            isMaterial={mc?.severity === 'material_negative'}
          />
        );
      })}
    </>
  );
}

function renderClaimsSection(
  baseline: CanonicalClaim[] | undefined,
  renewal: CanonicalClaim[] | undefined,
  materialChanges: MaterialChange[]
) {
  const allClaims = [...(baseline || []), ...(renewal || [])];
  const claimChanges = materialChanges.filter((c) => c.category === 'claim');

  if (allClaims.length === 0 && claimChanges.length === 0) {
    return <div className="px-3 py-2 text-sm text-gray-500">No claims data</div>;
  }

  return (
    <>
      <div className="grid grid-cols-[1fr_1fr_1fr] gap-2 px-3 py-1.5 bg-gray-100 dark:bg-gray-800 text-xs font-medium text-gray-500 dark:text-gray-400">
        <div>Claim</div>
        <div>Date</div>
        <div>Status</div>
      </div>
      {allClaims.map((claim, idx) => {
        const isNew = claimChanges.some(
          (c) => c.field === `claim.${claim.claimNumber || 'new'}`
        );
        return (
          <ComparisonRow
            key={claim.claimNumber || `claim-${idx}`}
            label={claim.claimType || claim.claimNumber || 'Claim'}
            current={claim.claimDate || '-'}
            renewal={claim.status || (claim.amount != null ? `$${claim.amount.toLocaleString()}` : '-')}
            change={isNew ? 'worse' : 'same'}
            isMaterial={isNew}
          />
        );
      })}
    </>
  );
}

function renderPropertySection(
  propertyContext: PropertyContext,
  materialChanges: MaterialChange[]
) {
  const propertyChanges = materialChanges.filter((c) => c.category === 'property');

  return (
    <>
      <div className="grid grid-cols-[1fr_1fr_1fr] gap-2 px-3 py-1.5 bg-gray-100 dark:bg-gray-800 text-xs font-medium text-gray-500 dark:text-gray-400">
        <div>Property Detail</div>
        <div>Value</div>
        <div>Flag</div>
      </div>
      {propertyContext.roofAge != null && (
        <ComparisonRow
          label="Roof Age"
          current={`${propertyContext.roofAge} years`}
          renewal={propertyContext.roofType || '-'}
          change={propertyContext.roofAge >= 20 ? 'worse' : propertyContext.roofAge >= 15 ? 'different' : 'same'}
          isMaterial={propertyContext.roofAge >= 20}
        />
      )}
      {propertyContext.yearBuilt != null && (
        <ComparisonRow
          label="Year Built"
          current={`${propertyContext.yearBuilt}`}
          renewal="-"
        />
      )}
      {propertyContext.constructionType != null && (
        <ComparisonRow
          label="Construction"
          current={propertyContext.constructionType}
          renewal="-"
        />
      )}
      {propertyChanges.filter((c) => c.field === 'property.rce').map((c) => (
        <ComparisonRow
          key={c.field}
          label="Replacement Cost Est."
          current={c.oldValue != null ? `$${Number(c.oldValue).toLocaleString()}` : '-'}
          renewal={c.newValue != null ? `$${Number(c.newValue).toLocaleString()}` : '-'}
          change={getChangeType(c)}
          isMaterial={c.severity === 'material_negative'}
        />
      ))}
      {propertyChanges.filter((c) => c.field === 'property.roofCoverageType').map((c) => (
        <ComparisonRow
          key={c.field}
          label="Valuation Method"
          current={String(c.oldValue || '-')}
          renewal={String(c.newValue || '-')}
          change="worse"
          isMaterial={true}
        />
      ))}
    </>
  );
}
