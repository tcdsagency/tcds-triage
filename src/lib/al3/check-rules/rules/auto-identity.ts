/**
 * Auto Identity Rules (A-001 to A-004)
 * Phase 1 (blocking) + Phase 2 (identity)
 */

import type { CheckRuleDefinition } from '@/types/check-rules.types';
import { makeCheck, strDiffers, norm } from '../helpers';

export const autoIdentityRules: CheckRuleDefinition[] = [
  {
    ruleId: 'A-001',
    name: 'Policy Number',
    description: 'Verify auto policy number matches',
    checkType: 'value_change',
    category: 'Identity',
    phase: 2,
    isBlocking: false,
    lob: 'auto',
    evaluate: (ctx) => {
      const renPol = (ctx.renewal as any).policyNumber || null;
      const basPol = (ctx.baseline as any).policyNumber || null;
      if (!renPol && !basPol) return null;
      const changed = strDiffers(renPol, basPol);
      return makeCheck('A-001', {
        field: 'Policy Number',
        previousValue: basPol,
        renewalValue: renPol,
        change: changed ? `Changed: ${basPol || 'N/A'} → ${renPol || 'N/A'}` : 'No change',
        severity: changed ? 'warning' : 'unchanged',
        message: changed ? 'Policy number changed' : 'Policy number matches',
        agentAction: changed ? 'Verify correct policy — number changed' : 'No action needed',
        checkType: 'value_change',
        category: 'Identity',
        isBlocking: false,
      });
    },
  },
  {
    ruleId: 'A-002',
    name: 'Insured Name',
    description: 'Check insured name on auto policy',
    checkType: 'value_change',
    category: 'Identity',
    phase: 2,
    isBlocking: false,
    lob: 'auto',
    evaluate: (ctx) => {
      const renName = ctx.renewal.insuredName || null;
      const basName = (ctx.baseline as any).insuredName || null;
      if (!renName && !basName) return null;
      if (!renName || !basName) {
        return makeCheck('A-002', {
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
      return makeCheck('A-002', {
        field: 'Insured Name',
        previousValue: basName,
        renewalValue: renName,
        change: changed ? `Changed: ${basName} → ${renName}` : 'No change',
        severity: changed ? 'warning' : 'unchanged',
        message: changed ? 'Named insured changed' : 'Named insured matches',
        agentAction: changed ? 'Verify name change' : 'No action needed',
        checkType: 'value_change',
        category: 'Identity',
        isBlocking: false,
      });
    },
  },
  {
    ruleId: 'A-003',
    name: 'Effective Date',
    description: 'Verify auto renewal effective date (BLOCKING)',
    checkType: 'value_change',
    category: 'Identity',
    phase: 1,
    isBlocking: true,
    lob: 'auto',
    evaluate: (ctx) => {
      const basExpDate = ctx.baseline.policyExpirationDate;
      if (!basExpDate) return null;

      const basExp = new Date(basExpDate);
      const now = new Date();
      const daysDiff = Math.floor((basExp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      const isReasonable = daysDiff >= -30 && daysDiff <= 120;

      return makeCheck('A-003', {
        field: 'Effective Date',
        previousValue: ctx.baseline.policyEffectiveDate || null,
        renewalValue: basExpDate,
        change: isReasonable ? 'Within expected window' : `${daysDiff} days from expiration`,
        severity: isReasonable ? 'unchanged' : 'critical',
        message: isReasonable
          ? 'Renewal date within expected window'
          : `Renewal ${Math.abs(daysDiff)} days ${daysDiff < 0 ? 'past' : 'before'} expiration`,
        agentAction: isReasonable ? 'No action needed' : 'STOP: Verify correct renewal term',
        checkType: 'value_change',
        category: 'Identity',
        isBlocking: true,
      });
    },
  },
  {
    ruleId: 'A-004',
    name: 'Carrier Name',
    description: 'Verify auto carrier name (BLOCKING)',
    checkType: 'existence',
    category: 'Identity',
    phase: 1,
    isBlocking: true,
    lob: 'auto',
    evaluate: (ctx) => {
      const carrier = ctx.carrierName?.trim() || '';
      const hasCarrier = carrier.length > 2;
      return makeCheck('A-004', {
        field: 'Carrier Name',
        previousValue: null,
        renewalValue: carrier || null,
        change: hasCarrier ? carrier : 'MISSING',
        severity: hasCarrier ? 'unchanged' : 'critical',
        message: hasCarrier ? `Carrier: ${carrier}` : 'Carrier name missing',
        agentAction: hasCarrier ? 'No action needed' : 'STOP: Cannot process without carrier',
        checkType: 'existence',
        category: 'Identity',
        isBlocking: true,
      });
    },
  },
  {
    ruleId: 'A-005',
    name: 'Insured Address',
    description: 'Verify insured address matches between terms (BLOCKING)',
    checkType: 'value_change',
    category: 'Identity',
    phase: 1,
    isBlocking: true,
    lob: 'auto',
    evaluate: (ctx) => {
      const renAddr = [ctx.renewal.insuredAddress, ctx.renewal.insuredCity, ctx.renewal.insuredState, ctx.renewal.insuredZip]
        .filter(Boolean).join(', ') || null;
      const basAddr = (ctx.baseline as any).insuredAddress
        ? [(ctx.baseline as any).insuredAddress, (ctx.baseline as any).insuredCity, (ctx.baseline as any).insuredState, (ctx.baseline as any).insuredZip]
            .filter(Boolean).join(', ')
        : null;

      if (!renAddr && !basAddr) return null;
      if (!renAddr || !basAddr) {
        return makeCheck('A-005', {
          field: 'Insured Address',
          previousValue: basAddr,
          renewalValue: renAddr,
          change: !basAddr ? 'Baseline address not available' : 'Renewal address not available',
          severity: 'info',
          message: !basAddr
            ? `Address from renewal: ${renAddr} (no baseline to compare)`
            : 'Renewal has no address — cannot verify',
          agentAction: 'Address comparison unavailable — verify manually',
          checkType: 'value_change',
          category: 'Identity',
          isBlocking: false,
        });
      }

      // Compare zip codes as a quick mismatch indicator
      const renZip = (ctx.renewal.insuredZip || '').trim().slice(0, 5);
      const basZip = ((ctx.baseline as any).insuredZip || '').trim().slice(0, 5);
      const zipChanged = renZip && basZip && renZip !== basZip;
      const fullChanged = norm(renAddr) !== norm(basAddr);

      if (!fullChanged) {
        return makeCheck('A-005', {
          field: 'Insured Address',
          previousValue: basAddr,
          renewalValue: renAddr,
          change: 'No change',
          severity: 'unchanged',
          message: 'Insured address matches',
          agentAction: 'No action needed',
          checkType: 'value_change',
          category: 'Identity',
          isBlocking: true,
        });
      }

      return makeCheck('A-005', {
        field: 'Insured Address',
        previousValue: basAddr,
        renewalValue: renAddr,
        change: 'Changed',
        severity: zipChanged ? 'critical' : 'warning',
        message: zipChanged
          ? 'Insured address AND zip code changed — may be wrong policy match'
          : 'Insured address changed — verify correct policy',
        agentAction: zipChanged
          ? 'STOP: Address zip code changed — verify this renewal matches the correct insured'
          : 'Address changed — confirm with customer, may affect rate territory',
        checkType: 'value_change',
        category: 'Identity',
        isBlocking: true,
      });
    },
  },
];
