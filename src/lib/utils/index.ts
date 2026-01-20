import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPhoneNumber(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    return `(${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
  }
  return phone;
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

export function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(date));
}

export function formatDateTime(date: Date | string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(date));
}

export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return `${str.slice(0, length)}...`;
}

// VIN decoder helper
export function isValidVin(vin: string): boolean {
  if (vin.length !== 17) return false;
  const invalidChars = /[IOQ]/i;
  return !invalidChars.test(vin);
}

// Phone number validation
export function isValidPhone(phone: string): boolean {
  const cleaned = phone.replace(/\D/g, '');
  return cleaned.length === 10 || (cleaned.length === 11 && cleaned.startsWith('1'));
}

// Email validation
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Debounce function with cancel support
export interface DebouncedFunction<T extends (...args: any[]) => any> {
  (...args: Parameters<T>): void;
  cancel: () => void;
}

export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): DebouncedFunction<T> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const debouncedFn = function (...args: Parameters<T>) {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      func(...args);
    }, wait);
  } as DebouncedFunction<T>;

  debouncedFn.cancel = function () {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  return debouncedFn;
}

/**
 * Normalize name to Title Case
 * Handles ALL CAPS, lowercase, and mixed case names
 * Special handling for: McDonald, O'Brien, Van Der, etc.
 */
export function normalizeName(name: string | null | undefined): string {
  if (!name) return '';

  // If already mixed case (not all caps or all lowercase), return as-is
  const isAllCaps = name === name.toUpperCase() && /[A-Z]/.test(name);
  const isAllLower = name === name.toLowerCase();

  if (!isAllCaps && !isAllLower) {
    return name;
  }

  return name
    .toLowerCase()
    .split(' ')
    .map(word => {
      if (!word) return '';

      // Handle hyphenated names (Mary-Jane)
      if (word.includes('-')) {
        return word.split('-').map(part =>
          part.charAt(0).toUpperCase() + part.slice(1)
        ).join('-');
      }

      // Handle apostrophes (O'Brien, D'Angelo)
      if (word.includes("'")) {
        const parts = word.split("'");
        return parts.map(part =>
          part.charAt(0).toUpperCase() + part.slice(1)
        ).join("'");
      }

      // Handle Mc/Mac names (McDonald, MacArthur)
      if (word.startsWith('mc') && word.length > 2) {
        return 'Mc' + word.charAt(2).toUpperCase() + word.slice(3);
      }
      if (word.startsWith('mac') && word.length > 3) {
        return 'Mac' + word.charAt(3).toUpperCase() + word.slice(4);
      }

      // Standard title case
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}

/**
 * Format full name from first/last, normalizing case
 */
export function formatFullName(firstName?: string | null, lastName?: string | null): string {
  const first = normalizeName(firstName);
  const last = normalizeName(lastName);
  return [first, last].filter(Boolean).join(' ') || 'Unknown';
}
