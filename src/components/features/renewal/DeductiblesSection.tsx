'use client';

import { cn } from '@/lib/utils';
import CollapsibleSection from './CollapsibleSection';
import type { RenewalSnapshot, BaselineSnapshot, CanonicalCoverage } from '@/types/renewal.types';

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

export default function DeductiblesSection({
  renewalSnapshot,
  baselineSnapshot,
}: DeductiblesSectionProps) {
  const baselineDeds = extractDeductibles(baselineSnapshot?.coverages || []);
  const renewalDeds = extractDeductibles(renewalSnapshot?.coverages || []);

  const allTypes = new Set([...baselineDeds.keys(), ...renewalDeds.keys()]);
  if (allTypes.size === 0) return null;

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

  return (
    <CollapsibleSection
      title="Deductibles"
      badge={`${rows.length}`}
      defaultOpen={rows.some(r => r.changed)}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-100 dark:bg-gray-800 text-xs text-gray-500 dark:text-gray-400 uppercase">
              <th className="text-left px-4 py-2.5 font-medium">Deductible</th>
              <th className="text-right px-3 py-2.5 font-medium w-28">Current</th>
              <th className="text-right px-3 py-2.5 font-medium w-28">Renewal</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {rows.map((row) => (
              <tr
                key={row.label}
                className={cn(
                  row.changed ? 'bg-amber-50/50 dark:bg-amber-900/10' : '',
                  'hover:bg-gray-50 dark:hover:bg-gray-800/50',
                )}
              >
                <td className="px-4 py-2.5 text-gray-700 dark:text-gray-300">
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
                    <span className="ml-1 text-[10px]">
                      {row.increased ? '(up)' : '(down)'}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </CollapsibleSection>
  );
}
