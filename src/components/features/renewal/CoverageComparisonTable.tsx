'use client';

import { cn } from '@/lib/utils';
import CollapsibleSection from './CollapsibleSection';
import type { RenewalSnapshot, BaselineSnapshot, CanonicalCoverage } from '@/types/renewal.types';

// Human-readable labels for coverage types (re-exported subset)
const COVERAGE_TYPE_LABELS: Record<string, string> = {
  bodily_injury: 'Bodily Injury',
  property_damage: 'Property Damage',
  collision: 'Collision',
  comprehensive: 'Comprehensive',
  uninsured_motorist: 'Uninsured Motorist',
  uninsured_motorist_bi: 'Uninsured Motorist BI',
  uninsured_motorist_pd: 'Uninsured Motorist PD',
  underinsured_motorist: 'Underinsured Motorist',
  medical_payments: 'Medical Payments',
  pip: 'Personal Injury Protection',
  personal_injury_protection: 'Personal Injury Protection',
  tl: 'Towing & Roadside',
  rreim: 'Rental Reimbursement',
  rental_reimbursement: 'Rental Reimbursement',
  towing: 'Towing/Roadside',
  roadside_assistance: 'Roadside Assistance',
  combined_single_limit: 'Combined Single Limit',
  gap_coverage: 'GAP Coverage',
  dwelling: 'Dwelling',
  personal_property: 'Personal Property',
  personal_liability: 'Personal Liability',
  medical_payments_to_others: 'Medical Payments to Others',
  other_structures: 'Other Structures',
  loss_of_use: 'Loss of Use',
  water_damage: 'Water Damage',
  mine_subsidence: 'Mine Subsidence',
  sinkhole: 'Sinkhole',
  hurricane_deductible: 'Hurricane Deductible',
  cyber_liability: 'Cyber Liability',
  service_line: 'Service Line',
  sewer_water_backup: 'Sewer/Water Backup',
  equipment_breakdown: 'Equipment Breakdown',
  wind_hail: 'Wind/Hail',
  roof_surfaces: 'Roof Surfaces',
  roof_replacement_cost: 'Roof Replacement Cost',
  extended_dwelling: 'Extended Dwelling',
  personal_property_replacement: 'Personal Property Replacement',
  liability_additional: 'Additional Liability',
  identity_fraud: 'Identity Fraud',
  loan_lease_payoff: 'Loan/Lease Payoff',
  tropical_cyclone: 'Tropical Cyclone',
  additional_coverage_a: 'Additional Coverage A',
  building_structures_extended: 'Building Structures Extended',
  by_operation_of_law: 'By Operation of Law',
  additional_insured: 'Additional Insured',
};

interface CoverageComparisonTableProps {
  renewalSnapshot: RenewalSnapshot | null;
  baselineSnapshot: BaselineSnapshot | null;
}

interface CoverageRow {
  type: string;
  label: string;
  currentLimit: string;
  renewalLimit: string;
  changeText: string;
  changeColor: string;
  isRemoved: boolean;
  isAdded: boolean;
}

function formatLimit(cov: CanonicalCoverage | undefined): string {
  if (!cov) return '-';
  if (cov.limitAmount != null) return `$${cov.limitAmount.toLocaleString()}`;
  if (cov.limit) {
    const cleaned = cov.limit.replace(/^0+/, '') || '0';
    const num = parseInt(cleaned, 10);
    if (!isNaN(num) && num > 0) return `$${num.toLocaleString()}`;
    return cov.limit;
  }
  if (cov.premium != null) return `$${cov.premium.toLocaleString()}`;
  return '-';
}

function computeChange(
  baseline: CanonicalCoverage | undefined,
  renewal: CanonicalCoverage | undefined,
): { text: string; color: string } {
  if (!baseline && renewal) return { text: 'NEW', color: 'text-green-600 dark:text-green-400' };
  if (baseline && !renewal) return { text: 'REMOVED', color: 'text-red-600 dark:text-red-400' };
  if (!baseline || !renewal) return { text: '-', color: 'text-gray-400' };

  const bVal = baseline.limitAmount ?? baseline.premium ?? null;
  const rVal = renewal.limitAmount ?? renewal.premium ?? null;

  if (bVal == null || rVal == null) return { text: 'No change', color: 'text-gray-400' };
  if (bVal === rVal) return { text: 'No change', color: 'text-gray-400' };

  const diff = rVal - bVal;
  const pct = bVal !== 0 ? ((diff / bVal) * 100).toFixed(1) : '0';
  const sign = diff > 0 ? '+' : '';
  const color = diff > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400';

  return { text: `${sign}${pct}%`, color };
}

