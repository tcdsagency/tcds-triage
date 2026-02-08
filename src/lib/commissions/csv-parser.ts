/**
 * Commission CSV Parser
 * Parses CSV files with handling for currency, percentage, and negative formats.
 */

/**
 * Parse a CSV line respecting quoted fields
 */
function parseCSVLine(line: string, delimiter: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === delimiter) {
      fields.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  fields.push(current);
  return fields;
}

/**
 * Parse CSV text into an array of records with normalized headers
 */
export function parseCSV(text: string): { headers: string[]; records: Record<string, string>[] } {
  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 1) return { headers: [], records: [] };

  // Detect delimiter
  const firstLine = lines[0];
  const delimiter = firstLine.includes('\t') ? '\t' : ',';

  const rawHeaders = parseCSVLine(lines[0], delimiter).map((h) => h.trim());
  const headers = rawHeaders.map((h) =>
    h.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
  );

  const records: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i], delimiter);
    const record: Record<string, string> = {};
    headers.forEach((header, idx) => {
      record[header] = values[idx]?.trim() || '';
    });
    if (Object.values(record).some((v) => v)) {
      records.push(record);
    }
  }

  return { headers: rawHeaders, records };
}

/**
 * Parse a currency string to a number.
 * Handles: $1,234.56, ($685.00), -$1,234.56, 1234.56
 */
export function parseCurrency(value: string): number | null {
  if (!value || !value.trim()) return null;

  let cleaned = value.trim();
  let isNegative = false;

  // Handle parenthetical negatives: ($685.00) or (685.00)
  if (cleaned.startsWith('(') && cleaned.endsWith(')')) {
    isNegative = true;
    cleaned = cleaned.slice(1, -1);
  }

  // Handle leading minus
  if (cleaned.startsWith('-')) {
    isNegative = true;
    cleaned = cleaned.slice(1);
  }

  // Remove $ and commas
  cleaned = cleaned.replace(/[$,]/g, '');

  // Handle trailing minus (rare but possible)
  if (cleaned.endsWith('-')) {
    isNegative = true;
    cleaned = cleaned.slice(0, -1);
  }

  const num = parseFloat(cleaned);
  if (isNaN(num)) return null;

  return isNegative ? -num : num;
}

/**
 * Parse a percentage string to a decimal.
 * Handles: 15%, 0.15, 15
 */
export function parsePercentage(value: string): number | null {
  if (!value || !value.trim()) return null;

  let cleaned = value.trim();

  if (cleaned.endsWith('%')) {
    cleaned = cleaned.slice(0, -1);
    const num = parseFloat(cleaned);
    if (isNaN(num)) return null;
    return num / 100;
  }

  const num = parseFloat(cleaned);
  if (isNaN(num)) return null;

  // If value > 1, assume it's a percentage like "15" meaning 15%
  if (num > 1) return num / 100;

  return num;
}

/**
 * Parse a date string from various formats.
 * Returns YYYY-MM-DD or null.
 */
export function parseDate(value: string): string | null {
  if (!value || !value.trim()) return null;

  const cleaned = value.trim();

  // MM/DD/YYYY or M/D/YYYY
  const slashMatch = cleaned.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const [, m, d, y] = slashMatch;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  // YYYY-MM-DD (already correct)
  const isoMatch = cleaned.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) return cleaned;

  // MM-DD-YYYY
  const dashMatch = cleaned.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (dashMatch) {
    const [, m, d, y] = dashMatch;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  return null;
}

/**
 * Map system field names used in field mapping templates
 */
export const SYSTEM_FIELDS = [
  { key: 'policyNumber', label: 'Policy Number', required: true },
  { key: 'carrierName', label: 'Carrier Name', required: false },
  { key: 'insuredName', label: 'Insured Name', required: false },
  { key: 'transactionType', label: 'Transaction Type', required: false },
  { key: 'lineOfBusiness', label: 'Line of Business', required: false },
  { key: 'effectiveDate', label: 'Effective Date', required: false },
  { key: 'statementDate', label: 'Statement Date', required: false },
  { key: 'agentPaidDate', label: 'Agent Paid Date', required: false },
  { key: 'grossPremium', label: 'Gross Premium', required: false },
  { key: 'commissionRate', label: 'Commission Rate', required: false },
  { key: 'commissionAmount', label: 'Commission Amount', required: true },
  { key: 'agentCode', label: 'Agent Code', required: false },
] as const;
