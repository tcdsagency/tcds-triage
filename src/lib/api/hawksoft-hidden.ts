/**
 * HawkSoft Hidden (Cloud) API Client
 * ====================================
 * Accesses undisclosed HawkSoft Cloud APIs (cs.hawksoft.app, agencyauth.hawksoft.app,
 * tasksapi.hawksoft.app) for data not available via the public Integration API.
 *
 * Auth: Cookie-based via Basic Auth → session cookies (50-min TTL, auto-refresh)
 * Separate from hawksoft.ts — different auth mechanism, different base URLs.
 *
 * Provides: client search, policy details with rate change history,
 * AL3 attachment download, renewal alert tasks.
 */

import { CircuitBreaker } from './circuit-breaker';
import { db } from '@/db';
import { customers } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

// ============================================================================
// TYPES
// ============================================================================

export interface HSCloudPolicy {
  id: number;
  number: string;
  status: string; // "Renewal", "Active", "Cancelled", etc.
  carrier: string;
  rate: number;
  annualized_premium: number;
  effective: string; // ISO date
  expiration: string; // ISO date
  lobs: string[];
}

export interface HSCloudRateChange {
  effective: string; // ISO date
  al3_type: number; // 40=Renewal, 41=Quote, 42=Endorsement
  premium_amt: number;
  premium_amt_chg: number;
  premium_pct_chg: number; // decimal, e.g., 0.12 = 12%
}

export interface HSCloudAttachment {
  id: number;
  policy_link?: number;
  description: string;
  file_ext: string;
  al3_type?: number;
  premium_amt?: number;
  premium_amt_chg?: number;
  premium_pct_chg?: number;
  size: number;
}

export interface HSCloudTask {
  category: string;
  status: string;
  priority: string;
  title: string;
  due_date: string;
  client_name: string;
  client_number: string;
  pol_num: string;
  carrier: string;
}

export interface HSCloudClientSummary {
  uuid: string;
  client_number: string;
  name: string;
  first_name?: string;
  last_name?: string;
}

export interface HSCloudClient {
  uuid: string;
  client_number: string;
  name: string;
  first_name?: string;
  last_name?: string;
  policies?: HSCloudPolicy[];
}

interface AuthSession {
  cookies: string;
  csBaseUrl: string;
  tasksBaseUrl: string;
  authenticatedAt: number;
}

// ============================================================================
// CLIENT CLASS
// ============================================================================

const hiddenBreaker = new CircuitBreaker('HawkSoftHidden', 5, 60_000);

// Rate limiter: 500ms minimum gap between requests
let lastRequestTime = 0;

async function rateLimit(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < 500) {
    await new Promise((resolve) => setTimeout(resolve, 500 - elapsed));
  }
  lastRequestTime = Date.now();
}

export class HawkSoftHiddenAPI {
  private session: AuthSession | null = null;
  private readonly username: string;
  private readonly password: string;
  private readonly authUrl = 'https://agencyauth.hawksoft.app';
  private readonly csUrl = 'https://cs.hawksoft.app';
  private readonly tasksUrl = 'https://tasksapi.hawksoft.app';

  // Cookie TTL: 50 minutes (HawkSoft sessions expire ~60 min)
  private static readonly COOKIE_TTL_MS = 50 * 60 * 1000;

  constructor(username: string, password: string) {
    this.username = username;
    this.password = password;
  }

  // --------------------------------------------------------------------------
  // AUTH
  // --------------------------------------------------------------------------

  async authenticate(): Promise<AuthSession> {
    await rateLimit();
    const authHeader = 'Basic ' + Buffer.from(`${this.username}:${this.password}`).toString('base64');

    const response = await fetch(`${this.authUrl}/user/authenticate/cookie`, {
      method: 'GET',
      headers: {
        Authorization: authHeader,
      },
      redirect: 'manual',
    });

    if (!response.ok && response.status !== 302) {
      throw new Error(`HawkSoft Cloud auth failed: ${response.status}`);
    }

    // Extract Set-Cookie headers
    const setCookies = response.headers.getSetCookie?.() || [];
    const cookieStr = setCookies
      .map((c) => c.split(';')[0])
      .join('; ');

    if (!cookieStr) {
      throw new Error('HawkSoft Cloud auth returned no cookies');
    }

    this.session = {
      cookies: cookieStr,
      csBaseUrl: this.csUrl,
      tasksBaseUrl: this.tasksUrl,
      authenticatedAt: Date.now(),
    };

    return this.session;
  }

  private async ensureAuth(): Promise<AuthSession> {
    if (
      this.session &&
      Date.now() - this.session.authenticatedAt < HawkSoftHiddenAPI.COOKIE_TTL_MS
    ) {
      return this.session;
    }
    return this.authenticate();
  }

  // --------------------------------------------------------------------------
  // INTERNAL REQUEST METHOD
  // --------------------------------------------------------------------------

  private async request<T>(
    baseUrl: string,
    endpoint: string,
    options: RequestInit = {},
    retry401 = true
  ): Promise<T> {
    return hiddenBreaker.execute(async () => {
      await rateLimit();
      const session = await this.ensureAuth();

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      let response: Response;
      try {
        response = await fetch(`${baseUrl}${endpoint}`, {
          ...options,
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
            Cookie: session.cookies,
            ...options.headers,
          },
        });
      } catch (error) {
        clearTimeout(timeoutId);
        if (error instanceof Error && error.name === 'AbortError') {
          throw new Error(`HawkSoft Cloud API timeout: ${endpoint}`);
        }
        throw error;
      }

      clearTimeout(timeoutId);

      // Re-auth on 401
      if (response.status === 401 && retry401) {
        this.session = null;
        return this.request<T>(baseUrl, endpoint, options, false);
      }

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`HawkSoft Cloud API error: ${response.status} ${text}`);
      }

