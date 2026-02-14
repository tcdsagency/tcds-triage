/**
 * Check Rules Helpers
 * ===================
 * Shared utilities for formatting check results.
 */

import type { CheckResult, CheckSeverity, CheckType } from '@/types/check-rules.types';

/**
 * Format a dollar amount for display.
 */
export function fmtDollars(value: number | null | undefined): string {
  if (value == null) return 'N/A';
  return '$' + value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

/**
 * Format a percentage for display.
 */
export function fmtPercent(value: number | null | undefined): string {
  if (value == null) return 'N/A';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
}

/**
 * Format a dollar change with optional percentage.
 */
export function fmtDollarChange(
  oldVal: number | null | undefined,
  newVal: number | null | undefined
): string {
  if (oldVal == null && newVal == null) return 'N/A';
  if (oldVal == null) return `Added: ${fmtDollars(newVal)}`;
  if (newVal == null) return 'REMOVED';
  const diff = newVal - oldVal;
  if (diff === 0) return 'No change';
  const pct = oldVal !== 0 ? (diff / oldVal) * 100 : 0;
  const sign = diff > 0 ? '+' : '';
  return `${sign}${fmtDollars(diff)} (${fmtPercent(pct)})`;
}

/**
 * Create a check result with defaults.
 */
export function makeCheck(
  ruleId: string,
  opts: {
    field: string;
    previousValue?: string | number | null;
    renewalValue?: string | number | null;
    change: string;
    severity: CheckSeverity;
    message: string;
    agentAction: string;
    checkType: CheckType;
    category: string;
    isBlocking: boolean;
  }
): CheckResult {
  return {
    ruleId,
    field: opts.field,
    previousValue: opts.previousValue ?? null,
    renewalValue: opts.renewalValue ?? null,
    change: opts.change,
    severity: opts.severity,
    message: opts.message,
    agentAction: opts.agentAction,
    reviewed: false,
    reviewedBy: null,
    reviewedAt: null,
    checkType: opts.checkType,
    category: opts.category,
    isBlocking: opts.isBlocking,
  };
}

/**
 * Normalize a string for comparison (trim, lowercase).
 */
export function norm(s: string | null | undefined): string {
  return (s || '').trim().toLowerCase();
}

/**
 * Check if two string values differ (case-insensitive, trimmed).
 */
export function strDiffers(a: string | null | undefined, b: string | null | undefined): boolean {
  return norm(a) !== norm(b);
}

/**
 * Safe percentage change between two numbers.
 */
export function pctChange(oldVal: number, newVal: number): number {
  if (oldVal === 0) return newVal === 0 ? 0 : 100;
  return ((newVal - oldVal) / oldVal) * 100;
}
