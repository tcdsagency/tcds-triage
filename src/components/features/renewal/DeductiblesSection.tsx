'use client';

import { cn } from '@/lib/utils';
import CollapsibleSection from './CollapsibleSection';
import { resolveCoverageDisplayName } from '@/lib/coverage-display-names';
import type { RenewalSnapshot, BaselineSnapshot, CanonicalCoverage, CanonicalVehicle } from '@/types/renewal.types';

interface DeductiblesSectionProps {
  renewalSnapshot: RenewalSnapshot | null;
  baselineSnapshot: BaselineSnapshot | null;
}

interface DeductibleRow {
  type: string;
  label: string;
  currentValue: string;
  renewalValue: string;
  changed: boolean;
  increased: boolean;
  isNew: boolean;
  isRemoved: boolean;
}

interface DeductibleGroup {
  heading: string | null; // null = policy-level
  rows: DeductibleRow[];
}

// Deductible-specific overrides (for labels that differ from coverage names)
const DEDUCTIBLE_LABELS: Record<string, string> = {
  dwelling: 'Dwelling (All Perils)',
  hurricane_deductible: 'Hurricane',
  named_storm_deductible: 'Named Storm',
};

// Educational tips for deductible types
const DEDUCTIBLE_TIPS: Record<string, string> = {
  dwelling: 'Applies to all perils including fire, theft, vandalism. Usually the main deductible on the policy.',
  wind_hail: 'Separate deductible for wind/hail claims. Often a percentage of Coverage A (dwelling).',
  hurricane_deductible: 'Applies to hurricane claims. Typically 2-5% of dwelling value.',
  named_storm_deductible: 'Applies to named storm damage. Similar to hurricane deductible but may cover broader storm types.',
  comprehensive: "Applies to non-collision claims (theft, vandalism, weather, animal). Also called 'other than collision'.",
  collision: 'Applies to collision claims (hitting another vehicle, object, or rollover).',
  sewer_water_backup: 'Covers damage from backed-up sewers/drains. Often an endorsement with a separate deductible.',
  equipment_breakdown: 'Covers mechanical/electrical breakdown of home systems (HVAC, appliances).',
};

function extractDeductibles(coverages: CanonicalCoverage[]): Map<string, CanonicalCoverage> {
  const result = new Map<string, CanonicalCoverage>();
  for (const cov of coverages) {
    if (cov.deductibleAmount != null && cov.type) {
      result.set(cov.type, cov);
    }
  }
  return result;
}

function vehicleLabel(v: CanonicalVehicle): string {
  const parts = [v.year, v.make, v.model].filter(Boolean);
  return parts.length > 0 ? parts.join(' ') : (v.vin || 'Vehicle');
}

function buildRows(
  baselineDeds: Map<string, CanonicalCoverage>,
  renewalDeds: Map<string, CanonicalCoverage>,
): DeductibleRow[] {
  const allTypes = new Set([...baselineDeds.keys(), ...renewalDeds.keys()]);
  const rows: DeductibleRow[] = [];

  for (const type of allTypes) {
    const b = baselineDeds.get(type);
    const r = renewalDeds.get(type);
    const bVal = b?.deductibleAmount ?? null;
    const rVal = r?.deductibleAmount ?? null;
    const changed = bVal != null && rVal != null && bVal !== rVal;
    const isNew = bVal == null && rVal != null;
    const isRemoved = bVal != null && rVal == null;

    rows.push({
      type,
      label: DEDUCTIBLE_LABELS[type] || b?.description || r?.description || resolveCoverageDisplayName(type),
      currentValue: bVal != null ? `$${bVal.toLocaleString()}` : '-',
      renewalValue: rVal != null ? `$${rVal.toLocaleString()}` : '-',
      changed,
      increased: changed && rVal! > bVal!,
      isNew,
      isRemoved,
    });
  }

  return rows;
}

/** Match vehicles between baseline and renewal by VIN or year/make/model */
function matchVehicles(
  baselineVehicles: CanonicalVehicle[],
  renewalVehicles: CanonicalVehicle[],
): { baseline: CanonicalVehicle | null; renewal: CanonicalVehicle | null; label: string }[] {
  const matched: { baseline: CanonicalVehicle | null; renewal: CanonicalVehicle | null; label: string }[] = [];
  const usedRenewal = new Set<number>();

  for (const bv of baselineVehicles) {
    let found = false;
    for (let ri = 0; ri < renewalVehicles.length; ri++) {
      if (usedRenewal.has(ri)) continue;
      const rv = renewalVehicles[ri];
      const vinMatch = bv.vin && rv.vin && bv.vin === rv.vin;
      const ymmMatch = bv.year && rv.year && bv.year === rv.year && bv.make === rv.make && bv.model === rv.model;
      if (vinMatch || ymmMatch) {
        matched.push({ baseline: bv, renewal: rv, label: vehicleLabel(rv) });
        usedRenewal.add(ri);
        found = true;
        break;
      }
    }
    if (!found) {
      matched.push({ baseline: bv, renewal: null, label: vehicleLabel(bv) });
    }
  }

  // Add unmatched renewal vehicles
  for (let ri = 0; ri < renewalVehicles.length; ri++) {
    if (!usedRenewal.has(ri)) {
      matched.push({ baseline: null, renewal: renewalVehicles[ri], label: vehicleLabel(renewalVehicles[ri]) });
    }
  }

  return matched;
}

