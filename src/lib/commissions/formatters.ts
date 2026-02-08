/**
 * Commission Formatters
 * Currency, percentage, and display formatting helpers.
 */

/**
 * Format a number as currency: $1,234.56
 */
export function formatCurrency(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '$0.00';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '$0.00';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

/**
 * Format a decimal rate as percentage: 0.15 → "15.00%"
 */
export function formatPercent(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '0%';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '0%';
  // If value appears to already be a percentage (> 1), don't multiply
  const pct = num > 1 ? num : num * 100;
  return `${pct.toFixed(2)}%`;
}

/**
 * Format a split percentage for display: "50.00" → "50%"
 */
export function formatSplitPercent(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return '0%';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '0%';
  return num % 1 === 0 ? `${num}%` : `${num.toFixed(1)}%`;
}

/**
 * Format a transaction type for display
 */
export function formatTransactionType(type: string | null | undefined): string {
  if (!type) return 'Other';
  return type
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Format agent role for display
 */
export function formatAgentRole(role: string): string {
  const roleMap: Record<string, string> = {
    owner: 'Owner',
    producer: 'Producer',
    csr: 'CSR',
    house: 'House',
  };
  return roleMap[role] || role;
}

/**
 * Format a date string for display: "2026-01-15" → "01/15/2026"
 */
export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

/**
 * Format a reconciliation status for display with color class
 */
export function getReconciliationStatusInfo(status: string): { label: string; color: string } {
  const statusMap: Record<string, { label: string; color: string }> = {
    matched: { label: 'Matched', color: 'bg-green-100 text-green-800' },
    discrepancy: { label: 'Discrepancy', color: 'bg-red-100 text-red-800' },
    unmatched: { label: 'Unmatched', color: 'bg-yellow-100 text-yellow-800' },
    partial_match: { label: 'Partial Match', color: 'bg-orange-100 text-orange-800' },
    resolved: { label: 'Resolved', color: 'bg-blue-100 text-blue-800' },
  };
  return statusMap[status] || { label: status, color: 'bg-gray-100 text-gray-800' };
}

/**
 * Format anomaly severity with color class
 */
export function getAnomalySeverityInfo(severity: string): { label: string; color: string } {
  const map: Record<string, { label: string; color: string }> = {
    info: { label: 'Info', color: 'bg-blue-100 text-blue-800' },
    warning: { label: 'Warning', color: 'bg-yellow-100 text-yellow-800' },
    error: { label: 'Error', color: 'bg-red-100 text-red-800' },
  };
  return map[severity] || { label: severity, color: 'bg-gray-100 text-gray-800' };
}
