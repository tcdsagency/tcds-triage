/**
 * Auto Vehicle Rules (A-010 to A-014)
 * Phase 6 — Vehicle details
 */

import type { CheckRuleDefinition, CheckResult } from '@/types/check-rules.types';
import { makeCheck, norm } from '../helpers';
import type { CanonicalVehicle } from '@/types/renewal.types';

function vehicleLabel(v: CanonicalVehicle): string {
  return [v.year, v.make, v.model].filter(Boolean).join(' ') || v.vin || 'Unknown Vehicle';
}

function matchVehicles(
  basVehicles: CanonicalVehicle[],
  renVehicles: CanonicalVehicle[]
): { matched: [CanonicalVehicle, CanonicalVehicle][]; added: CanonicalVehicle[]; removed: CanonicalVehicle[] } {
  const matched: [CanonicalVehicle, CanonicalVehicle][] = [];
  const usedRen = new Set<number>();
  const usedBas = new Set<number>();

  // Match by VIN first
  for (let bi = 0; bi < basVehicles.length; bi++) {
    const bv = basVehicles[bi];
    if (!bv.vin) continue;
    for (let ri = 0; ri < renVehicles.length; ri++) {
      if (usedRen.has(ri)) continue;
      const rv = renVehicles[ri];
      if (rv.vin && norm(rv.vin) === norm(bv.vin)) {
        matched.push([bv, rv]);
        usedBas.add(bi);
        usedRen.add(ri);
        break;
      }
    }
  }

  // Match by year/make/model
  for (let bi = 0; bi < basVehicles.length; bi++) {
    if (usedBas.has(bi)) continue;
    const bv = basVehicles[bi];
    for (let ri = 0; ri < renVehicles.length; ri++) {
      if (usedRen.has(ri)) continue;
      const rv = renVehicles[ri];
      if (bv.year === rv.year && norm(bv.make) === norm(rv.make) && norm(bv.model) === norm(rv.model)) {
        matched.push([bv, rv]);
        usedBas.add(bi);
        usedRen.add(ri);
        break;
      }
    }
  }

  const removed = basVehicles.filter((_, i) => !usedBas.has(i));
  const added = renVehicles.filter((_, i) => !usedRen.has(i));

  return { matched, added, removed };
}

