/**
 * Adapt Insurance API Client
 * ==========================
 * Polls Adapt Insurance API for policy notices (billing, policy, claims).
 *
 * API Docs: https://www.adapt-ai.net/developer/docs
 *
 * This client fetches notices from Adapt and transforms them into our
 * internal policy notice format for agent review.
 */

// =============================================================================
// TYPES
// =============================================================================

export interface AdaptConfig {
  apiKey: string;
  baseUrl?: string;
}

// Adapt API Response Types
export interface AdaptBillingNotice {
  id: string;
  policyNumber: string;
  insuredName: string;
  carrier: string;
  lineOfBusiness: string;
  amountDue: number;
  dueDate: string; // ISO date
  gracePeriodEnd?: string;
  status: 'due' | 'past_due' | 'grace_period' | 'cancellation_pending';
  noticeType: 'payment_due' | 'past_due' | 'final_notice' | 'cancellation_notice';
  noticeDate: string;
  description?: string;
}

export interface AdaptPolicyNotice {
  id: string;
  policyNumber: string;
  insuredName: string;
  carrier: string;
  lineOfBusiness: string;
  noticeType: 'renewal' | 'endorsement' | 'cancellation' | 'reinstatement' | 'non_renewal';
  effectiveDate: string;
  expirationDate?: string;
  description?: string;
  changes?: Array<{
    field: string;
    oldValue: string;
    newValue: string;
  }>;
  noticeDate: string;
}

export interface AdaptClaimNotice {
  id: string;
  policyNumber: string;
  insuredName: string;
  carrier: string;
  lineOfBusiness: string;
  claimNumber: string;
  claimDate: string;
  claimStatus: 'new' | 'in_progress' | 'under_review' | 'settled' | 'denied' | 'closed';
  noticeType: 'new_claim' | 'status_update' | 'payment' | 'settlement' | 'denial';
  amount?: number;
  description?: string;
  noticeDate: string;
}

export interface AdaptNoticesResponse {
  billing: AdaptBillingNotice[];
  policy: AdaptPolicyNotice[];
  claims: AdaptClaimNotice[];
  pagination?: {
    page: number;
    pageSize: number;
    totalRecords: number;
    hasMore: boolean;
  };
}

// Normalized notice type for our system
export type NoticeType = 'billing' | 'policy' | 'claim';
export type UrgencyLevel = 'low' | 'medium' | 'high' | 'urgent';

export interface NormalizedNotice {
  adaptNoticeId: string;
  noticeType: NoticeType;
  urgency: UrgencyLevel;
  policyNumber: string;
  insuredName: string;
  carrier: string;
  lineOfBusiness: string;
  title: string;
  description?: string;
  amountDue?: string;
  dueDate?: string;
  gracePeriodEnd?: string;
  claimNumber?: string;
  claimDate?: string;
  claimStatus?: string;
  noticeDate: Date;
  rawPayload: Record<string, unknown>;
}

// =============================================================================
// CLIENT
// =============================================================================

export class AdaptInsuranceClient {
  private config: AdaptConfig;
  private baseUrl: string;

  constructor(config: AdaptConfig) {
    this.config = config;
    this.baseUrl = config.baseUrl || 'https://api.adapt-ai.net/v1';
  }

  /**
   * Check if the client is configured with an API key
   */
  isConfigured(): boolean {
    return !!this.config.apiKey;
  }

  /**
   * Make authenticated request to Adapt API
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Adapt API error: ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    return response.json();
  }

  /**
   * Fetch billing notices from Adapt API
   */
  async getBillingNotices(
    since?: Date,
    page: number = 1,
    pageSize: number = 100
  ): Promise<AdaptBillingNotice[]> {
    const params = new URLSearchParams({
      page: page.toString(),
      pageSize: pageSize.toString(),
    });

    if (since) {
      params.append('since', since.toISOString());
    }

    const response = await this.request<{ data: AdaptBillingNotice[] }>(
      `/notices/billing?${params}`
    );

    return response.data || [];
  }

  /**
   * Fetch policy notices from Adapt API
   */
  async getPolicyNotices(
    since?: Date,
    page: number = 1,
    pageSize: number = 100
  ): Promise<AdaptPolicyNotice[]> {
    const params = new URLSearchParams({
      page: page.toString(),
      pageSize: pageSize.toString(),
    });

    if (since) {
      params.append('since', since.toISOString());
    }

    const response = await this.request<{ data: AdaptPolicyNotice[] }>(
      `/notices/policy?${params}`
    );

    return response.data || [];
  }

