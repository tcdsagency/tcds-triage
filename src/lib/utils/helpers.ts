/**
 * Common Utilities
 * ================
 * Shared helper functions used across the application
 */

// ============================================================================
// PHONE NORMALIZATION
// ============================================================================

/**
 * Normalize phone number to canonical format: +1XXXXXXXXXX
 * Handles:
 * - +18005551234
 * - 8005551234
 * - (800) 555-1234
 * - 800-555-1234
 * - 1-800-555-1234
 */
export function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  
  // Strip all non-digits
  const digits = phone.replace(/\D/g, '');
  
  // 10 digits: assume US number, add +1
  if (digits.length === 10) {
    return `+1${digits}`;
  }
  
  // 11 digits starting with 1: add + prefix
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }
  
  // Already has country code or international
  if (digits.length > 11) {
    return `+${digits}`;
  }
  
  // Invalid/short number - return as-is for logging
  return digits || null;
}

/**
 * Format phone for display: (XXX) XXX-XXXX
 */
export function formatPhoneDisplay(phone: string | null | undefined): string {
  if (!phone) return '';
  
  const normalized = normalizePhone(phone);
  if (!normalized) return phone;
  
  // Extract 10-digit portion
  const digits = normalized.replace(/\D/g, '');
  const last10 = digits.slice(-10);
  
  if (last10.length !== 10) return phone;
  
  return `(${last10.slice(0, 3)}) ${last10.slice(3, 6)}-${last10.slice(6)}`;
}

/**
 * Compare two phone numbers for equality
 */
export function phonesMatch(phone1: string | null | undefined, phone2: string | null | undefined): boolean {
  const n1 = normalizePhone(phone1);
  const n2 = normalizePhone(phone2);
  
  if (!n1 || !n2) return false;
  return n1 === n2;
}

// ============================================================================
// EMAIL NORMALIZATION
// ============================================================================

/**
 * Normalize email to lowercase, trimmed
 */
export function normalizeEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  return email.trim().toLowerCase();
}

/**
 * Compare two emails for equality
 */
export function emailsMatch(email1: string | null | undefined, email2: string | null | undefined): boolean {
  const n1 = normalizeEmail(email1);
  const n2 = normalizeEmail(email2);
  
  if (!n1 || !n2) return false;
  return n1 === n2;
}

// ============================================================================
// NAME UTILITIES
// ============================================================================

/**
 * Get display name with preference for nickname
 */
export function getDisplayName(params: {
  firstName?: string | null;
  lastName?: string | null;
  preferredName?: string | null;
  fullName?: string | null;
}): string {
  const { firstName, lastName, preferredName, fullName } = params;
  
  // If we have a full name already, use it
  if (fullName) return fullName;
  
  // Prefer nickname/preferred name for first name
  const displayFirst = preferredName || firstName || '';
  const displayLast = lastName || '';
  
  return `${displayFirst} ${displayLast}`.trim() || 'Unknown';
}

/**
 * Parse a full name into first/last
 */
export function parseName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/);
  
  if (parts.length === 0) {
    return { firstName: '', lastName: '' };
  }
  
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: '' };
  }
  
  // Last word is last name, everything else is first name
  const lastName = parts.pop() || '';
  const firstName = parts.join(' ');
  
  return { firstName, lastName };
}

// ============================================================================
// DATE UTILITIES
// ============================================================================

/**
 * Check if current time is within business hours
 * Default: 9 AM - 6 PM CST, weekdays
 */
export function isBusinessHours(params?: {
  startHour?: number;
  endHour?: number;
  timezone?: string;
}): boolean {
  const { startHour = 9, endHour = 18, timezone = 'America/Chicago' } = params || {};
  
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: 'numeric',
    hour12: false,
    weekday: 'short',
  });
  
  const parts = formatter.formatToParts(now);
  const hour = parseInt(parts.find(p => p.type === 'hour')?.value || '0');
  const weekday = parts.find(p => p.type === 'weekday')?.value || '';
  
  // Check if weekend
  if (['Sat', 'Sun'].includes(weekday)) {
    return false;
  }
  
  // Check if within hours
  return hour >= startHour && hour < endHour;
}

/**
 * Get next business hours start time
 */
export function getNextBusinessHoursStart(params?: {
  startHour?: number;
  timezone?: string;
}): Date {
  const { startHour = 9, timezone = 'America/Chicago' } = params || {};
  
  const now = new Date();
  const result = new Date(now);
  
  // Set to start hour
  result.setHours(startHour, 0, 0, 0);
  
  // If we're past start hour today, move to tomorrow
  if (now.getHours() >= startHour) {
    result.setDate(result.getDate() + 1);
  }
  
  // Skip weekends
  while (result.getDay() === 0 || result.getDay() === 6) {
    result.setDate(result.getDate() + 1);
  }
  
  return result;
}

// ============================================================================
// RETRY UTILITIES
// ============================================================================

/**
 * Exponential backoff delays for transcript worker
 * 30s → 60s → 60s → 120s → ... up to 600s max
 */
export function getBackoffDelay(attempt: number, maxDelay: number = 600000): number {
  const baseDelays = [30000, 60000, 60000, 120000, 240000, 480000];
  
  if (attempt < baseDelays.length) {
    return baseDelays[attempt];
  }
  
  return Math.min(maxDelay, baseDelays[baseDelays.length - 1] * Math.pow(2, attempt - baseDelays.length));
}

/**
 * Sleep for a given number of milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================================
// CUSTOMER RESOLUTION UTILITIES
// ============================================================================

/**
 * Sort customers by priority: prefer customers over leads, then by policy count
 */
export function sortByCustomerPriority<T extends { 
  contactType?: string; 
  activePolicyCount?: number;
}>(records: T[]): T[] {
  return [...records].sort((a, b) => {
    // Customers first
    const aIsCustomer = a.contactType === 'customer' ? 1 : 0;
    const bIsCustomer = b.contactType === 'customer' ? 1 : 0;
    if (aIsCustomer !== bIsCustomer) return bIsCustomer - aIsCustomer;
    
    // Then by policy count
    const aPolicies = a.activePolicyCount || 0;
    const bPolicies = b.activePolicyCount || 0;
    return bPolicies - aPolicies;
  });
}

/**
 * Find best customer match from multiple records
 */
export function findBestCustomerMatch<T extends { 
  contactType?: string; 
  activePolicyCount?: number;
}>(records: T[]): T | null {
  if (records.length === 0) return null;
  
  const sorted = sortByCustomerPriority(records);
  return sorted[0];
}
