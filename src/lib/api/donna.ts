/**
 * Donna AI (AgencyIQ/Crux) API Client
 * ====================================
 * Handles authentication and API calls to Donna AI.
 *
 * Auth flow:
 * 1. POST /am/donna/login with username/password → Session cookies
 * 2. Use session cookies in subsequent requests
 * 3. Session valid ~4 hours, auto-refresh at 3.5 hours
 *
 * Customer ID format: TCDS-{hawksoftClientNumber}
 */

import type {
  DonnaConfig,
  DonnaSession,
  DonnaAPICustomerResponse,
  DonnaAPICustomerDetails,
  DonnaAPIActivitiesResponse,
  DonnaCustomerData,
  DonnaRecommendation,
  DonnaActivity,
} from '@/types/donna.types';

// ============================================================================
// CLIENT CLASS
// ============================================================================

export class DonnaClient {
  private config: DonnaConfig;
  private baseUrl: string;
  private authUrl: string;
  private session: DonnaSession | null = null;

  constructor(config: DonnaConfig) {
    this.config = config;
    this.baseUrl = config.baseUrl || 'https://donna.gocrux.com';
    this.authUrl = config.authUrl || 'https://id-au-ui.gocrux.com';
  }

  // --------------------------------------------------------------------------
  // AUTHENTICATION (Session-based)
  // --------------------------------------------------------------------------

