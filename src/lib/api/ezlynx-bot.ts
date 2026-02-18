/**
 * EZLynx Bot API Client
 * =====================
 * Typed client wrapping the EZLynx Bot HTTP API (Express/Playwright automation).
 * Bot runs at EZLYNX_BOT_URL (default: http://75.37.55.209:5000).
 * Auth: Basic auth (admin:password) + optional API key for webhooks.
 */

// =============================================================================
// TYPES
// =============================================================================

export interface BotStatus {
  state: string; // 'idle' | 'authenticated' | 'launching' | 'awaiting_2fa' | 'error'
  error?: string;
}

export interface SearchResult {
  applicantFirstName: string;
  applicantLastName: string;
  accountId: string;
  created: string;
  dateOfBirth?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  matchScore?: number;
}

export interface ApplicantDetails {
  success: boolean;
  applicant?: any; // Full EZLynx applicant object
  error?: string;
}

export interface CreateApplicantResult {
  success: boolean;
  ezlynxId?: string;
  method?: string;
  error?: string;
}

export interface UpdateApplicantResult {
  success: boolean;
  error?: string;
}

export interface DeleteApplicantResult {
  success: boolean;
  error?: string;
}

export interface QuoteResult {
  success: boolean;
  jobId?: number;
  method?: string;
  error?: string;
}

export interface QuoteJob {
  id: number;
  accountId: string;
  quoteType: string;
  status: string;
  errorMessage?: string;
  method?: string;
  processedAt?: string;
  createdAt: string;
}

export interface ActivityLog {
  id: number;
  action: string;
  target: string;
  status: string;
  details?: string;
  createdAt: string;
}

export interface CreateApplicantData {
  firstName: string;
  lastName: string;
  middleName?: string;
  suffix?: string;
  dateOfBirth?: string;
  gender?: string;
  maritalStatus?: string;
  email?: string;
  phone?: string;
  addressLine1?: string;
  addressCity?: string;
  addressState?: string;
  addressZip?: string;
  yearsAtAddress?: number;
  monthsAtAddress?: number;
  prevAddressLine1?: string;
  prevAddressCity?: string;
  prevAddressState?: string;
  prevAddressZip?: string;
  prevYearsAtAddress?: number;
  prevMonthsAtAddress?: number;
  occupation?: string;
  industry?: string;
  employerName?: string;
  employerPhone?: string;
  employerAddress?: string;
  employerCity?: string;
  employerState?: string;
  employerZip?: string;
  yearsInLineOfWork?: number;
  employmentStartDate?: string;
  coApplicant?: {
    firstName: string;
    lastName: string;
    dateOfBirth?: string;
    gender?: string;
    maritalStatus?: string;
    email?: string;
    phone?: string;
    relationship?: string;
    [key: string]: any;
  };
}

export interface UpdateApplicantData {
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
  gender?: string;
  maritalStatus?: string;
  email?: string;
  phone?: string;
  addressLine1?: string;
  addressCity?: string;
  addressState?: string;
  addressZip?: string;
  [key: string]: any;
}

// =============================================================================
// CLIENT CLASS
// =============================================================================

class EzlynxBotClient {
  private baseUrl: string;
  private username: string;
  private password: string;
  private apiKey: string;

  constructor() {
    this.baseUrl = (process.env.EZLYNX_BOT_URL || 'http://75.37.55.209:5000').replace(/\/$/, '');
    this.username = process.env.EZLYNX_BOT_USERNAME || 'admin';
    this.password = process.env.EZLYNX_BOT_PASSWORD || '';
    this.apiKey = process.env.EZLYNX_BOT_API_KEY || '';
  }

  private get authHeader(): string {
    return 'Basic ' + Buffer.from(`${this.username}:${this.password}`).toString('base64');
  }