export const autoVehicleRules: CheckRuleDefinition[] = [
  {
    ruleId: 'A-010',
    name: 'Vehicle Added',
    description: 'Detect vehicles added in renewal',
    checkType: 'existence',
    category: 'Vehicles',
    phase: 6,
    isBlocking: false,
    lob: 'auto',
    evaluate: (ctx) => {
      const { added } = matchVehicles(ctx.baseline.vehicles, ctx.renewal.vehicles);
      if (added.length === 0) return null;
      return added.map(v =>
        makeCheck('A-010', {
          field: `Vehicle: ${vehicleLabel(v)}`,
          previousValue: null,
          renewalValue: vehicleLabel(v),
          change: `Added: ${vehicleLabel(v)}`,
          severity: 'added',
          message: `Vehicle added: ${vehicleLabel(v)}`,
          agentAction: 'New vehicle on policy — confirm with customer',
          checkType: 'existence',
          category: 'Vehicles',
          isBlocking: false,
        })
      );
    },
  },
  {
    ruleId: 'A-011',
    name: 'Vehicle Removed',
    description: 'Detect vehicles removed from renewal',
    checkType: 'existence',
    category: 'Vehicles',
    phase: 6,
    isBlocking: false,
    lob: 'auto',
    evaluate: (ctx) => {
      const { removed } = matchVehicles(ctx.baseline.vehicles, ctx.renewal.vehicles);
      if (removed.length === 0) return null;
      return removed.map(v =>
        makeCheck('A-011', {
          field: `Vehicle: ${vehicleLabel(v)}`,
          previousValue: vehicleLabel(v),
          renewalValue: null,
          change: `Removed: ${vehicleLabel(v)}`,
          severity: 'removed',
          message: `Vehicle removed: ${vehicleLabel(v)}`,
          agentAction: 'Vehicle removed — verify this is correct, may indicate sold/traded vehicle',
          checkType: 'existence',
          category: 'Vehicles',
          isBlocking: false,
        })
      );
    },
  },
  {
    ruleId: 'A-012',
    name: 'VIN Validation',
    description: 'Validate VIN format on all vehicles',
    checkType: 'format',
    category: 'Vehicles',
    phase: 6,
    isBlocking: false,
    lob: 'auto',
    evaluate: (ctx) => {
      const results: CheckResult[] = [];
      for (const v of ctx.renewal.vehicles) {
        const vin = v.vin?.trim() || '';
        const isValid = vin.length === 17 && /^[A-HJ-NPR-Z0-9]{17}$/i.test(vin);
        const isEmpty = vin.length === 0;

        if (isEmpty) continue; // No VIN to validate

        if (!isValid) {
          results.push(makeCheck('A-012', {
            field: `VIN: ${vehicleLabel(v)}`,
            previousValue: null,
            renewalValue: vin,
            change: `Invalid VIN: ${vin}`,
            severity: 'warning',
            message: `Invalid VIN format for ${vehicleLabel(v)}: "${vin}"`,
            agentAction: 'VIN format invalid — verify correct VIN with customer',
            checkType: 'format',
            category: 'Vehicles',
            isBlocking: false,
          }));
        }
      }
      return results.length > 0 ? results : null;
    },
  },
  {
    ruleId: 'A-013',
    name: 'Vehicle Details Change',
    description: 'Check for changes in vehicle year/make/model',
    checkType: 'value_change',
    category: 'Vehicles',
    phase: 6,
    isBlocking: false,
    lob: 'auto',
    evaluate: (ctx) => {
      // Vehicle detail changes are already captured by add/remove rules
      // This rule is for VIN-matched vehicles with changed details
      const { matched } = matchVehicles(ctx.baseline.vehicles, ctx.renewal.vehicles);
      const results: CheckResult[] = [];

      for (const [basV, renV] of matched) {
        const changes: string[] = [];
        if (basV.year !== renV.year) changes.push(`Year: ${basV.year} → ${renV.year}`);
        if (norm(basV.make) !== norm(renV.make)) changes.push(`Make: ${basV.make} → ${renV.make}`);
        if (norm(basV.model) !== norm(renV.model)) changes.push(`Model: ${basV.model} → ${renV.model}`);
        if (norm(basV.usage) !== norm(renV.usage)) changes.push(`Usage: ${basV.usage} → ${renV.usage}`);

        if (changes.length > 0) {
          results.push(makeCheck('A-013', {
            field: `Vehicle: ${vehicleLabel(renV)}`,
            previousValue: vehicleLabel(basV),
            renewalValue: vehicleLabel(renV),
            change: changes.join('; '),
            severity: 'warning',
            message: `Vehicle details changed: ${changes.join('; ')}`,
            agentAction: 'Vehicle details changed on VIN-matched vehicle — verify accuracy',
            checkType: 'value_change',
            category: 'Vehicles',
            isBlocking: false,
          }));
        }
      }

      return results.length > 0 ? results : null;
    },
  },
  {
    ruleId: 'A-014',
    name: 'Garaging Address',
    description: 'Check for garaging zip code change',
    checkType: 'value_change',
    category: 'Vehicles',
    phase: 6,
    isBlocking: false,
    lob: 'auto',
    evaluate: (ctx) => {
      const { matched } = matchVehicles(ctx.baseline.vehicles, ctx.renewal.vehicles);
      const results: CheckResult[] = [];

      for (const [basV, renV] of matched) {
        const basZip = (basV as any).garageZip as string | undefined;
        const renZip = (renV as any).garageZip as string | undefined;
        if (!basZip && !renZip) continue;
        if (norm(basZip) !== norm(renZip)) {
          results.push(makeCheck('A-014', {
            field: `Garaging: ${vehicleLabel(renV)}`,
            previousValue: basZip || 'N/A',
            renewalValue: renZip || 'N/A',
            change: `${basZip || 'N/A'} → ${renZip || 'N/A'}`,
            severity: 'info',
            message: `Garaging zip changed for ${vehicleLabel(renV)}`,
            agentAction: 'Garaging address changed — may affect rate territory',
            checkType: 'value_change',
            category: 'Vehicles',
            isBlocking: false,
          }));
        }
      }

      return results.length > 0 ? results : null;
    },
  },
  {
    ruleId: 'A-015',
    name: 'Lienholder Coverage Gap',
    description: 'Flag vehicles with lienholder missing required coverages',
    checkType: 'cross_field',
    category: 'Vehicles',
    phase: 6,
    isBlocking: false,
    lob: 'auto',
    evaluate: (ctx) => {
      const results: CheckResult[] = [];
      for (const v of ctx.renewal.vehicles) {
        const lien = v.lienholder;
        if (!lien) continue;
        // Check vehicle-level coverages + policy-level coverages
        const allCovs = [...(v.coverages || []), ...ctx.renewal.coverages];
        const hasComp = allCovs.some(c => c.type === 'comprehensive');
        const hasColl = allCovs.some(c => c.type === 'collision');
        if (!hasComp || !hasColl) {
          const missing = [!hasComp && 'Comprehensive', !hasColl && 'Collision'].filter(Boolean).join(', ');
          results.push(makeCheck('A-015', {
            field: `Lienholder: ${vehicleLabel(v)}`,
            previousValue: 'Required',
            renewalValue: 'Missing',
            change: `Missing ${missing}`,
            severity: 'warning',
            message: `${vehicleLabel(v)} has lienholder (${lien}) but missing ${missing}`,
            agentAction: 'Lienholder requires Comp/Collision — verify with insured',
            checkType: 'cross_field',
            category: 'Vehicles',
            isBlocking: false,
          }));
        }
      }
      return results.length > 0 ? results : null;
    },
  },
];