export default function DeductiblesSection({
  renewalSnapshot,
  baselineSnapshot,
}: DeductiblesSectionProps) {
  const groups: DeductibleGroup[] = [];

  const baselineVehicles = baselineSnapshot?.vehicles || [];
  const renewalVehicles = renewalSnapshot?.vehicles || [];
  const hasVehicles = baselineVehicles.length > 0 || renewalVehicles.length > 0;

  // Policy-level deductibles (non-vehicle coverages)
  const policyBaselineDeds = extractDeductibles(baselineSnapshot?.coverages || []);
  const policyRenewalDeds = extractDeductibles(renewalSnapshot?.coverages || []);
  const policyRows = buildRows(policyBaselineDeds, policyRenewalDeds);
  if (policyRows.length > 0) {
    groups.push({ heading: null, rows: policyRows });
  }

  // Per-vehicle deductibles
  if (hasVehicles) {
    const vehiclePairs = matchVehicles(baselineVehicles, renewalVehicles);
    for (const { baseline, renewal, label } of vehiclePairs) {
      const bDeds = extractDeductibles(baseline?.coverages || []);
      const rDeds = extractDeductibles(renewal?.coverages || []);
      const rows = buildRows(bDeds, rDeds);
      if (rows.length > 0) {
        groups.push({ heading: label, rows });
      }
    }
  }

  const totalRows = groups.reduce((sum, g) => sum + g.rows.length, 0);
  if (totalRows === 0) return null;

  const hasChanges = groups.some(g => g.rows.some(r => r.changed || r.isNew || r.isRemoved));

  return (
    <CollapsibleSection
      title="Deductibles"
      badge={`${totalRows}`}
      defaultOpen={hasChanges}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-100 dark:bg-gray-800 text-sm text-gray-500 dark:text-gray-400 uppercase">
              <th className="text-left px-4 py-2.5 font-medium">Deductible</th>
              <th className="text-right px-3 py-2.5 font-medium w-28">Current</th>
              <th className="text-right px-3 py-2.5 font-medium w-28">Renewal</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {groups.map((group, gi) => (
              <>
                {/* Vehicle heading row */}
                {group.heading && (
                  <tr key={`heading-${gi}`} className="bg-gray-50 dark:bg-gray-800/50">
                    <td colSpan={3} className="px-4 py-2 text-sm font-semibold text-gray-600 dark:text-gray-300">
                      {group.heading}
                    </td>
                  </tr>
                )}
                {group.rows.map((row) => (
                  <tr
                    key={`${gi}-${row.label}`}
                    className={cn(
                      row.changed ? 'bg-amber-50/50 dark:bg-amber-900/10' :
                      row.isRemoved ? 'bg-red-50/50 dark:bg-red-900/10' :
                      row.isNew ? 'bg-green-50/50 dark:bg-green-900/10' :
                      '',
                      'hover:bg-gray-50 dark:hover:bg-gray-800/50',
                    )}
                  >
                    <td className={cn(
                      'py-2.5',
                      group.heading ? 'px-6' : 'px-4',
                      row.isRemoved ? 'text-red-600 dark:text-red-400 line-through' :
                      row.isNew ? 'text-green-600 dark:text-green-400' :
                      'text-gray-700 dark:text-gray-300',
                    )}>
                      <div className="relative group/tip inline-flex items-center gap-1">
                        {row.label}
                        {row.isNew && (
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400 no-underline">
                            NEW
                          </span>
                        )}
                        {row.isRemoved && (
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 no-underline">
                            REMOVED
                          </span>
                        )}
                        {(DEDUCTIBLE_TIPS[row.type] || row.changed) && (
                          <div className="hidden group-hover/tip:block absolute left-0 -top-10 z-10 px-2.5 py-1.5 bg-gray-900 text-white text-xs rounded shadow-lg max-w-xs whitespace-normal">
                            {DEDUCTIBLE_TIPS[row.type] || ''}
                            {row.changed && (
                              <span className="block mt-0.5 text-gray-300">
                                {row.increased
                                  ? '(Higher deductible = lower premium, more out-of-pocket risk)'
                                  : '(Lower deductible = higher premium, less out-of-pocket risk)'}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className={cn(
                      'text-right px-3 py-2.5',
                      row.isRemoved ? 'text-red-600 dark:text-red-400' : 'text-gray-600 dark:text-gray-400',
                    )}>
                      {row.currentValue}
                    </td>
                    <td className={cn(
                      'text-right px-3 py-2.5 font-medium',
                      row.changed
                        ? row.increased
                          ? 'text-red-600 dark:text-red-400'
                          : 'text-green-600 dark:text-green-400'
                        : row.isNew ? 'text-green-600 dark:text-green-400'
                        : row.isRemoved ? 'text-red-600 dark:text-red-400'
                        : 'text-gray-700 dark:text-gray-300',
                    )}>
                      {row.isRemoved ? '-' : row.renewalValue}
                      {row.changed && (
                        <span className="ml-1 text-xs">
                          {row.increased ? '(up)' : '(down)'}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </CollapsibleSection>
  );
}
