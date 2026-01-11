/**
 * Adapt Insurance API Client
 * ==========================
 * Polls Adapt Insurance API for policy notices (billing, policy, claims).
 *
 * API Base URL: https://api.adaptinsurance.com
 * Auth: Bearer token
 *
 * This client fetches notices from Adapt and transforms them into our
 * internal policy notice format for agent review.
 */

// =============================================================================
// TYPES - Real Adapt API Response Types
// =============================================================================

export interface AdaptConfig {
  apiKey: string;
  baseUrl?: string;
}

// Contact info nested in policy
interface AdaptContact {
  firstName?: string;
  lastName?: string;
  cellPhone?: string;
  primaryEmail?: string;
  homePhone?: string;
  workPhone?: string;
}

// Policy object nested in notices
interface AdaptPolicy {
  policyNumber: string;
  carrier: string;
  lineOfBusiness: string;
  contact?: AdaptContact;
}

// Document reference
interface AdaptDocument {
  url: string;
  fileName: string;
}

// AMS fields for matching
interface AdaptAmsFields {
  clientId?: string;
  policyId?: string;
}

// Billing Notice from Adapt API
export interface AdaptBillingNotice {
  id: string;
  noticeDate: string | null; // "2026-01-07" - can be null
  createdAt?: string;
  noticeType: 'PENDING_CANCELLATION' | 'LAPSE_NOTICE' | 'PAYMENT_REMINDER' | 'REINSTATEMENT' | 'CANCEL_RESCIND';
  namedInsured: string;
  dueDate?: string;
  amountDue?: string | null; // "$195.92"
  totalOwed?: string | null;
  noticeReason?: string | null; // "NON_PAYMENT"
  policy: AdaptPolicy;
  insuredCopyDocument?: AdaptDocument | null;
  managementSystemFields?: AdaptAmsFields;
}

// Policy Notice from Adapt API
export interface AdaptPolicyNotice {
  id: string;
  noticeDate: string;
  noticeType: 'RENEWAL' | 'ENDORSEMENT' | 'NEW_POLICY' | 'CANCELLATION_POLICY' | 'NON_RENEWAL';
  namedInsured: string;
  transactionEffectiveDate?: string;
  transactionPremium?: string;
  totalPremium?: string;
  policy: AdaptPolicy;
  insuredCopyDocument?: AdaptDocument;
  managementSystemFields?: AdaptAmsFields;
}

// Claim Notice from Adapt API
export interface AdaptClaimNotice {
  id: string;
  noticeDate: string;
  createdAt?: string;
  noticeType:
    | 'CLAIM_OPEN'
    | 'CLAIM_CLOSE_ACTIVE'
    | 'CLAIM_CLOSE_INACTIVE'
    | 'CLAIM_CLOSED'
    | 'PAYMENT_MADE'
    | 'FEATURE_OPEN'
    | 'FEATURE_CLOSE_PAID'
    | 'FEATURE_CLOSE_UNPAID'
    | 'FEATURE_UPDATE';
  namedInsured: string;
  status: 'OPEN' | 'CLOSED';
  lossDate?: string;
  closeDate?: string;
  totalNetPaid?: string;
  externalId?: string; // External claim ID
  policy: AdaptPolicy;
  insuredCopyDocument?: AdaptDocument | null;
  managementSystemFields?: AdaptAmsFields;
}