  /**
   * Login to Donna AI and get session cookies
   * Donna uses session-based auth via /am/donna/login
   */
  private async login(): Promise<void> {
    const loginUrl = `${this.authUrl}/am/donna/login`;

    console.log('[Donna] Logging in...');

    const response = await fetch(loginUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        username: this.config.username,
        password: this.config.password,
      }),
      credentials: 'include',
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[Donna] Login failed:', response.status, error);
      throw new Error(`Donna login failed: ${response.status} ${error}`);
    }

    // Extract session cookies from response headers
    const setCookieHeader = response.headers.get('set-cookie');
    const cookies: string[] = [];

    if (setCookieHeader) {
      // Parse multiple cookies from set-cookie header
      const cookieParts = setCookieHeader.split(/,(?=\s*[^;,]+=[^;,]+)/);
      for (const part of cookieParts) {
        const cookieValue = part.split(';')[0].trim();
        if (cookieValue) {
          cookies.push(cookieValue);
        }
      }
    }

    // Also try to get cookies from response body if present
    try {
      const data = await response.json();
      if (data.token) {
        cookies.push(`token=${data.token}`);
      }
      if (data.sessionId) {
        cookies.push(`sessionId=${data.sessionId}`);
      }
    } catch {
      // Response might not be JSON, that's OK
    }

    if (cookies.length === 0) {
      console.warn('[Donna] No cookies received from login response');
    }

    this.session = {
      cookies,
      // Session expires in 4 hours, refresh at 3.5 hours to be safe
      expiresAt: new Date(Date.now() + 3.5 * 60 * 60 * 1000),
    };

    console.log('[Donna] Login successful, session valid until', this.session.expiresAt);
  }

  /**
   * Get valid session, logging in if needed
   */
  private async getSession(): Promise<DonnaSession> {
    if (this.session && new Date() < this.session.expiresAt) {
      return this.session;
    }

    await this.login();

    if (!this.session) {
      throw new Error('Failed to establish Donna session');
    }

    return this.session;
  }

  /**
   * Clear session (force re-login on next request)
   */
  public clearSession(): void {
    this.session = null;
  }

  /**
   * Make authenticated API request
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const session = await this.getSession();

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Cookie: session.cookies.join('; '),
        ...options.headers,
      },
    });

    // Handle session expiry
    if (response.status === 401 || response.status === 403) {
      console.log('[Donna] Session expired, re-authenticating...');
      this.session = null;
      return this.request(endpoint, options);
    }

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Donna API error: ${response.status} ${error}`);
    }

    return response.json();
  }

  // --------------------------------------------------------------------------
  // CUSTOMER DATA API
  // --------------------------------------------------------------------------

  /**
   * Get customer data from Donna AI
   * @param customerId Format: TCDS-{hawksoftClientNumber}
   */
  async getCustomerData(
    customerId: string
  ): Promise<DonnaAPICustomerDetails | null> {
    try {
      const response = await this.request<DonnaAPICustomerResponse>(
        `/api/cov/v1/data/${customerId}`
      );

      if (response.error) {
        console.warn(`[Donna] API returned error for ${customerId}`);
        return null;
      }

      // Extract customer details from nested structure
      const household = response.data?.Household;
      if (!household || !household[customerId]) {
        console.warn(`[Donna] No household data for ${customerId}`);
        return null;
      }

      return household[customerId].customerDetails;
    } catch (error) {
      if (error instanceof Error && error.message.includes('404')) {
        console.log(`[Donna] Customer ${customerId} not found`);
        return null;
      }
      throw error;
    }
  }

  /**
   * Get AI activities/recommendations for a customer
   * @param customerId Format: TCDS-{hawksoftClientNumber}
   */
  async getActivities(customerId: string): Promise<DonnaAPIActivitiesResponse['activities']> {
    try {
      const response = await this.request<DonnaAPIActivitiesResponse>(
        `/api/ai/v1/getActivities/${customerId}`
      );
      return response.activities || [];
    } catch (error) {
      console.warn(`[Donna] Failed to fetch activities for ${customerId}:`, error);
      return [];
    }
  }

  /**
   * Convenience: Get full customer profile including activities
   */
  async getFullCustomerProfile(customerId: string): Promise<{
    data: DonnaAPICustomerDetails | null;
    activities: DonnaAPIActivitiesResponse['activities'];
  }> {
    const [data, activities] = await Promise.all([
      this.getCustomerData(customerId),
      this.getActivities(customerId),
    ]);

    return { data, activities };
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let clientInstance: DonnaClient | null = null;

/**
 * Get singleton Donna client instance
 */
export function getDonnaClient(): DonnaClient {
  if (!clientInstance) {
    const username = process.env.DONNA_USERNAME;
    const password = process.env.DONNA_PASSWORD;

    if (!username || !password) {
      throw new Error(
        'Donna credentials not configured. Set DONNA_USERNAME and DONNA_PASSWORD environment variables.'
      );
    }

    clientInstance = new DonnaClient({
      username,
      password,
      baseUrl: process.env.DONNA_BASE_URL,
      authUrl: process.env.DONNA_AUTH_URL,
    });
  }

  return clientInstance;
}

/**
 * Create a new Donna client with custom config (for tenant-specific credentials)
 */
export function createDonnaClient(config: DonnaConfig): DonnaClient {
  return new DonnaClient(config);
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get Donna customer ID from HawkSoft client code
 * Format: TCDS-{hawksoftClientNumber}
 */
export function getDonnaCustomerId(
  hawksoftClientCode: string | null | undefined
): string | null {
  if (!hawksoftClientCode) return null;
  return `TCDS-${hawksoftClientCode}`;
}

/**
 * Transform raw Donna API data to our storage format
 */
export function transformDonnaData(
  details: DonnaAPICustomerDetails,
  activities: DonnaAPIActivitiesResponse['activities'],
  donnaId: string
): DonnaCustomerData {
  // Parse sentiment score (comes as string)
  const sentimentScore = parseInt(details['KPI SENTIMETER Value'] || '50', 10);

  // Parse VIP status ('Y'/'N' strings)
  const isPersonalVIP = details.DvCustomerPersonalVIP === 'Y';
  const isCommercialVIP = details.DvCustomerCommercialVIP === 'Y';

  // Parse probabilities (already numbers)
  const retentionProbability = details.GbProbabilityRetention ?? 0.5;
  const crossSellProbability = details.GbProbabilityRoundout ?? 0;

  // Parse financial metrics
  const estimatedWalletSize = details.DvPLExpectedSpend ?? 0;
  const currentAnnualPremium = details.DvCustomerAnnualPremium ?? 0;
  const potentialGap = estimatedWalletSize - currentAnnualPremium;

  // Transform recommendations
  const recommendations: DonnaRecommendation[] = activities
    .filter((act) => act.type === 'RoundOut' || act.recommendation)
    .map((act, idx) => ({
      id: `rec-${idx}`,
      type: act.type || 'general',
      priority: normalizePriority(act.priority),
      title: act.type || 'Recommendation',
      description: act.recommendation || '',
      estimatedPremium: act.estimatedPremium,
      confidence: act.confidence,
    }));

  // Transform activities
  const activityItems: DonnaActivity[] = activities.map((act, idx) => ({
    id: `act-${idx}`,
    type: act.type || 'unknown',
    createdAt: new Date().toISOString(),
    summary: act.recommendation || act.type || 'Activity',
    priority: act.priority,
  }));

  return {
    sentimentScore,
    isPersonalVIP,
    isCommercialVIP,
    retentionProbability,
    crossSellProbability,
    estimatedWalletSize,
    currentAnnualPremium,
    potentialGap,
    recommendations,
    activities: activityItems,
    lastSyncedAt: new Date().toISOString(),
    donnaCustomerId: donnaId,
  };
}

/**
 * Normalize priority string to our enum
 */
function normalizePriority(
  priority: string | undefined
): 'high' | 'medium' | 'low' {
  const p = priority?.toLowerCase();
  if (p === 'high' || p === 'urgent' || p === 'critical') return 'high';
  if (p === 'low' || p === 'minor') return 'low';
  return 'medium';
}
