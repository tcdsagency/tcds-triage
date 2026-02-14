/**
 * Auto Driver Rules (A-020 to A-023)
 * Phase 6 — Driver details
 */

import type { CheckRuleDefinition, CheckResult } from '@/types/check-rules.types';
import { makeCheck, norm } from '../helpers';
import type { CanonicalDriver } from '@/types/renewal.types';

function driverLabel(d: CanonicalDriver): string {
  return d.name || 'Unknown Driver';
}

function matchDrivers(
  basDrivers: CanonicalDriver[],
  renDrivers: CanonicalDriver[]
): { matched: [CanonicalDriver, CanonicalDriver][]; added: CanonicalDriver[]; removed: CanonicalDriver[] } {
  const matched: [CanonicalDriver, CanonicalDriver][] = [];
  const usedRen = new Set<number>();
  const usedBas = new Set<number>();

  // Match by license number first
  for (let bi = 0; bi < basDrivers.length; bi++) {
    const bd = basDrivers[bi];
    if (!bd.licenseNumber) continue;
    for (let ri = 0; ri < renDrivers.length; ri++) {
      if (usedRen.has(ri)) continue;
      const rd = renDrivers[ri];
      if (rd.licenseNumber && norm(rd.licenseNumber) === norm(bd.licenseNumber)) {
        matched.push([bd, rd]);
        usedBas.add(bi);
        usedRen.add(ri);
        break;
      }
    }
  }

  // Match by normalized name
  for (let bi = 0; bi < basDrivers.length; bi++) {
    if (usedBas.has(bi)) continue;
    const bd = basDrivers[bi];
    if (!bd.name) continue;
    for (let ri = 0; ri < renDrivers.length; ri++) {
      if (usedRen.has(ri)) continue;
      const rd = renDrivers[ri];
      if (rd.name && norm(rd.name) === norm(bd.name)) {
        matched.push([bd, rd]);
        usedBas.add(bi);
        usedRen.add(ri);
        break;
      }
    }
  }

  const removed = basDrivers.filter((_, i) => !usedBas.has(i));
  const added = renDrivers.filter((_, i) => !usedRen.has(i));

  return { matched, added, removed };
}

