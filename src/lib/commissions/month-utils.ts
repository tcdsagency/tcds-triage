/**
 * Month Utilities
 * Reporting month derivation and navigation helpers.
 */

import { format, parse, subMonths, addMonths } from 'date-fns';

/**
 * Derive reporting month from agent paid date.
 * agentPaidDate of "2026-01-16" → "2026-01"
 */
export function getReportingMonth(agentPaidDate: string | null): string {
  if (!agentPaidDate) {
    return format(new Date(), 'yyyy-MM');
  }

  // Try parsing YYYY-MM-DD
  try {
    const date = parse(agentPaidDate, 'yyyy-MM-dd', new Date());
    return format(date, 'yyyy-MM');
  } catch {
    // Try MM/DD/YYYY
    try {
      const date = parse(agentPaidDate, 'MM/dd/yyyy', new Date());
      return format(date, 'yyyy-MM');
    } catch {
      return format(new Date(), 'yyyy-MM');
    }
  }
}

/**
 * Get the current reporting month (YYYY-MM)
 */
export function getCurrentMonth(): string {
  return format(new Date(), 'yyyy-MM');
}

/**
 * Get the previous month from a given month string
 */
export function getPreviousMonth(month: string): string {
  const date = parse(month + '-01', 'yyyy-MM-dd', new Date());
  return format(subMonths(date, 1), 'yyyy-MM');
}

/**
 * Get the next month from a given month string
 */
export function getNextMonth(month: string): string {
  const date = parse(month + '-01', 'yyyy-MM-dd', new Date());
  return format(addMonths(date, 1), 'yyyy-MM');
}

/**
 * Format a reporting month for display: "2026-01" → "January 2026"
 */
export function formatMonth(month: string): string {
  try {
    const date = parse(month + '-01', 'yyyy-MM-dd', new Date());
    return format(date, 'MMMM yyyy');
  } catch {
    return month;
  }
}

/**
 * Get a list of months from start to end (inclusive)
 */
export function getMonthRange(startMonth: string, endMonth: string): string[] {
  const months: string[] = [];
  let current = startMonth;
  while (current <= endMonth) {
    months.push(current);
    current = getNextMonth(current);
  }
  return months;
}

/**
 * Get last N months including current
 */
export function getLastNMonths(n: number): string[] {
  const months: string[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    months.push(format(subMonths(now, i), 'yyyy-MM'));
  }
  return months;
}