  /**
   * Fetch claim notices from Adapt API
   */
  async getClaimNotices(
    since?: Date,
    page: number = 1,
    pageSize: number = 100
  ): Promise<AdaptClaimNotice[]> {
    const params = new URLSearchParams({
      page: page.toString(),
      pageSize: pageSize.toString(),
    });

    if (since) {
      params.append('since', since.toISOString());
    }

    const response = await this.request<{ data: AdaptClaimNotice[] }>(
      `/notices/claims?${params}`
    );

    return response.data || [];
  }

  /**
   * Fetch all notices from Adapt API
   */
  async getAllNotices(since?: Date): Promise<AdaptNoticesResponse> {
    const [billing, policy, claims] = await Promise.all([
      this.getBillingNotices(since),
      this.getPolicyNotices(since),
      this.getClaimNotices(since),
    ]);

    return { billing, policy, claims };
  }

  /**
   * Calculate urgency level based on notice type and due dates
   */
  static calculateUrgency(
    noticeType: NoticeType,
    dueDate?: string,
    claimStatus?: string,
    billingStatus?: string
  ): UrgencyLevel {
    // Claims are always at least high priority
    if (noticeType === 'claim') {
      if (claimStatus === 'new') return 'urgent';
      return 'high';
    }

    // Billing notices - urgency based on due date
    if (noticeType === 'billing' && dueDate) {
      const now = new Date();
      const due = new Date(dueDate);
      const daysUntilDue = Math.floor(
        (due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (daysUntilDue < 0 || billingStatus === 'past_due' || billingStatus === 'cancellation_pending') {
        return 'urgent';
      }
      if (daysUntilDue <= 3) return 'high';
      if (daysUntilDue <= 7) return 'medium';
      return 'low';
    }

    // Policy notices - medium by default
    return 'medium';
  }

  /**
   * Normalize a billing notice to our internal format
   */
  normalizeBillingNotice(notice: AdaptBillingNotice): NormalizedNotice {
    const urgency = AdaptInsuranceClient.calculateUrgency(
      'billing',
      notice.dueDate,
      undefined,
      notice.status
    );

    let title = 'Billing Notice';
    switch (notice.noticeType) {
      case 'payment_due':
        title = 'Payment Due';
        break;
      case 'past_due':
        title = 'Payment Past Due';
        break;
      case 'final_notice':
        title = 'Final Notice - Payment Required';
        break;
      case 'cancellation_notice':
        title = 'Cancellation for Non-Payment';
        break;
    }

    return {
      adaptNoticeId: notice.id,
      noticeType: 'billing',
      urgency,
      policyNumber: notice.policyNumber,
      insuredName: notice.insuredName,
      carrier: notice.carrier,
      lineOfBusiness: notice.lineOfBusiness,
      title,
      description: notice.description,
      amountDue: notice.amountDue?.toString(),
      dueDate: notice.dueDate,
      gracePeriodEnd: notice.gracePeriodEnd,
      noticeDate: new Date(notice.noticeDate),
      rawPayload: notice as unknown as Record<string, unknown>,
    };
  }

  /**
   * Normalize a policy notice to our internal format
   */
  normalizePolicyNotice(notice: AdaptPolicyNotice): NormalizedNotice {
    const urgency = AdaptInsuranceClient.calculateUrgency('policy');

    let title = 'Policy Notice';
    switch (notice.noticeType) {
      case 'renewal':
        title = 'Policy Renewal';
        break;
      case 'endorsement':
        title = 'Policy Endorsement';
        break;
      case 'cancellation':
        title = 'Policy Cancellation';
        break;
      case 'reinstatement':
        title = 'Policy Reinstatement';
        break;
      case 'non_renewal':
        title = 'Policy Non-Renewal';
        break;
    }

    return {
      adaptNoticeId: notice.id,
      noticeType: 'policy',
      urgency,
      policyNumber: notice.policyNumber,
      insuredName: notice.insuredName,
      carrier: notice.carrier,
      lineOfBusiness: notice.lineOfBusiness,
      title,
      description: notice.description,
      noticeDate: new Date(notice.noticeDate),
      rawPayload: notice as unknown as Record<string, unknown>,
    };
  }

  /**
   * Normalize a claim notice to our internal format
   */
  normalizeClaimNotice(notice: AdaptClaimNotice): NormalizedNotice {
    const urgency = AdaptInsuranceClient.calculateUrgency(
      'claim',
      undefined,
      notice.claimStatus
    );

    let title = 'Claim Notice';
    switch (notice.noticeType) {
      case 'new_claim':
        title = 'New Claim Filed';
        break;
      case 'status_update':
        title = 'Claim Status Update';
        break;
      case 'payment':
        title = 'Claim Payment';
        break;
      case 'settlement':
        title = 'Claim Settlement';
        break;
      case 'denial':
        title = 'Claim Denied';
        break;
    }

    return {
      adaptNoticeId: notice.id,
      noticeType: 'claim',
      urgency,
      policyNumber: notice.policyNumber,
      insuredName: notice.insuredName,
      carrier: notice.carrier,
      lineOfBusiness: notice.lineOfBusiness,
      title,
      description: notice.description,
      claimNumber: notice.claimNumber,
      claimDate: notice.claimDate,
      claimStatus: notice.claimStatus,
      noticeDate: new Date(notice.noticeDate),
      rawPayload: notice as unknown as Record<string, unknown>,
    };
  }

  /**
   * Normalize all notices to our internal format
   */
  normalizeAllNotices(response: AdaptNoticesResponse): NormalizedNotice[] {
    const normalized: NormalizedNotice[] = [];

    for (const notice of response.billing) {
      normalized.push(this.normalizeBillingNotice(notice));
    }

    for (const notice of response.policy) {
      normalized.push(this.normalizePolicyNotice(notice));
    }

    for (const notice of response.claims) {
      normalized.push(this.normalizeClaimNotice(notice));
    }

    // Sort by urgency (urgent first) then by notice date (newest first)
    const urgencyOrder: Record<UrgencyLevel, number> = {
      urgent: 0,
      high: 1,
      medium: 2,
      low: 3,
    };

    normalized.sort((a, b) => {
      const urgencyDiff = urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
      if (urgencyDiff !== 0) return urgencyDiff;
      return b.noticeDate.getTime() - a.noticeDate.getTime();
    });

    return normalized;
  }
}

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

let adaptClientInstance: AdaptInsuranceClient | null = null;

export function getAdaptInsuranceClient(): AdaptInsuranceClient {
  if (!adaptClientInstance) {
    const apiKey = process.env.ADAPT_INSURANCE_API_KEY || '';
    adaptClientInstance = new AdaptInsuranceClient({ apiKey });
  }
  return adaptClientInstance;
}

// =============================================================================
// MOCK DATA (for testing when API key is not configured)
// =============================================================================

export function getMockNotices(): AdaptNoticesResponse {
  const today = new Date();
  const threeDaysAgo = new Date(today.getTime() - 3 * 24 * 60 * 60 * 1000);
  const tomorrow = new Date(today.getTime() + 1 * 24 * 60 * 60 * 1000);
  const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

  return {
    billing: [
      {
        id: 'BILL-001',
        policyNumber: 'HO-123456',
        insuredName: 'John Smith',
        carrier: 'State Farm',
        lineOfBusiness: 'Homeowners',
        amountDue: 450.00,
        dueDate: tomorrow.toISOString().split('T')[0],
        status: 'due',
        noticeType: 'payment_due',
        noticeDate: today.toISOString(),
        description: 'Quarterly premium payment due',
      },
      {
        id: 'BILL-002',
        policyNumber: 'AUTO-789012',
        insuredName: 'Jane Doe',
        carrier: 'Allstate',
        lineOfBusiness: 'Personal Auto',
        amountDue: 285.00,
        dueDate: threeDaysAgo.toISOString().split('T')[0],
        status: 'past_due',
        noticeType: 'past_due',
        noticeDate: today.toISOString(),
        description: 'Payment is past due - please remit immediately',
      },
    ],
    policy: [
      {
        id: 'POL-001',
        policyNumber: 'HO-567890',
        insuredName: 'Bob Johnson',
        carrier: 'Liberty Mutual',
        lineOfBusiness: 'Homeowners',
        noticeType: 'renewal',
        effectiveDate: nextWeek.toISOString().split('T')[0],
        noticeDate: today.toISOString(),
        description: 'Policy renewal notice - new terms available',
      },
    ],
    claims: [
      {
        id: 'CLM-001',
        policyNumber: 'AUTO-345678',
        insuredName: 'Alice Williams',
        carrier: 'Progressive',
        lineOfBusiness: 'Personal Auto',
        claimNumber: 'CLM-2024-001234',
        claimDate: today.toISOString().split('T')[0],
        claimStatus: 'new',
        noticeType: 'new_claim',
        amount: 5200.00,
        noticeDate: today.toISOString(),
        description: 'New auto collision claim filed',
      },
    ],
  };
}