export const autoDriverRules: CheckRuleDefinition[] = [
  {
    ruleId: 'A-020',
    name: 'Driver Added',
    description: 'Detect drivers added in renewal',
    checkType: 'existence',
    category: 'Drivers',
    phase: 6,
    isBlocking: false,
    lob: 'auto',
    evaluate: (ctx) => {
      const { added } = matchDrivers(ctx.baseline.drivers, ctx.renewal.drivers);
      if (added.length === 0) return null;
      return added.map(d =>
        makeCheck('A-020', {
          field: `Driver: ${driverLabel(d)}`,
          previousValue: null,
          renewalValue: driverLabel(d),
          change: `Added: ${driverLabel(d)}`,
          severity: 'added',
          message: `Driver added: ${driverLabel(d)}${d.isExcluded ? ' (EXCLUDED)' : ''}`,
          agentAction: d.isExcluded
            ? 'Excluded driver added — verify exclusion is intentional'
            : 'New driver on policy — confirm with customer',
          checkType: 'existence',
          category: 'Drivers',
          isBlocking: false,
        })
      );
    },
  },
  {
    ruleId: 'A-021',
    name: 'Driver Removed',
    description: 'Detect drivers removed from renewal',
    checkType: 'existence',
    category: 'Drivers',
    phase: 6,
    isBlocking: false,
    lob: 'auto',
    evaluate: (ctx) => {
      const { removed } = matchDrivers(ctx.baseline.drivers, ctx.renewal.drivers);
      if (removed.length === 0) return null;
      return removed.map(d =>
        makeCheck('A-021', {
          field: `Driver: ${driverLabel(d)}`,
          previousValue: driverLabel(d),
          renewalValue: null,
          change: `Removed: ${driverLabel(d)}`,
          severity: 'removed',
          message: `Driver removed: ${driverLabel(d)}`,
          agentAction: 'Driver removed — verify this is correct',
          checkType: 'existence',
          category: 'Drivers',
          isBlocking: false,
        })
      );
    },
  },
  {
    ruleId: 'A-022',
    name: 'Driver Status Change',
    description: 'Check for driver exclusion status changes',
    checkType: 'value_change',
    category: 'Drivers',
    phase: 6,
    isBlocking: false,
    lob: 'auto',
    evaluate: (ctx) => {
      const { matched } = matchDrivers(ctx.baseline.drivers, ctx.renewal.drivers);
      const results: CheckResult[] = [];

      for (const [basD, renD] of matched) {
        // Check exclusion status
        if (basD.isExcluded !== renD.isExcluded) {
          const nowExcluded = renD.isExcluded;
          results.push(makeCheck('A-022', {
            field: `Driver Status: ${driverLabel(renD)}`,
            previousValue: basD.isExcluded ? 'Excluded' : 'Active',
            renewalValue: nowExcluded ? 'Excluded' : 'Active',
            change: nowExcluded ? 'Now EXCLUDED' : 'Now ACTIVE',
            severity: 'warning',
            message: `Driver ${driverLabel(renD)} ${nowExcluded ? 'now excluded' : 'no longer excluded'}`,
            agentAction: nowExcluded
              ? 'Driver now excluded — verify exclusion is documented'
              : 'Driver no longer excluded — may affect premium',
            checkType: 'value_change',
            category: 'Drivers',
            isBlocking: false,
          }));
        }

        // Check relationship change
        if (basD.relationship && renD.relationship && norm(basD.relationship) !== norm(renD.relationship)) {
          results.push(makeCheck('A-022', {
            field: `Driver Relationship: ${driverLabel(renD)}`,
            previousValue: basD.relationship,
            renewalValue: renD.relationship,
            change: `${basD.relationship} → ${renD.relationship}`,
            severity: 'info',
            message: `Driver ${driverLabel(renD)} relationship: ${basD.relationship} → ${renD.relationship}`,
            agentAction: 'Driver relationship changed — verify accuracy',
            checkType: 'value_change',
            category: 'Drivers',
            isBlocking: false,
          }));
        }
      }

      return results.length > 0 ? results : null;
    },
  },
  {
    ruleId: 'A-023',
    name: 'Driver DOB Validation',
    description: 'Validate driver date of birth format and reasonableness',
    checkType: 'format',
    category: 'Drivers',
    phase: 6,
    isBlocking: false,
    lob: 'auto',
    evaluate: (ctx) => {
      const results: CheckResult[] = [];

      for (const d of ctx.renewal.drivers) {
        if (!d.dateOfBirth) continue;
        const dob = new Date(d.dateOfBirth);
        if (isNaN(dob.getTime())) {
          results.push(makeCheck('A-023', {
            field: `DOB: ${driverLabel(d)}`,
            previousValue: null,
            renewalValue: d.dateOfBirth,
            change: 'Invalid date format',
            severity: 'warning',
            message: `Invalid DOB format for ${driverLabel(d)}: "${d.dateOfBirth}"`,
            agentAction: 'DOB format invalid — verify with customer',
            checkType: 'format',
            category: 'Drivers',
            isBlocking: false,
          }));
          continue;
        }

        const age = Math.floor((Date.now() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
        if (age < 14 || age > 110) {
          results.push(makeCheck('A-023', {
            field: `DOB: ${driverLabel(d)}`,
            previousValue: null,
            renewalValue: d.dateOfBirth,
            change: `Age: ${age}`,
            severity: 'warning',
            message: `Driver ${driverLabel(d)} age ${age} seems unreasonable`,
            agentAction: 'Driver age unusual — verify DOB',
            checkType: 'format',
            category: 'Drivers',
            isBlocking: false,
          }));
        }
      }

      return results.length > 0 ? results : null;
    },
  },
];
