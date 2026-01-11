/**
 * Donna AI (AgencyIQ/Crux) Type Definitions
 * ==========================================
 * Types for Donna AI customer insights integration.
 * Donna provides sentiment scores, churn predictions,
 * cross-sell probabilities, and AI recommendations.
 */

// ============================================================================
// API RESPONSE TYPES (Raw from Donna API)
// ============================================================================

/**
 * Raw customer data response from Donna API
 * GET /api/cov/v1/data/{customer_id}
 */
export interface DonnaAPICustomerResponse {
  tenant: string;
  contextIdentifier: string;
  customerId: string;
  error: boolean;
  data: {
    Household: {
      [customerId: string]: {
        customerDetails: DonnaAPICustomerDetails;
        policies?: DonnaAPIPolicyData[];
        predictions?: Record<string, unknown>;
        recommendations?: DonnaAPIRecommendation[];
      };
    };
  };
}

/**
 * Raw customer details from Donna API
 */
export interface DonnaAPICustomerDetails {
  // Core Sentiment
  'KPI SENTIMETER Value'?: string;
  'KPI SENTIMETER Date'?: string;
  'Summary Slab 10'?: string;
  'Summary Slab 20'?: string;

  // VIP Status
  DvCustomerPersonalVIP?: string; // 'Y' or 'N'
  DvCustomerCommercialVIP?: string; // 'Y' or 'N'

  // Demographics
  DvCustomerGender?: string;
  DvCustomerDOB?: string;
  DvCustomerAddress?: string;
  DvCustomerCity?: string;
  DvCustomerState?: string;
  DvCustomerZip?: string;
  DvCustomerEmail?: string;
  DvCustomerHomeEmail?: string;
  DvCustomerWorkEmail?: string;
  DvCustomerHomePhone?: string;
  DvOrganizationName?: string;
  DvOrganizationType?: string;

  // Financial Metrics
  DvCustomerAnnualPremium?: number;
  DvTotalPremiumDueOnNextRenewalDate?: number;
  DvPLExpectedSpend?: number;
  DvPLSpendAgencyShare?: number;
  DvViewedUpliftPremiumValue?: number;

  // AI Predictions (0-1 probabilities)
  GbProbabilityRoundout?: number;
  GbProbabilityRetention?: number;
  GbProbabilityRenewal?: number;
  GbScoreGroupRoundout?: string; // G1-G5
  GbScoreDateRetention?: string;
  GbScoreValidityDateRetention?: string;

  // Policy Info
  DvCustomerStatus?: string; // Active, Inactive, Prospect
  DvCustomerDistinctLobCount?: number;
  DvLobCodes?: string; // Comma-separated LOB codes
  DvCoverageCodes?: string;
  DvCustomerInactivePolicies?: number;
  DvCustomerIsMonoline?: string; // 'Y' or 'N'
  DvCustomerActivePolicies?: number;
  DvCustomerProspect?: string; // 'Y' or 'N'
  DvCustomerDeadfile?: string; // 'Y' or 'N'

  // Events
  csLastEvent?: string; // RENEWED, CANCELLED, etc.
  csLastChangeDirection?: string; // Increase, Decrease
  csMinimumValue?: number;
  csPositiveInf1?: string;
  csPositiveInf2?: string;
  csPositiveInf3?: string;
  csNegativeInf1?: string;
  csNegativeInf2?: string;

  // Claims
  DvClaims?: string; // JSON array
  DvClaimDetails?: string;

  // Producer/CSR
  DvProducer?: string;
  DvProducerName?: string;
  DvCsr?: string;
  DvCsrName?: string;

  // Lifestyle
  DvCustomerOwnsHorse?: string;
  DvCustomerOwnsATV?: string;
  DvCustomerCollectiblesPlates?: string;
}

export interface DonnaAPIPolicyData {
  policyNumber: string;
  lineOfBusiness: string;
  premium: number;
  effectiveDate: string;
  expirationDate: string;
  status: string;
}

export interface DonnaAPIRecommendation {
  id?: string;
  type: string;
  priority?: string;
  recommendation: string;
  estimatedPremium?: number;
  confidence?: number;
}

/**
 * Raw activities response from Donna API
 * GET /api/ai/v1/getActivities/{customer_id}
 */
export interface DonnaAPIActivitiesResponse {
  customerId: string;
  activities: DonnaAPIActivity[];
}

export interface DonnaAPIActivity {
  type: string;
  priority?: string;
  recommendation?: string;
  estimatedPremium?: number;
  confidence?: number;
}

// ============================================================================
// STORED DATA TYPES (In customers.donnaData JSONB)
// ============================================================================

/**
 * Donna data stored in customers.donnaData JSONB column
 * Includes ALL enrichment data from DONNA API
 */
export interface DonnaCustomerData {
  // Core Sentiment & VIP Status
  sentimentScore: number; // 0-100
  sentimentDate?: string;
  summarySlab10?: string;
  summarySlab20?: string;
  isPersonalVIP: boolean;
  isCommercialVIP: boolean;

  // Predictions (0-1 probabilities)
  retentionProbability: number;
  crossSellProbability: number;
  renewalProbability?: number;
  roundoutScoreGroup?: string; // G1-G5
  retentionScoreDate?: string;
  retentionScoreValidityDate?: string;

