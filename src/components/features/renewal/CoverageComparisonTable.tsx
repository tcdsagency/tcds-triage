'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Car, Home, ChevronDown, ChevronRight } from 'lucide-react';
import CollapsibleSection from './CollapsibleSection';
import type { RenewalSnapshot, BaselineSnapshot, CanonicalCoverage, CanonicalVehicle } from '@/types/renewal.types';

// Human-readable labels for coverage types
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

interface VehicleData {
  key: string;
  label: string;
  vinSuffix: string;
  baseline?: CanonicalVehicle;
  renewal?: CanonicalVehicle;
  isRemoved: boolean;
  isAdded: boolean;
}

// ============================================================================
// Helpers
// ============================================================================

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

const COVERAGE_ORDER = [
  'dwelling', 'other_structures', 'personal_property', 'loss_of_use',
  'personal_liability', 'medical_payments_to_others',
  'bodily_injury', 'property_damage', 'uninsured_motorist',
  'uninsured_motorist_bi', 'uninsured_motorist_pd', 'underinsured_motorist',
  'medical_payments', 'pip', 'personal_injury_protection',
  'comprehensive', 'collision',
  'tl', 'rreim', 'towing', 'roadside_assistance', 'rental_reimbursement',
  'gap_coverage', 'combined_single_limit', 'loan_lease_payoff',
];