  private async request<T = any>(
    path: string,
    options: { method?: string; body?: any; timeout?: number } = {}
  ): Promise<T> {
    const { method = 'GET', body, timeout = 30000 } = options;
    const url = `${this.baseUrl}${path}`;

    const headers: Record<string, string> = {
      'Authorization': this.authHeader,
      'Accept': 'application/json',
    };
    if (this.apiKey) {
      headers['x-api-key'] = this.apiKey;
    }
    if (body) {
      headers['Content-Type'] = 'application/json';
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
      const res = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      const text = await res.text();
      let data: any;
      try {
        data = JSON.parse(text);
      } catch {
        data = { raw: text };
      }

      if (!res.ok) {
        throw new Error(data?.error || data?.message || `HTTP ${res.status}: ${text.slice(0, 200)}`);
      }

      return data as T;
    } catch (err: any) {
      if (err.name === 'AbortError') {
        throw new Error(`Request to ${path} timed out after ${timeout}ms`);
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  // ---------------------------------------------------------------------------
  // BOT STATUS
  // ---------------------------------------------------------------------------

  async getStatus(): Promise<BotStatus> {
    return this.request<BotStatus>('/api/bot/status');
  }

  async getHealth(): Promise<any> {
    return this.request('/health');
  }

  // ---------------------------------------------------------------------------
  // SEARCH
  // ---------------------------------------------------------------------------

  async searchApplicant(params: {
    firstName?: string;
    lastName?: string;
    dateOfBirth?: string;
    state?: string;
  }): Promise<{ success: boolean; results: SearchResult[] }> {
    const qs = new URLSearchParams();
    if (params.firstName) qs.set('firstName', params.firstName);
    if (params.lastName) qs.set('lastName', params.lastName);
    if (params.dateOfBirth) qs.set('dateOfBirth', params.dateOfBirth);
    if (params.state) qs.set('state', params.state);
    return this.request(`/api/applicant/search-ezlynx?${qs.toString()}`);
  }

  // ---------------------------------------------------------------------------
  // APPLICANT CRUD
  // ---------------------------------------------------------------------------

  async getApplicantDetails(accountId: string): Promise<ApplicantDetails> {
    return this.request(`/api/applicant/${accountId}/details-ezlynx`);
  }

  async createApplicant(data: CreateApplicantData): Promise<CreateApplicantResult> {
    return this.request('/api/applicant/create-smart', {
      method: 'POST',
      body: data,
      timeout: 60000, // creation can take a while (Playwright fallback)
    });
  }

  async updateApplicant(accountId: string, updates: UpdateApplicantData): Promise<UpdateApplicantResult> {
    return this.request(`/api/applicant/${accountId}`, {
      method: 'PUT',
      body: updates,
    });
  }

  async deleteApplicant(accountId: string): Promise<DeleteApplicantResult> {
    return this.request(`/api/applicant/${accountId}`, {
      method: 'DELETE',
    });
  }

  // ---------------------------------------------------------------------------
  // QUOTES
  // ---------------------------------------------------------------------------

  async submitHomeQuote(accountId: string, quoteData: any): Promise<QuoteResult> {
    return this.request('/api/quote/home', {
      method: 'POST',
      body: { accountId, ...quoteData },
      timeout: 120000, // quotes can take a while
    });
  }

  async submitAutoQuote(accountId: string, quoteData: any): Promise<QuoteResult> {
    return this.request('/api/quote/auto', {
      method: 'POST',
      body: { accountId, ...quoteData },
      timeout: 120000,
    });
  }

  async getQuoteJobs(accountId: string): Promise<QuoteJob[]> {
    return this.request(`/api/quote/jobs/${accountId}`);
  }

  // ---------------------------------------------------------------------------
  // ACTIVITY LOGS
  // ---------------------------------------------------------------------------

  async getLogs(limit: number = 50): Promise<ActivityLog[]> {
    return this.request(`/api/logs?limit=${limit}`);
  }
}

// Singleton instance
export const ezlynxBot = new EzlynxBotClient();
