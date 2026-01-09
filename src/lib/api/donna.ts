/**
 * Donna AI (AgencyIQ/Crux) API Client
 * ====================================
 * Handles authentication and API calls to Donna AI.
 *
 * Auth flow (OAuth2):
 * 1. GET /api/auth/login → Redirects to OAuth authorize
 * 2. GET /am/donna/login → Returns login form
 * 3. POST /am/donna/login with credentials + XSRF token
 * 4. Follow redirects to callback with auth code
 * 5. Session cookies are set, valid ~4 hours
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
  private session: DonnaSession | null = null;
  private loginPromise: Promise<void> | null = null; // Prevent concurrent logins

  constructor(config: DonnaConfig) {
    this.config = config;
    this.baseUrl = config.baseUrl || 'https://donna.gocrux.com';
  }

  // --------------------------------------------------------------------------
  // AUTHENTICATION (OAuth2 flow)
  // --------------------------------------------------------------------------

  /**
   * Extract cookies from response headers
   */
  private extractCookies(headers: Headers): string[] {
    const setCookies: string[] = [];
    // @ts-ignore - getSetCookie exists in Node 18+
    const rawCookies = headers.getSetCookie?.() || [];
    for (const cookie of rawCookies) {
      const cookieValue = cookie.split(';')[0].trim();
      if (cookieValue && !cookieValue.startsWith('Secure') && !cookieValue.startsWith('HttpOnly')) {
        setCookies.push(cookieValue);
      }
    }
    return setCookies;
  }

  /**
   * Update cookies, replacing existing ones with same name
   */
  private updateCookies(allCookies: string[], newCookies: string[]): string[] {
    for (const cookie of newCookies) {
      const name = cookie.split('=')[0];
      allCookies = allCookies.filter(c => !c.startsWith(name + '='));
      allCookies.push(cookie);
    }
    return allCookies;
  }

  /**
   * Login to Donna AI using OAuth2 flow
   */
  private async login(): Promise<void> {
    console.log('[Donna] Starting OAuth2 login flow...');
    let allCookies: string[] = [];

    // Step 1: Start OAuth flow at donna.gocrux.com
    const startResponse = await fetch(`${this.baseUrl}/api/auth/login`, {
      redirect: 'manual'
    });
    allCookies = this.updateCookies(allCookies, this.extractCookies(startResponse.headers));
    const authorizeUrl = startResponse.headers.get('location');

    if (!authorizeUrl) {
      throw new Error('Donna OAuth: No authorize URL in response');
    }

    // Step 2: Get OAuth authorize page (redirects to login form)
    const authorizeResponse = await fetch(authorizeUrl, {
      redirect: 'manual',
      headers: { Cookie: allCookies.join('; ') }
    });
    allCookies = this.updateCookies(allCookies, this.extractCookies(authorizeResponse.headers));
    const loginUrl = authorizeResponse.headers.get('location');

    if (!loginUrl) {
      throw new Error('Donna OAuth: No login URL from authorize');
    }

    // Step 3: Get login form to extract XSRF token
    const loginFormResponse = await fetch(loginUrl, {
      redirect: 'manual',
      headers: { Cookie: allCookies.join('; ') }
    });
    allCookies = this.updateCookies(allCookies, this.extractCookies(loginFormResponse.headers));

    const html = await loginFormResponse.text();

    // Extract form action URL
    const actionMatch = html.match(/action="([^"]+)"/);
    let formAction = actionMatch?.[1] || loginUrl;
    formAction = formAction.replace(/&amp;/g, '&');

    // Extract hidden fields (XSRF token, client_id)
    const hiddenFields: Record<string, string> = {};
    const patterns = [
      /<input[^>]+type="hidden"[^>]+name="([^"]+)"[^>]+value="([^"]*)"[^>]*>/gi,
      /<input[^>]+name="([^"]+)"[^>]+type="hidden"[^>]+value="([^"]*)"[^>]*>/gi,
      /<input[^>]+value="([^"]*)"[^>]+name="([^"]+)"[^>]+type="hidden"[^>]*>/gi
    ];
    for (const pattern of patterns) {
      const matches = html.matchAll(pattern);
      for (const match of matches) {
        // Pattern might swap name/value positions
        if (match[1].startsWith('X-') || match[1] === 'client_id') {
          hiddenFields[match[1]] = match[2];
        } else if (match[2].startsWith('X-') || match[2] === 'client_id') {
          hiddenFields[match[2]] = match[1];
        }
      }
    }

    // Step 4: Submit login form
    const formData = new URLSearchParams({
      ...hiddenFields,
      username: this.config.username,
      password: this.config.password,
    });

    console.log('[Donna] Submitting login credentials...');
    const submitResponse = await fetch(formAction, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Cookie: allCookies.join('; ')
      },
      body: formData.toString(),
      redirect: 'manual'
    });
    allCookies = this.updateCookies(allCookies, this.extractCookies(submitResponse.headers));

    if (submitResponse.status !== 302) {
      throw new Error(`Donna login failed with status ${submitResponse.status}`);
    }

    // Step 5: Follow redirects to complete OAuth flow
    let redirectUrl = submitResponse.headers.get('location');
    if (redirectUrl) {
      redirectUrl = redirectUrl.replace(/&amp;/g, '&');
    }

    let lastHost = 'https://id-au-ui.gocrux.com'; // Start with auth server
    for (let i = 0; i < 10 && redirectUrl; i++) {
      // Handle relative URLs - use the last host we were on
      let fullUrl = redirectUrl;
      if (redirectUrl.startsWith('/')) {
        fullUrl = lastHost + redirectUrl;
      } else {
        // Update lastHost from absolute URL
        try {
          lastHost = new URL(redirectUrl).origin;
        } catch {}
      }

      const response = await fetch(fullUrl, {
        redirect: 'manual',
        headers: { Cookie: allCookies.join('; ') }
      });
      allCookies = this.updateCookies(allCookies, this.extractCookies(response.headers));

      if (response.status !== 302 && response.status !== 301) {
        break;
      }

      redirectUrl = response.headers.get('location');
      if (redirectUrl) {
        redirectUrl = redirectUrl.replace(/&amp;/g, '&');
      }
    }

    // Verify we got the session cookie
    const hasSessionCookie = allCookies.some(c => c.startsWith('donna-prod='));
    if (!hasSessionCookie) {
      console.warn('[Donna] No donna-prod session cookie found');
    }

    this.session = {
      cookies: allCookies,
      expiresAt: new Date(Date.now() + 3.5 * 60 * 60 * 1000),
    };

    console.log('[Donna] Login successful, session valid until', this.session.expiresAt);
  }

  /**
   * Get valid session, logging in if needed
   * Uses a lock to prevent concurrent login attempts
   */
  private async getSession(): Promise<DonnaSession> {
    if (this.session && new Date() < this.session.expiresAt) {
      return this.session;
    }

    // If a login is already in progress, wait for it
    if (this.loginPromise) {
      await this.loginPromise;
      if (this.session) return this.session;
    }

    // Start a new login and store the promise
    this.loginPromise = this.login();
    try {
      await this.loginPromise;
    } finally {
      this.loginPromise = null;
    }

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
    options: RequestInit = {},
    retryCount = 0
  ): Promise<T> {
    const session = await this.getSession();

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      redirect: 'manual', // Don't follow redirects - they indicate session issues
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Cookie: session.cookies.join('; '),
        ...options.headers,
      },
    });

    // Handle session expiry (redirect, 401/403, or HTML response)
    const contentType = response.headers.get('content-type') || '';
    const isHtmlResponse = contentType.includes('text/html');
    const isRedirect = response.status === 302 || response.status === 301;

    if (response.status === 401 || response.status === 403 || isHtmlResponse || isRedirect) {
      if (retryCount >= 2) {
        throw new Error(`Donna API: Session keeps expiring after ${retryCount} retries`);
      }
      console.log(`[Donna] Session expired (status=${response.status}), re-authenticating...`);
      this.session = null;
      return this.request(endpoint, options, retryCount + 1);
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
    // Sequential calls to avoid session issues with parallel requests
    const data = await this.getCustomerData(customerId);
    const activities = await this.getActivities(customerId);

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
