/**
 * Renewal Review UI Types
 */

import type {
  MaterialChange,
  ComparisonSummary,
  RenewalSnapshot,
  BaselineSnapshot,
} from '@/types/renewal.types';

export interface RenewalComparison {
  id: string;
  tenantId: string;
  customerId: string | null;
  policyId: string | null;
  policyNumber: string | null;
  carrierName: string | null;
  lineOfBusiness: string | null;
  renewalEffectiveDate: string;
  renewalExpirationDate: string | null;
  currentPremium: number | null;
  renewalPremium: number | null;
  premiumChangeAmount: number | null;
  premiumChangePercent: number | null;
  recommendation: 'renew_as_is' | 'reshop' | 'needs_review' | null;
  status: string;
  verificationStatus: string | null;
  agentDecision: string | null;
  agentDecisionAt: string | null;
  agentDecisionBy: string | null;
  agentNotes: string | null;
  agencyzoomSrId: number | null;
  materialChanges: MaterialChange[];
  comparisonSummary: ComparisonSummary | null;
  createdAt: string;
  updatedAt: string;

  // Joined data
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  agentDecisionByName?: string;
}

export interface RenewalComparisonDetail extends RenewalComparison {
  renewalSnapshot: RenewalSnapshot | null;
  baselineSnapshot: BaselineSnapshot | null;
  auditHistory: RenewalAuditEntry[];
}

export interface RenewalAuditEntry {
  id: string;
  eventType: string;
  eventData: Record<string, unknown> | null;
  performedBy: string | null;
  performedAt: string;
}

export interface RenewalNote {
  id: string;
  type: 'system' | 'agent' | 'az';
  content: string;
  author: string | null;
  createdAt: string;
}

export interface RenewalsListResponse {
  success: boolean;
  renewals: RenewalComparison[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  stats: RenewalStats;
}

export interface RenewalStats {
  pendingCount: number;
  inReviewCount: number;
  decidedCount: number;
  completedCount: number;
  reshopCount: number;
  totalActive: number;
  avgPremiumChangePercent: number | null;
}

export interface ComparisonSection {
  title: string;
  rows: ComparisonRow[];
}

export interface ComparisonRow {
  label: string;
  currentValue: string | number | null;
  renewalValue: string | number | null;
  change?: 'better' | 'worse' | 'same' | 'different';
  isMaterial?: boolean;
  materialChange?: MaterialChange;
}
