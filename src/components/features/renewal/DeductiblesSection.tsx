'use client';

import { cn } from '@/lib/utils';
import CollapsibleSection from './CollapsibleSection';
import type { RenewalSnapshot, BaselineSnapshot, CanonicalCoverage, CanonicalVehicle } from '@/types/renewal.types';

interface DeductiblesSectionProps {
  renewalSnapshot: RenewalSnapshot | null;
  baselineSnapshot: BaselineSnapshot | null;
}

interface DeductibleRow {
  label: string;
  currentValue: string;
  renewalValue: string;
  changed: boolean;
  increased: boolean;
}

interface DeductibleGroup {
  heading: string | null; // null = policy-level
  rows: DeductibleRow[];
}

const DEDUCTIBLE_LABELS: Record<string, string> = {
  collision: 'Collision',
  comprehensive: 'Comprehensive',
  dwelling: 'Dwelling (All Perils)',
  wind_hail: 'Wind/Hail',
  hurricane_deductible: 'Hurricane',
  named_storm_deductible: 'Named Storm',
  water_damage: 'Water Damage',
  sewer_water_backup: 'Sewer/Water Backup',
  equipment_breakdown: 'Equipment Breakdown',
  mine_subsidence: 'Mine Subsidence',
  sinkhole: 'Sinkhole',
  tropical_cyclone: 'Tropical Cyclone',
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

    rows.push({
      label: DEDUCTIBLE_LABELS[type] || b?.description || r?.description || type,
      currentValue: bVal != null ? `$${bVal.toLocaleString()}` : '-',
      renewalValue: rVal != null ? `$${rVal.toLocaleString()}` : '-',
      changed,
      increased: changed && rVal! > bVal!,
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

  const hasChanges = groups.some(g => g.rows.some(r => r.changed));

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
                      row.changed ? 'bg-amber-50/50 dark:bg-amber-900/10' : '',
                      'hover:bg-gray-50 dark:hover:bg-gray-800/50',
                    )}
                  >
                    <td className={cn('py-2.5 text-gray-700 dark:text-gray-300', group.heading ? 'px-6' : 'px-4')}>
                      {row.label}
                    </td>
                    <td className="text-right px-3 py-2.5 text-gray-600 dark:text-gray-400">
                      {row.currentValue}
                    </td>
                    <td className={cn(
                      'text-right px-3 py-2.5 font-medium',
                      row.changed
                        ? row.increased
                          ? 'text-red-600 dark:text-red-400'
                          : 'text-green-600 dark:text-green-400'
                        : 'text-gray-700 dark:text-gray-300',
                    )}>
                      {row.renewalValue}
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