      if (response.status === 204) {
        return [] as T;
      }

      return response.json();
    });
  }

  // --------------------------------------------------------------------------
  // CLIENT SEARCH
  // --------------------------------------------------------------------------

  /**
   * Search clients by last name initial letter.
   * POST cs.hawksoft.app/api/client-search
   */
  async searchClients(letter: string): Promise<HSCloudClientSummary[]> {
    return this.request<HSCloudClientSummary[]>(
      this.csUrl,
      '/api/client-search',
      {
        method: 'POST',
        body: JSON.stringify({ letter: letter.toUpperCase() }),
      }
    );
  }

  // --------------------------------------------------------------------------
  // CLIENT DETAILS
  // --------------------------------------------------------------------------

  /**
   * Get client with policies expanded.
   * GET cs.hawksoft.app/api/client/{uuid}?enums&expand=policy
   */
  async getClient(uuid: string): Promise<HSCloudClient> {
    return this.request<HSCloudClient>(
      this.csUrl,
      `/api/client/${uuid}?enums&expand=policy`
    );
  }

  // --------------------------------------------------------------------------
  // RATE CHANGE HISTORY
  // --------------------------------------------------------------------------

  /**
   * Get rate change history for a policy.
   * GET cs.hawksoft.app/api/client/{uuid}/policy/{id}/ratechangehistory
   */
  async getRateChangeHistory(uuid: string, policyId: number): Promise<HSCloudRateChange[]> {
    return this.request<HSCloudRateChange[]>(
      this.csUrl,
      `/api/client/${uuid}/policy/${policyId}/ratechangehistory`
    );
  }

  // --------------------------------------------------------------------------
  // ATTACHMENTS
  // --------------------------------------------------------------------------

  /**
   * Get attachment metadata for a client.
   * GET cs.hawksoft.app/api/client/{uuid}/attachment?&enums
   */
  async getAttachments(uuid: string): Promise<HSCloudAttachment[]> {
    return this.request<HSCloudAttachment[]>(
      this.csUrl,
      `/api/client/${uuid}/attachment?&enums`
    );
  }

  /**
   * Download attachment content (gzip-compressed).
   * GET cs.hawksoft.app/api/client/{uuid}/attachment/{id}/content
   */
  async downloadAttachment(uuid: string, attachmentId: number): Promise<Buffer> {
    await rateLimit();
    const session = await this.ensureAuth();

    const response = await fetch(
      `${this.csUrl}/api/client/${uuid}/attachment/${attachmentId}/content`,
      {
        headers: {
          Cookie: session.cookies,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Attachment download failed: ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  // --------------------------------------------------------------------------
  // TASKS
  // --------------------------------------------------------------------------

  /**
   * Get all tasks.
   * POST tasksapi.hawksoft.app/tasks with {command: 152}
   */
  async getTasks(): Promise<HSCloudTask[]> {
    return this.request<HSCloudTask[]>(
      this.tasksUrl,
      '/tasks',
      {
        method: 'POST',
        body: JSON.stringify({ command: 152 }),
      }
    );
  }

  // --------------------------------------------------------------------------
  // UUID RESOLUTION
  // --------------------------------------------------------------------------

  /**
   * Resolve a HawkSoft client code to a Cloud UUID.
   * 1. Check DB for cached hawksoftCloudUuid
   * 2. If missing, search Hidden API by last name initial
   * 3. Match by client number
   * 4. Cache UUID on customer record
   */
  async resolveCloudUuid(
    hawksoftClientCode: string,
    lastName: string
  ): Promise<string | null> {
    // 1. Check DB cache
    const [customer] = await db
      .select({
        id: customers.id,
        hawksoftCloudUuid: customers.hawksoftCloudUuid,
      })
      .from(customers)
      .where(eq(customers.hawksoftClientCode, hawksoftClientCode))
      .limit(1);

    if (customer?.hawksoftCloudUuid) {
      return customer.hawksoftCloudUuid;
    }

    // 2. Search by last name initial
    const initial = lastName.charAt(0).toUpperCase();
    if (!initial || initial < 'A' || initial > 'Z') {
      return null;
    }

    try {
      const results = await this.searchClients(initial);

      // 3. Match by client number
      const match = results.find(
        (r) => r.client_number === hawksoftClientCode
      );

      if (!match) {
        return null;
      }

      // 4. Cache UUID
      if (customer) {
        await db
          .update(customers)
          .set({ hawksoftCloudUuid: match.uuid })
          .where(eq(customers.id, customer.id));
      }

      return match.uuid;
    } catch (error) {
      console.error(`[HawkSoftHidden] UUID resolution failed for ${hawksoftClientCode}:`, error);
      return null;
    }
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let hiddenClientInstance: HawkSoftHiddenAPI | null = null;

export function getHawkSoftHiddenClient(): HawkSoftHiddenAPI {
  if (!hiddenClientInstance) {
    const username = process.env.HAWKSOFT_CLOUD_USERNAME;
    const password = process.env.HAWKSOFT_CLOUD_PASSWORD;

    if (!username || !password) {
      throw new Error(
        'HawkSoft Cloud credentials not configured (HAWKSOFT_CLOUD_USERNAME, HAWKSOFT_CLOUD_PASSWORD)'
      );
    }

    hiddenClientInstance = new HawkSoftHiddenAPI(username, password);
  }

  return hiddenClientInstance;
}