export interface AdaptNoticesResponse {
  billing: AdaptBillingNotice[];
  policy: AdaptPolicyNotice[];
  claims: AdaptClaimNotice[];
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
    this.baseUrl = config.baseUrl || 'https://api.adaptinsurance.com';
  }

  /**
   * Check if the client is configured with an API key
   */
  isConfigured(): boolean {
    return !!this.config.apiKey && this.config.apiKey.startsWith('sk_');
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
    limit: number = 100,
    offset: number = 0
  ): Promise<AdaptBillingNotice[]> {
    const params = new URLSearchParams({
      limit: limit.toString(),
      offset: offset.toString(),
    });

    if (since) {
      params.append('since', since.toISOString().split('T')[0]);
    }

    const response = await this.request<{ data: AdaptBillingNotice[]; pagination?: unknown }>(
      `/v1/notices/billing?${params}`
    );

    return response?.data || [];
  }

  /**
   * Fetch policy notices from Adapt API
   */
  async getPolicyNotices(
    since?: Date,
    limit: number = 100,
    offset: number = 0
  ): Promise<AdaptPolicyNotice[]> {
    const params = new URLSearchParams({
      limit: limit.toString(),
      offset: offset.toString(),
    });

    if (since) {
      params.append('since', since.toISOString().split('T')[0]);
    }

    const response = await this.request<{ data: AdaptPolicyNotice[]; pagination?: unknown }>(
      `/v1/notices/policy?${params}`
    );

    return response?.data || [];
  }

  /**
   * Fetch claim notices from Adapt API
   */
  async getClaimNotices(
    since?: Date,
    limit: number = 100,
    offset: number = 0
  ): Promise<AdaptClaimNotice[]> {
    const params = new URLSearchParams({
      limit: limit.toString(),
      offset: offset.toString(),
    });

    if (since) {
      params.append('since', since.toISOString().split('T')[0]);
    }

    const response = await this.request<{ data: AdaptClaimNotice[]; pagination?: unknown }>(
      `/v1/notices/claim?${params}`
    );

    return response?.data || [];
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
    billingNoticeType?: string
  ): UrgencyLevel {
    // Claims - new claims are urgent
    if (noticeType === 'claim') {
      if (claimStatus === 'OPEN') return 'urgent';
      return 'high';
    }

    // Billing notices - cancellation/lapse are urgent
    if (noticeType === 'billing') {
      if (billingNoticeType === 'PENDING_CANCELLATION' || billingNoticeType === 'LAPSE_NOTICE') {
        return 'urgent';
      }

      if (dueDate) {
        const now = new Date();
        const due = new Date(dueDate);
        const daysUntilDue = Math.floor(
          (due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        );

        if (daysUntilDue < 0) return 'urgent';
        if (daysUntilDue <= 3) return 'high';
        if (daysUntilDue <= 7) return 'medium';
      }
      return 'medium';
    }

    // Policy notices - renewals and cancellations are higher priority
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
      notice.noticeType
    );

    let title = 'Billing Notice';
    switch (notice.noticeType) {
      case 'PENDING_CANCELLATION':
        title = 'Pending Cancellation - Non-Payment';
        break;
      case 'LAPSE_NOTICE':
        title = 'Policy Lapse Notice';
        break;
      case 'PAYMENT_REMINDER':
        title = 'Payment Reminder';
        break;
      case 'REINSTATEMENT':
        title = 'Policy Reinstatement';
        break;
      case 'CANCEL_RESCIND':
        title = 'Cancellation Rescinded';
        break;
    }

    const description = notice.noticeReason
      ? `Reason: ${notice.noticeReason.replace(/_/g, ' ')}`
      : undefined;

    // Use noticeDate if available, otherwise createdAt, otherwise now
    const dateStr = notice.noticeDate || notice.createdAt || new Date().toISOString();

    return {
      adaptNoticeId: notice.id,
      noticeType: 'billing',
      urgency,
      policyNumber: notice.policy.policyNumber,
      insuredName: notice.namedInsured,
      carrier: notice.policy.carrier,
      lineOfBusiness: notice.policy.lineOfBusiness,
      title,
      description,
      amountDue: notice.amountDue || notice.totalOwed || undefined,
      dueDate: notice.dueDate,
      noticeDate: new Date(dateStr),
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
      case 'RENEWAL':
        title = 'Policy Renewal';
        break;
      case 'ENDORSEMENT':
        title = 'Policy Endorsement';
        break;
      case 'NEW_POLICY':
        title = 'New Policy Issued';
        break;
      case 'CANCELLATION_POLICY':
        title = 'Policy Cancellation';
        break;
      case 'NON_RENEWAL':
        title = 'Policy Non-Renewal';
        break;
    }

    const description = notice.transactionPremium
      ? `Premium: ${notice.transactionPremium}${notice.totalPremium ? ` (Total: ${notice.totalPremium})` : ''}`
      : undefined;

    return {
      adaptNoticeId: notice.id,
      noticeType: 'policy',
      urgency,
      policyNumber: notice.policy.policyNumber,
      insuredName: notice.namedInsured,
      carrier: notice.policy.carrier,
      lineOfBusiness: notice.policy.lineOfBusiness,
      title,
      description,
      dueDate: notice.transactionEffectiveDate,
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
      notice.status
    );

    let title = 'Claim Notice';
    switch (notice.noticeType) {
      case 'CLAIM_OPEN':
        title = 'New Claim Opened';
        break;
      case 'FEATURE_OPEN':
        title = 'Claim Feature Opened';
        break;
      case 'PAYMENT_MADE':
        title = 'Claim Payment Made';
        break;
      case 'CLAIM_CLOSE_ACTIVE':
        title = 'Claim Closed (Active)';
        break;
      case 'CLAIM_CLOSE_INACTIVE':
      case 'CLAIM_CLOSED':
        title = 'Claim Closed';
        break;
      case 'FEATURE_CLOSE_PAID':
        title = 'Claim Feature Closed (Paid)';
        break;
      case 'FEATURE_CLOSE_UNPAID':
        title = 'Claim Feature Closed (Unpaid)';
        break;
      case 'FEATURE_UPDATE':
        title = 'Claim Status Update';
        break;
    }

    const description = notice.totalNetPaid
      ? `Total Paid: ${notice.totalNetPaid}`
      : undefined;

    // Use noticeDate if available, otherwise createdAt, otherwise now
    const dateStr = notice.noticeDate || notice.createdAt || new Date().toISOString();

    return {
      adaptNoticeId: notice.id,
      noticeType: 'claim',
      urgency,
      policyNumber: notice.policy.policyNumber,
      insuredName: notice.namedInsured,
      carrier: notice.policy.carrier,
      lineOfBusiness: notice.policy.lineOfBusiness,
      title,
      description,
      claimNumber: notice.externalId,
      claimDate: notice.lossDate,
      claimStatus: notice.status,
      noticeDate: new Date(dateStr),
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
        id: 'bnot_test_001',
        noticeDate: today.toISOString().split('T')[0],
        noticeType: 'PENDING_CANCELLATION',
        namedInsured: 'Test Customer',
        dueDate: tomorrow.toISOString().split('T')[0],
        amountDue: '$150.00',
        noticeReason: 'NON_PAYMENT',
        policy: {
          policyNumber: 'TEST-001',
          carrier: 'TEST_CARRIER',
          lineOfBusiness: 'AUTO',
        },
      },
    ],
    policy: [
      {
        id: 'pnot_test_001',
        noticeDate: today.toISOString().split('T')[0],
        noticeType: 'RENEWAL',
        namedInsured: 'Test Customer',
        transactionEffectiveDate: nextWeek.toISOString().split('T')[0],
        transactionPremium: '$500.00',
        totalPremium: '$500.00',
        policy: {
          policyNumber: 'TEST-002',
          carrier: 'TEST_CARRIER',
          lineOfBusiness: 'HOME',
        },
      },
    ],
    claims: [
      {
        id: 'cnot_test_001',
        noticeDate: today.toISOString().split('T')[0],
        noticeType: 'CLAIM_OPEN',
        namedInsured: 'Test Customer',
        status: 'OPEN',
        lossDate: threeDaysAgo.toISOString().split('T')[0],
        externalId: 'CLM-TEST-001',
        policy: {
          policyNumber: 'TEST-003',
          carrier: 'TEST_CARRIER',
          lineOfBusiness: 'AUTO',
        },
      },
    ],
  };
}