function buildRows(
  baselineCovs: CanonicalCoverage[],
  renewalCovs: CanonicalCoverage[],
): CoverageRow[] {
  const baselineByType = new Map(baselineCovs.map(c => [c.type, c]));
  const renewalByType = new Map(renewalCovs.map(c => [c.type, c]));
  const seenTypes = new Set<string>();
  const rows: CoverageRow[] = [];

  for (const type of COVERAGE_ORDER) {
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

function mergeCoverages(policyCovs: CanonicalCoverage[], vehicleCovs: CanonicalCoverage[]): CanonicalCoverage[] {
  const merged = new Map<string, CanonicalCoverage>();
  policyCovs.forEach(c => { if (c.type && !merged.has(c.type)) merged.set(c.type, c); });
  vehicleCovs.forEach(c => { if (c.type) merged.set(c.type, c); });
  return Array.from(merged.values());
}

function buildVehicleList(
  baseline: BaselineSnapshot | null,
  renewal: RenewalSnapshot | null,
): VehicleData[] {
  const vehicles: VehicleData[] = [];
  const seenVins = new Set<string>();
  const labelCounts = new Map<string, number>();

  const allVehicles = [...(baseline?.vehicles || []), ...(renewal?.vehicles || [])];
  allVehicles.forEach(v => {
    const label = `${v.year || ''} ${v.make || ''} ${v.model || ''}`.trim();
    labelCounts.set(label, (labelCounts.get(label) || 0) + 1);
  });

  let baselineIdx = 0;
  baseline?.vehicles?.forEach(v => {
    const vin = v.vin || `no-vin-b${baselineIdx++}-${v.year}-${v.make}-${v.model}`;
    if (seenVins.has(vin)) return;
    seenVins.add(vin);

    const label = `${v.year || ''} ${v.make || ''} ${v.model || ''}`.trim() || vin;
    const renewalMatch = renewal?.vehicles?.find(rv =>
      rv.vin && v.vin ? rv.vin === v.vin
        : !rv.vin && !v.vin && rv.year === v.year && rv.make === v.make && rv.model === v.model
    );
    const needsVinSuffix = (labelCounts.get(label) || 0) > 1;

    vehicles.push({
      key: vin,
      label,
      vinSuffix: needsVinSuffix && v.vin ? v.vin.slice(-4) : '',
      baseline: v,
      renewal: renewalMatch,
      isRemoved: !renewalMatch,
      isAdded: false,
    });
  });

  let renewalIdx = 0;
  renewal?.vehicles?.forEach(v => {
    const vin = v.vin || `no-vin-r${renewalIdx++}-${v.year}-${v.make}-${v.model}`;
    if (seenVins.has(vin)) return;
    seenVins.add(vin);

    const label = `${v.year || ''} ${v.make || ''} ${v.model || ''}`.trim() || vin;
    const needsVinSuffix = (labelCounts.get(label) || 0) > 1;

    vehicles.push({
      key: vin,
      label,
      vinSuffix: needsVinSuffix && v.vin ? v.vin.slice(-4) : '',
      baseline: undefined,
      renewal: v,
      isRemoved: false,
      isAdded: true,
    });
  });

  return vehicles;
}

function calculateTotalPremium(coverages: CanonicalCoverage[]): number {
  return coverages.reduce((sum, c) => sum + (c.premium || 0), 0);
}

function isHomePolicy(snapshot: RenewalSnapshot | BaselineSnapshot | null): boolean {
  if (!snapshot) return false;
  const covTypes = snapshot.coverages.map(c => c.type);
  return covTypes.some(t => t === 'dwelling' || t === 'personal_property' || t === 'other_structures');
}

// ============================================================================
// Coverage Table (shared between policy-level and vehicle sections)
// ============================================================================

function CoverageTable({ rows }: { rows: CoverageRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="px-4 py-3 text-center text-xs text-gray-400 italic">
        No coverage data available
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-100 dark:bg-gray-800 text-xs text-gray-500 dark:text-gray-400 uppercase">
            <th className="text-left px-4 py-2 font-medium">Coverage</th>
            <th className="text-right px-3 py-2 font-medium w-28">Current</th>
            <th className="text-right px-3 py-2 font-medium w-28">Renewal</th>
            <th className="text-center px-3 py-2 font-medium w-24">Change</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
          {rows.map(row => (
            <tr
              key={row.type}
              className={cn(
                row.isRemoved ? 'bg-red-50/50 dark:bg-red-900/10' :
                row.isAdded ? 'bg-green-50/50 dark:bg-green-900/10' :
                'hover:bg-gray-50 dark:hover:bg-gray-800/50',
              )}
            >
              <td className="px-4 py-2">
                <span className={cn(
                  'text-sm',
                  row.isRemoved ? 'text-red-600 dark:text-red-400 line-through' :
                  row.isAdded ? 'text-green-600 dark:text-green-400' :
                  'text-gray-700 dark:text-gray-300',
                )}>
                  {row.label}
                </span>
              </td>
              <td className="text-right px-3 py-2 text-gray-600 dark:text-gray-400">
                {row.currentLimit}
              </td>
              <td className={cn(
                'text-right px-3 py-2 font-medium',
                row.isRemoved ? 'text-red-600 dark:text-red-400' :
                row.isAdded ? 'text-green-600 dark:text-green-400' :
                'text-gray-700 dark:text-gray-300',
              )}>
                {row.isRemoved ? '-' : row.renewalLimit}
              </td>
              <td className={cn('text-center px-3 py-2 text-xs font-semibold', row.changeColor)}>
                {row.changeText}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ============================================================================
// Vehicle Card (collapsible per-vehicle section)
// ============================================================================

function VehicleSection({
  vehicle,
  policyCovBaseline,
  policyCovRenewal,
  defaultExpanded,
}: {
  vehicle: VehicleData;
  policyCovBaseline: CanonicalCoverage[];
  policyCovRenewal: CanonicalCoverage[];
  defaultExpanded: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  const baselineCovs = vehicle.isAdded ? [] : mergeCoverages(policyCovBaseline, vehicle.baseline?.coverages || []);
  const renewalCovs = vehicle.isRemoved ? [] : mergeCoverages(policyCovRenewal, vehicle.renewal?.coverages || []);
  const rows = buildRows(baselineCovs, renewalCovs);

  const baselinePremium = calculateTotalPremium(baselineCovs);
  const renewalPremium = calculateTotalPremium(renewalCovs);
  const hasChange = rows.some(r => r.changeText !== 'No change' && r.changeText !== '-');

  const premiumColor = renewalPremium > baselinePremium
    ? 'text-red-600 dark:text-red-400'
    : renewalPremium < baselinePremium
      ? 'text-green-600 dark:text-green-400'
      : 'text-gray-700 dark:text-gray-300';

  return (
    <div className={cn(
      'rounded-lg border overflow-hidden',
      vehicle.isRemoved ? 'border-red-300 dark:border-red-800' :
      vehicle.isAdded ? 'border-green-300 dark:border-green-800' :
      'border-gray-200 dark:border-gray-700',
    )}>
      <button
        onClick={() => setExpanded(!expanded)}
        className={cn(
          'w-full flex items-center justify-between px-4 py-2.5 transition-colors',
          vehicle.isRemoved ? 'bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30' :
          vehicle.isAdded ? 'bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/30' :
          'bg-gray-50 dark:bg-gray-900/50 hover:bg-gray-100 dark:hover:bg-gray-800',
        )}
      >
        <div className="flex items-center gap-2.5">
          <Car className={cn(
            'h-4 w-4',
            vehicle.isRemoved ? 'text-red-500' : vehicle.isAdded ? 'text-green-500' : 'text-gray-400',
          )} />
          <div className="text-left">
            <span className={cn(
              'text-sm font-medium',
              vehicle.isRemoved ? 'text-red-700 dark:text-red-400' :
              vehicle.isAdded ? 'text-green-700 dark:text-green-400' :
              'text-gray-900 dark:text-gray-100',
            )}>
              {vehicle.label}
            </span>
            {vehicle.vinSuffix && (
              <span className="ml-1.5 text-xs text-gray-400 font-normal">
                (...{vehicle.vinSuffix})
              </span>
            )}
            {vehicle.isRemoved && <span className="ml-2 text-xs text-red-500 font-medium">REMOVED</span>}
            {vehicle.isAdded && <span className="ml-2 text-xs text-green-500 font-medium">ADDED</span>}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {!vehicle.isRemoved && !vehicle.isAdded && baselinePremium > 0 && renewalPremium > 0 && (
            <div className="text-xs text-right">
              <span className="text-gray-500">${baselinePremium.toLocaleString()}</span>
              <span className="mx-1.5 text-gray-400">&rarr;</span>
              <span className={cn('font-semibold', premiumColor)}>
                ${renewalPremium.toLocaleString()}
              </span>
            </div>
          )}
          {hasChange && !vehicle.isRemoved && !vehicle.isAdded && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 font-medium">
              CHANGED
            </span>
          )}
          {expanded
            ? <ChevronDown className="h-4 w-4 text-gray-400" />
            : <ChevronRight className="h-4 w-4 text-gray-400" />}
        </div>
      </button>

      {expanded && <CoverageTable rows={rows} />}
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export default function CoverageComparisonTable({
  renewalSnapshot,
  baselineSnapshot,
}: CoverageComparisonTableProps) {
  if (!renewalSnapshot && !baselineSnapshot) return null;

  const isHome = isHomePolicy(renewalSnapshot) || isHomePolicy(baselineSnapshot);
  const vehicles = buildVehicleList(baselineSnapshot, renewalSnapshot);
  const hasVehicles = vehicles.length > 0;

  // Policy-level coverages (for home or when no vehicles)
  const policyBaselineCovs = baselineSnapshot?.coverages || [];
  const policyRenewalCovs = renewalSnapshot?.coverages || [];
  const policyRows = buildRows(policyBaselineCovs, policyRenewalCovs);
  const showPolicyLevel = isHome || !hasVehicles;

  const totalItems = (showPolicyLevel ? policyRows.length : 0) + vehicles.length;
  if (totalItems === 0) return null;

  return (
    <CollapsibleSection
      title="Coverage Comparison"
      badge={hasVehicles ? `${vehicles.length} vehicle${vehicles.length !== 1 ? 's' : ''}` : `${policyRows.length} coverages`}
    >
      <div className="space-y-0">
        {/* Policy-level coverages (home policies or no-vehicle fallback) */}
        {showPolicyLevel && policyRows.length > 0 && (
          <div>
            {hasVehicles && (
              <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-900/20 border-b border-gray-200 dark:border-gray-700">
                <Home className="h-4 w-4 text-blue-500" />
                <span className="text-xs font-semibold uppercase text-blue-700 dark:text-blue-400">
                  Policy-Level Coverages
                </span>
              </div>
            )}
            <CoverageTable rows={policyRows} />
          </div>
        )}

        {/* Per-vehicle coverages */}
        {hasVehicles && (
          <div className="p-3 space-y-2">
            {vehicles.map((vehicle, i) => (
              <VehicleSection
                key={vehicle.key}
                vehicle={vehicle}
                policyCovBaseline={policyBaselineCovs}
                policyCovRenewal={policyRenewalCovs}
                defaultExpanded={i === 0}
              />
            ))}
          </div>
        )}
      </div>
    </CollapsibleSection>
  );
}