  // Financial
  estimatedWalletSize: number;
  currentAnnualPremium: number;
  potentialGap: number; // wallet - current
  totalPremiumDueOnRenewal?: number;
  agencyShareSpend?: number;
  upliftPremiumValue?: number;

  // Demographics / Enrichments
  demographics?: {
    gender?: string;
    dateOfBirth?: string;
    address?: string;
    city?: string;
    state?: string;
    zip?: string;
    homeEmail?: string;
    workEmail?: string;
    homePhone?: string;
    organizationName?: string;
    organizationType?: string;
  };

  // Policy Summary
  policyInfo?: {
    status?: string; // Active, Inactive, Prospect
    distinctLobCount?: number;
    lobCodes?: string[];
    coverageCodes?: string[];
    activePolicies?: number;
    inactivePolicies?: number;
    isMonoline?: boolean;
    isProspect?: boolean;
    isDeadfile?: boolean;
  };

  // Events & Influencers
  events?: {
    lastEvent?: string; // RENEWED, CANCELLED, etc.
    lastChangeDirection?: string; // Increase, Decrease
    minimumValue?: number;
    positiveInfluencers?: string[];
    negativeInfluencers?: string[];
  };

  // Claims
  claims?: {
    claimsData?: string;
    claimDetails?: string;
  };

  // Producer/CSR Assignment
  assignment?: {
    producerId?: string;
    producerName?: string;
    csrId?: string;
    csrName?: string;
  };

  // Lifestyle Enrichments
  lifestyle?: {
    ownsHorse?: boolean;
    ownsATV?: boolean;
    collectiblesPlates?: boolean;
  };

  // Recommendations
  recommendations: DonnaRecommendation[];

  // Activities
  activities: DonnaActivity[];

  // Metadata
  lastSyncedAt: string;
  donnaCustomerId: string;
}

export interface DonnaRecommendation {
  id: string;
  type: string;
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  suggestedAction?: string;
  estimatedPremium?: number;
  confidence?: number;
}

export interface DonnaActivity {
  id: string;
  type: string;
  createdAt: string;
  summary: string;
  priority?: string;
}

// ============================================================================
// SESSION & CONFIG TYPES
// ============================================================================

export interface DonnaConfig {
  username: string;
  password: string;
  baseUrl?: string;
  authUrl?: string;
}

export interface DonnaSession {
  cookies: string[];
  expiresAt: Date;
}

// ============================================================================
// SYNC TYPES
// ============================================================================

export interface DonnaSyncResult {
  source: 'donna';
  synced: number;
  skipped: number;
  notFound: number;
  errors: number;
  total: number;
  duration: number;
  timestamp: Date;
  details?: DonnaSyncDetail[];
}

export interface DonnaSyncDetail {
  customerId: string;
  donnaId: string;
  action: 'synced' | 'skipped' | 'not_found' | 'error';
  message?: string;
}

export interface DonnaSyncOptions {
  tenantId: string;
  batchSize?: number; // Default: 25
  maxRecords?: number;
  includeDetails?: boolean;
  dryRun?: boolean;
  fullSync?: boolean;
  staleThresholdHours?: number; // Default: 24
}

// ============================================================================
// UI DISPLAY HELPERS
// ============================================================================

export interface DonnaSentimentDisplay {
  score: number;
  label: 'Excellent' | 'Good' | 'Neutral' | 'At Risk' | 'Critical';
  color: 'green' | 'lime' | 'yellow' | 'orange' | 'red';
  emoji: string;
}

/**
 * Get display properties for sentiment score
 */
export function getSentimentDisplay(score: number): DonnaSentimentDisplay {
  if (score >= 80)
    return { score, label: 'Excellent', color: 'green', emoji: '😊' };
  if (score >= 60) return { score, label: 'Good', color: 'lime', emoji: '🙂' };
  if (score >= 40)
    return { score, label: 'Neutral', color: 'yellow', emoji: '😐' };
  if (score >= 20)
    return { score, label: 'At Risk', color: 'orange', emoji: '😟' };
  return { score, label: 'Critical', color: 'red', emoji: '😰' };
}

export interface DonnaChurnRiskDisplay {
  level: 'low' | 'medium' | 'high' | 'critical';
  label: string;
  color: string;
}

/**
 * Get display properties for churn risk (inverse of retention probability)
 */
export function getChurnRiskLevel(
  retentionProbability: number
): DonnaChurnRiskDisplay {
  const churnRisk = 1 - retentionProbability;
  if (churnRisk < 0.2)
    return { level: 'low', label: 'Low Risk', color: 'green' };
  if (churnRisk < 0.4)
    return { level: 'medium', label: 'Medium Risk', color: 'yellow' };
  if (churnRisk < 0.6)
    return { level: 'high', label: 'High Risk', color: 'orange' };
  return { level: 'critical', label: 'Critical Risk', color: 'red' };
}

/**
 * Get Donna customer ID from HawkSoft client code
 * Format: TCDS-{hawksoftClientNumber}
 */
export function getDonnaCustomerId(
  hawksoftClientCode: string | null
): string | null {
  if (!hawksoftClientCode) return null;
  return `TCDS-${hawksoftClientCode}`;
}

/**
 * Parse HawkSoft client number from Donna customer ID
 */
export function parseHawksoftClientNumber(
  donnaCustomerId: string
): string | null {
  if (!donnaCustomerId || !donnaCustomerId.startsWith('TCDS-')) return null;
  return donnaCustomerId.replace('TCDS-', '');
}
