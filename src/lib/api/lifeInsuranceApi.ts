/**
 * Life Insurance API Service
 * ==========================
 * Client-side API service for life insurance quotes via Back9 Insurance.
 * Handles quote requests, history management, and AI opportunity fetching.
 */

import {
  QuoteRequestParams,
  QuoteResponse,
  QuoteHistoryItem,
  AICrossSellOpportunity,
  LifeQuoteStatus,
} from '@/types/lifeInsurance.types';

// ============================================================================
// API ENDPOINTS
// ============================================================================

const API_BASE = '/api/life-quotes';

// ============================================================================
// QUOTE OPERATIONS
// ============================================================================

/**
 * Generate life insurance quotes from Back9
 */
export async function generateLifeQuotes(
  params: QuoteRequestParams
): Promise<QuoteResponse> {
  const response = await fetch(API_BASE, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || 'Failed to generate quotes');
  }

  return response.json();
}

/**
 * Save a quote to history
 */
export async function saveQuoteToHistory(
  customerId: string,
  quoteResponse: QuoteResponse
): Promise<QuoteHistoryItem> {
  const response = await fetch(`${API_BASE}/history`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      customerId,
      requestParams: quoteResponse.requestParams,
      quotes: quoteResponse.quotes,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || 'Failed to save quote');
  }

  return response.json();
}

/**
 * Get quote history for a customer
 */
export async function getQuoteHistory(
  customerId: string
): Promise<QuoteHistoryItem[]> {
  const response = await fetch(`${API_BASE}/history?customerId=${customerId}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || 'Failed to fetch quote history');
  }

  const data = await response.json();
  return data.history || [];
}

/**
 * Get a specific quote from history
 */
export async function getQuoteById(
  historyId: string
): Promise<QuoteHistoryItem | null> {
  const response = await fetch(`${API_BASE}/history/${historyId}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    if (response.status === 404) {
      return null;
    }
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || 'Failed to fetch quote');
  }

  return response.json();
}

/**
 * Update quote status
 */
export async function updateQuoteStatus(
  historyId: string,
  status: LifeQuoteStatus
): Promise<QuoteHistoryItem> {
  const response = await fetch(`${API_BASE}/history/${historyId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ status }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || 'Failed to update quote status');
  }

  return response.json();
}

// ============================================================================
// EMAIL OPERATIONS
// ============================================================================

/**
 * Email quote results to customer
 */
export async function emailQuoteToCustomer(
  historyId: string,
  customerEmail: string,
  includeAllQuotes?: boolean
): Promise<{ success: boolean; messageId?: string }> {
  const response = await fetch(`${API_BASE}/email`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      historyId,
      customerEmail,
      includeAllQuotes,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || 'Failed to email quote');
  }

  return response.json();
}

// ============================================================================
// APPLICATION OPERATIONS
// ============================================================================

/**
 * Start an application for a specific quote
 */
export async function startApplication(
  historyId: string,
  quoteId: string
): Promise<{ applicationUrl: string }> {
  const response = await fetch(`${API_BASE}/application`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      historyId,
      quoteId,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || 'Failed to start application');
  }

  return response.json();
}

/**
 * Get illustration PDF URL for a quote
 */
export async function getIllustration(
  quoteId: string
): Promise<{ illustrationUrl: string }> {
  const response = await fetch(`${API_BASE}/illustration/${quoteId}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || 'Failed to get illustration');
  }

  return response.json();
}

// ============================================================================
// AI CROSS-SELL OPERATIONS
// ============================================================================

/**
 * Get AI-generated cross-sell opportunity for a customer
 */
export async function getAICrossSellOpportunity(
  customerId: string
): Promise<AICrossSellOpportunity | null> {
  const response = await fetch(`${API_BASE}/ai-opportunity?customerId=${customerId}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    if (response.status === 404) {
      return null;
    }
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || 'Failed to fetch AI opportunity');
  }

  const data = await response.json();
  return data.opportunity || null;
}

/**
 * Dismiss an AI cross-sell opportunity
 */
export async function dismissAIOpportunity(
  customerId: string,
  reason?: string
): Promise<void> {
  const response = await fetch(`${API_BASE}/ai-opportunity/dismiss`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      customerId,
      reason,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || 'Failed to dismiss opportunity');
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Calculate estimated coverage based on customer data
 */
export function calculateRecommendedCoverage(
  mortgageBalance?: number,
  estimatedIncome?: number,
  numberOfDependents?: number
): { min: number; max: number; suggested: number } {
  const baseAmount = mortgageBalance || 250000;
  const incomeMultiplier = estimatedIncome ? estimatedIncome * 10 : 500000;
  const dependentBonus = (numberOfDependents || 0) * 100000;

  const min = Math.max(100000, baseAmount);
  const max = Math.max(baseAmount + incomeMultiplier + dependentBonus, 1000000);
  const suggested = Math.round((min + max) / 2 / 50000) * 50000; // Round to nearest 50k

  return { min, max, suggested };
}

/**
 * Calculate recommended term length based on age and goals
 */
export function calculateRecommendedTermLength(
  currentAge: number,
  mortgageYearsRemaining?: number
): number {
  // Default to covering until retirement age (65)
  const yearsToRetirement = Math.max(0, 65 - currentAge);

  // Consider mortgage term if available
  const mortgageTerm = mortgageYearsRemaining || 0;

  // Pick the longer of the two, but cap at 30 years
  const recommended = Math.min(30, Math.max(yearsToRetirement, mortgageTerm, 10));

  // Round to standard term lengths
  if (recommended <= 10) return 10;
  if (recommended <= 15) return 15;
  if (recommended <= 20) return 20;
  if (recommended <= 25) return 25;
  return 30;
}

/**
 * Check if customer is eligible for life insurance quotes
 */
export function checkEligibility(
  dateOfBirth: string,
  state: string
): { eligible: boolean; reason?: string } {
  const age = calculateAge(dateOfBirth);

  if (age < 18) {
    return { eligible: false, reason: 'Customer must be at least 18 years old' };
  }

  if (age > 85) {
    return { eligible: false, reason: 'Customer must be 85 years old or younger' };
  }

  // All US states are currently supported
  const validStates = [
    'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
    'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
    'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
    'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
    'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY', 'DC',
  ];

  if (!validStates.includes(state.toUpperCase())) {
    return { eligible: false, reason: 'State not currently supported' };
  }

  return { eligible: true };
}

function calculateAge(dateOfBirth: string): number {
  const today = new Date();
  const birthDate = new Date(dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}