function buildRows(
  baselineCovs: CanonicalCoverage[],
  renewalCovs: CanonicalCoverage[],
): CoverageRow[] {
  const baselineByType = new Map(baselineCovs.map(c => [c.type, c]));
  const renewalByType = new Map(renewalCovs.map(c => [c.type, c]));
  const seenTypes = new Set<string>();
  const rows: CoverageRow[] = [];

  // Ordered types first
  const orderedTypes = [
    'dwelling', 'other_structures', 'personal_property', 'loss_of_use',
    'personal_liability', 'medical_payments_to_others',
    'bodily_injury', 'property_damage', 'uninsured_motorist',
    'uninsured_motorist_bi', 'uninsured_motorist_pd', 'underinsured_motorist',
    'medical_payments', 'pip', 'personal_injury_protection',
    'comprehensive', 'collision',
    'tl', 'rreim', 'towing', 'roadside_assistance', 'rental_reimbursement',
    'gap_coverage', 'combined_single_limit',
  ];

  for (const type of orderedTypes) {
    const b = baselineByType.get(type);
    const r = renewalByType.get(type);
    if (!b && !r) continue;
    seenTypes.add(type);
    const change = computeChange(b, r);
    rows.push({
      type,
      label: COVERAGE_TYPE_LABELS[type] || b?.description || r?.description || type,
      currentLimit: formatLimit(b),
      renewalLimit: formatLimit(r),
      changeText: change.text,
      changeColor: change.color,
      isRemoved: !!b && !r,
      isAdded: !b && !!r,
    });
  }

  // Remaining types
  const allTypes = new Set([...baselineByType.keys(), ...renewalByType.keys()]);
  for (const type of allTypes) {
    if (seenTypes.has(type)) continue;
    seenTypes.add(type);
    const b = baselineByType.get(type);
    const r = renewalByType.get(type);
    const change = computeChange(b, r);
    rows.push({
      type,
      label: COVERAGE_TYPE_LABELS[type] || b?.description || r?.description || type,
      currentLimit: formatLimit(b),
      renewalLimit: formatLimit(r),
      changeText: change.text,
      changeColor: change.color,
      isRemoved: !!b && !r,
      isAdded: !b && !!r,
    });
  }

  return rows;
}

export default function CoverageComparisonTable({
  renewalSnapshot,
  baselineSnapshot,
}: CoverageComparisonTableProps) {
  if (!renewalSnapshot && !baselineSnapshot) {
    return null;
  }

  const baselineCovs = baselineSnapshot?.coverages || [];
  const renewalCovs = renewalSnapshot?.coverages || [];
  const rows = buildRows(baselineCovs, renewalCovs);

  if (rows.length === 0) return null;

  return (
    <CollapsibleSection
      title="Coverage Comparison"
      badge={`${rows.length} coverages`}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-100 dark:bg-gray-800 text-xs text-gray-500 dark:text-gray-400 uppercase">
              <th className="text-left px-4 py-2.5 font-medium">Coverage</th>
              <th className="text-right px-3 py-2.5 font-medium w-28">Current</th>
              <th className="text-right px-3 py-2.5 font-medium w-28">Renewal</th>
              <th className="text-center px-3 py-2.5 font-medium w-24">Change</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {rows.map((row) => (
              <tr
                key={row.type}
                className={cn(
                  row.isRemoved ? 'bg-red-50/50 dark:bg-red-900/10' :
                  row.isAdded ? 'bg-green-50/50 dark:bg-green-900/10' :
                  'hover:bg-gray-50 dark:hover:bg-gray-800/50',
                )}
              >
                <td className="px-4 py-2.5">
                  <span className={cn(
                    'text-sm',
                    row.isRemoved ? 'text-red-600 dark:text-red-400 line-through' :
                    row.isAdded ? 'text-green-600 dark:text-green-400' :
                    'text-gray-700 dark:text-gray-300',
                  )}>
                    {row.label}
                  </span>
                </td>
                <td className="text-right px-3 py-2.5 text-gray-600 dark:text-gray-400">
                  {row.currentLimit}
                </td>
                <td className={cn(
                  'text-right px-3 py-2.5 font-medium',
                  row.isRemoved ? 'text-red-600 dark:text-red-400' :
                  row.isAdded ? 'text-green-600 dark:text-green-400' :
                  'text-gray-700 dark:text-gray-300',
                )}>
                  {row.isRemoved ? '-' : row.renewalLimit}
                </td>
                <td className={cn('text-center px-3 py-2.5 text-xs font-semibold', row.changeColor)}>
                  {row.changeText}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </CollapsibleSection>
  );
}
