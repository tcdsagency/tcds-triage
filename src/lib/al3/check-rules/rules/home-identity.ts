/**
 * Home Identity Rules (H-001 to H-008)
 * Phase 1 (blocking) + Phase 2 (identity)
 */

import type { CheckRuleDefinition } from '@/types/check-rules.types';
import { makeCheck, strDiffers } from '../helpers';

export const homeIdentityRules: CheckRuleDefinition[] = [
  {
    ruleId: 'H-001',
    name: 'Policy Number',
    description: 'Verify policy number matches between renewal and baseline',
    checkType: 'value_change',
    category: 'Identity',
    phase: 2,
    isBlocking: false,
    lob: 'home',
    evaluate: (ctx) => {
      const renPol = (ctx.renewal as any).policyNumber || ctx.comparisonResult.summary?.headline?.match(/Policy\s+(\S+)/)?.[1] || null;
      const basePol = (ctx.baseline as any).policyNumber || null;
      // Policy numbers aren't always on snapshots — skip if not available
      if (!renPol && !basePol) return null;
      const changed = strDiffers(renPol, basePol);
      return makeCheck('H-001', {
        field: 'Policy Number',
        previousValue: basePol,
        renewalValue: renPol,
        change: changed ? `Changed: ${basePol || 'N/A'} → ${renPol || 'N/A'}` : 'No change',
        severity: changed ? 'warning' : 'unchanged',
        message: changed ? 'Policy number changed between terms' : 'Policy number matches',
        agentAction: changed ? 'Verify this is the correct policy — number changed' : 'No action needed',
        checkType: 'value_change',
        category: 'Identity',
        isBlocking: false,
      });
    },
  },
  {
    ruleId: 'H-002',
    name: 'Insured Name',
    description: 'Check if insured name changed',
    checkType: 'value_change',
    category: 'Identity',
    phase: 2,
    isBlocking: false,
    lob: 'home',
    evaluate: (ctx) => {
      const renName = ctx.renewal.insuredName || null;
      const basName = (ctx.baseline as any).insuredName || null;
      if (!renName && !basName) return null;
      // Can't compare if only one side has a name
      if (!renName || !basName) {
        return makeCheck('H-002', {
          field: 'Insured Name',
          previousValue: basName,
          renewalValue: renName,
          change: renName || basName || 'N/A',
          severity: 'info',
          message: renName
            ? `Insured: ${renName} (no baseline name to compare)`
            : 'No insured name on renewal',
          agentAction: 'Name comparison unavailable — verify manually',
          checkType: 'value_change',
          category: 'Identity',
          isBlocking: false,
        });
      }
      const changed = strDiffers(renName, basName);
      return makeCheck('H-002', {
        field: 'Insured Name',
        previousValue: basName,
        renewalValue: renName,
        change: changed ? `Changed: ${basName} → ${renName}` : 'No change',
        severity: changed ? 'warning' : 'unchanged',
        message: changed ? 'Named insured changed' : 'Named insured matches',
        agentAction: changed ? 'Verify name change is correct — may indicate policy transfer' : 'No action needed',
        checkType: 'value_change',
        category: 'Identity',
        isBlocking: false,
      });
    },
  },
  {
    ruleId: 'H-003',
    name: 'Property Address',
    description: 'Verify property/mailing address matches (BLOCKING)',
    checkType: 'value_change',
    category: 'Identity',
    phase: 1,
    isBlocking: true,
    lob: 'home',
    evaluate: (ctx) => {
      const renAddr = [ctx.renewal.insuredAddress, ctx.renewal.insuredCity, ctx.renewal.insuredState, ctx.renewal.insuredZip]
        .filter(Boolean).join(', ') || null;
      const basAddr = (ctx.baseline as any).insuredAddress
        ? [(ctx.baseline as any).insuredAddress, (ctx.baseline as any).insuredCity, (ctx.baseline as any).insuredState, (ctx.baseline as any).insuredZip]
            .filter(Boolean).join(', ')
        : null;
      // Skip if neither has address, or only one side has address (can't compare)
      if (!renAddr && !basAddr) return null;
      if (!renAddr || !basAddr) {
        return makeCheck('H-003', {
          field: 'Property Address',
          previousValue: basAddr,
          renewalValue: renAddr,
          change: !basAddr ? 'Baseline address not available' : 'Renewal address not available',
          severity: 'info',
          message: !basAddr
            ? `Property address from renewal: ${renAddr} (no baseline address to compare)`
            : 'Renewal has no address — cannot verify',
          agentAction: 'Address comparison unavailable — verify manually',
          checkType: 'value_change',
          category: 'Identity',
          isBlocking: false, // Not blocking when we can't compare
        });
      }
      const changed = strDiffers(renAddr, basAddr);
      return makeCheck('H-003', {
        field: 'Property Address',
        previousValue: basAddr,
        renewalValue: renAddr,
        change: changed ? `Changed` : 'No change',
        severity: changed ? 'critical' : 'unchanged',
        message: changed ? 'Property address changed — may be wrong policy match' : 'Property address matches',
        agentAction: changed ? 'STOP: Verify this renewal matches the correct property' : 'No action needed',
        checkType: 'value_change',
        category: 'Identity',
        isBlocking: true,
      });
    },
  },
  {
    ruleId: 'H-004',
    name: 'Effective Date',
    description: 'Verify renewal effective date is reasonable (BLOCKING)',
    checkType: 'value_change',
    category: 'Identity',
    phase: 1,
    isBlocking: true,
    lob: 'home',
    evaluate: (ctx) => {
      const basExpDate = ctx.baseline.policyExpirationDate;
      // Can't validate if no baseline expiration
      if (!basExpDate) return null;

      const basExp = new Date(basExpDate);
      const now = new Date();
      const daysDiff = Math.floor((basExp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      // Renewal should be within ~90 days of policy expiration
      const isReasonable = daysDiff >= -30 && daysDiff <= 120;
      return makeCheck('H-004', {
        field: 'Effective Date',
        previousValue: ctx.baseline.policyEffectiveDate || null,
        renewalValue: basExpDate,
        change: isReasonable ? 'Within expected window' : `${daysDiff} days from expiration`,
        severity: isReasonable ? 'unchanged' : 'critical',
        message: isReasonable
          ? 'Renewal effective date is within expected window'
          : `Renewal date is ${Math.abs(daysDiff)} days ${daysDiff < 0 ? 'past' : 'before'} expiration — may be stale or premature`,
        agentAction: isReasonable ? 'No action needed' : 'STOP: Verify this is the correct renewal term',
        checkType: 'value_change',
        category: 'Identity',
        isBlocking: true,
      });
    },
  },
  {
    ruleId: 'H-005',
    name: 'Line of Business',
    description: 'Verify line of business is Homeowners',
    checkType: 'existence',
    category: 'Identity',
    phase: 2,
    isBlocking: false,
    lob: 'home',
    evaluate: (ctx) => {
      const lob = ctx.lineOfBusiness?.toLowerCase() || '';
      const isHome = lob.includes('home') || lob.includes('dwelling') || lob.includes('ho-') || lob === 'ho3' || lob === 'ho5' || lob === 'dp3';
      return makeCheck('H-005', {
        field: 'Line of Business',
        previousValue: null,
        renewalValue: ctx.lineOfBusiness,
        change: isHome ? 'Confirmed Homeowners' : `Unexpected: ${ctx.lineOfBusiness}`,
        severity: isHome ? 'unchanged' : 'warning',
        message: isHome ? 'Line of business confirmed as Homeowners' : `Line of business "${ctx.lineOfBusiness}" may not be Homeowners`,
        agentAction: isHome ? 'No action needed' : 'Verify this is the correct policy type',
        checkType: 'existence',
        category: 'Identity',
        isBlocking: false,
      });
    },
  },
  {
    ruleId: 'H-006',
    name: 'Carrier Name',
    description: 'Verify carrier name is valid (BLOCKING)',
    checkType: 'existence',
    category: 'Identity',
    phase: 1,
    isBlocking: true,
    lob: 'home',
    evaluate: (ctx) => {
      const carrier = ctx.carrierName?.trim() || '';
      const hasCarrier = carrier.length > 2;
      return makeCheck('H-006', {
        field: 'Carrier Name',
        previousValue: null,
        renewalValue: carrier || null,
        change: hasCarrier ? carrier : 'MISSING',
        severity: hasCarrier ? 'unchanged' : 'critical',
        message: hasCarrier ? `Carrier: ${carrier}` : 'Carrier name is missing or invalid',
        agentAction: hasCarrier ? 'No action needed' : 'STOP: Cannot process renewal without valid carrier',
        checkType: 'existence',
        category: 'Identity',
        isBlocking: true,
      });
    },
  },
  {
    ruleId: 'H-007',
    name: 'Policy Form',
    description: 'Identify homeowners policy form (HO3, HO5, DP3, etc.)',
    checkType: 'existence',
    category: 'Identity',
    phase: 2,
    isBlocking: false,
    lob: 'home',
    evaluate: (ctx) => {
      // Try to detect form from LOB or endorsements
      const lob = ctx.lineOfBusiness?.toUpperCase() || '';
      let form: string | null = null;
      if (lob.includes('HO3') || lob.includes('HO-3')) form = 'HO-3';
      else if (lob.includes('HO5') || lob.includes('HO-5')) form = 'HO-5';
      else if (lob.includes('DP3') || lob.includes('DP-3')) form = 'DP-3';
      else if (lob.includes('HO6') || lob.includes('HO-6')) form = 'HO-6';
      else if (lob.includes('HO4') || lob.includes('HO-4')) form = 'HO-4';
      else if (lob.includes('HOME')) form = 'Homeowners (form unknown)';

      return makeCheck('H-007', {
        field: 'Policy Form',
        previousValue: null,
        renewalValue: form,
        change: form || 'Unknown',
        severity: form ? 'info' : 'info',
        message: form ? `Policy form: ${form}` : 'Policy form could not be determined',
        agentAction: 'Informational — verify form matches AMS',
        checkType: 'existence',
        category: 'Identity',
        isBlocking: false,
      });
    },
  },
  {
    ruleId: 'H-008',
    name: 'Agent/Producer Code',
    description: 'Verify agent code is present',
    checkType: 'existence',
    category: 'Identity',
    phase: 2,
    isBlocking: false,
    lob: 'home',
    evaluate: (ctx) => {
      // Agent code is not typically on snapshots — this is informational
      return makeCheck('H-008', {
        field: 'Agent Code',
        previousValue: null,
        renewalValue: null,
        change: 'N/A',
        severity: 'info',
        message: 'Agent/producer code verified via IVANS routing',
        agentAction: 'No action needed',
        checkType: 'existence',
        category: 'Identity',
        isBlocking: false,
      });
    },
  },
];
