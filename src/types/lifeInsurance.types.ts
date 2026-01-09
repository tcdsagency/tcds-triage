// Life Insurance Types for Back9 Insurance Integration
// Complete TypeScript definitions for life insurance quotes and AI cross-sell

// =============================================================================
// ENUMS
// =============================================================================

export enum PolicyType {
  TERM = 'term',
  WHOLE_LIFE = 'whole_life',
  UNIVERSAL_LIFE = 'universal_life',
  FINAL_EXPENSE = 'final_expense',
  GUARANTEED_UNIVERSAL = 'guaranteed_universal',
}

export enum HealthClass {
  EXCELLENT = 'excellent',
  GOOD = 'good',
  FAIR = 'fair',
  POOR = 'poor',
}

export enum TobaccoUse {
  NEVER = 'never',
  CURRENT = 'current',
  PREVIOUS = 'previous',
}

export enum Gender {
  MALE = 'male',
  FEMALE = 'female',
}

export enum OpportunityConfidence {
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
}

export enum LifeQuoteStatus {
  QUOTED = 'quoted',
  EMAILED = 'emailed',
  APPLICATION_STARTED = 'application_started',
  APPLICATION_SUBMITTED = 'application_submitted',
  POLICY_ISSUED = 'policy_issued',
  DECLINED = 'declined',
  EXPIRED = 'expired',
}

// =============================================================================
// CORE QUOTE TYPES
// =============================================================================

export interface QuoteRequestParams {
  // Personal Info
  firstName: string;
  lastName: string;
  dateOfBirth: string; // ISO date string
  gender: Gender;
  state: string; // Two-letter state code

  // Health Info
  healthClass: HealthClass;
  tobaccoUse: TobaccoUse;

  // Coverage Details
  coverageAmount: number;
  termLength: number; // Years (10, 15, 20, 25, 30)
  policyType: PolicyType;
}

export interface CarrierInfo {
  id: string;
  name: string;
  logoUrl?: string;
  amBestRating: string;
  amBestRatingNumeric: number; // 1-5 scale for sorting
}

export interface QuoteDetails {
  id: string;
  carrier: CarrierInfo;
  productName: string;
  monthlyPremium: number;
  annualPremium: number;
  deathBenefit: number;
  termLength: number;
  policyType: PolicyType;
  features: string[];
  illustrationUrl?: string;
  applicationUrl?: string;
}

export interface QuoteResponse {
  success: boolean;
  quotes: QuoteDetails[];
  requestParams: QuoteRequestParams;
  timestamp: string;
  error?: string;
}

// =============================================================================
// QUOTE HISTORY
// =============================================================================

export interface QuoteHistoryItem {
  id: string;
  customerId: string;
  agentId: string;
  requestParams: QuoteRequestParams;
  bestQuote: QuoteDetails;
  allQuotes: QuoteDetails[];
  status: LifeQuoteStatus;
  emailedToCustomer: boolean;
  applicationStarted: boolean;
  createdAt: string;
  updatedAt: string;
}

// =============================================================================
// AI CROSS-SELL TYPES
// =============================================================================

export interface IndicatorTrigger {
  type: 'life_event' | 'demographic' | 'financial' | 'behavioral' | 'policy_gap';
  label: string;
  value: string;
  source?: string; // e.g., "Call transcript from 2024-01-15"
  confidence?: number;
}

export interface AICrossSellOpportunity {
  customerId: string;
  confidence: OpportunityConfidence;
  confidenceScore: number; // 0-100
  summary: string;
  indicators: IndicatorTrigger[];
  recommendedCoverage: {
    min: number;
    max: number;
  };
  recommendedTermLength: number;
  bestTimeToCall?: string;
  suggestedScript?: string;
  generatedAt: string;
}

// =============================================================================
// CUSTOMER PROFILE DATA (for auto-fill)
// =============================================================================

export interface CustomerProfileData {
  id: string;
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
  gender?: Gender;
  state?: string;

  // Additional context for AI analysis
  mortgageBalance?: number;
  estimatedIncome?: number;
  numberOfDependents?: number;
  currentPolicies?: Array<{
    type: string;
    premium: number;
  }>;
  recentLifeEvents?: string[];
}

// =============================================================================
// COMPONENT PROPS
// =============================================================================

export interface LifeInsuranceTabProps {
  customerId: string;
  customerData: CustomerProfileData;
  onQuoteGenerated?: (quote: QuoteResponse) => void;
  onApplicationStarted?: (quoteId: string) => void;
}

export interface InstantQuoteWidgetProps {
  customerData: CustomerProfileData;
  prefilledOpportunity?: AICrossSellOpportunity;
  onQuoteSuccess: (response: QuoteResponse) => void;
  onQuoteError: (error: string) => void;
}

export interface QuoteFormProps {
  customerData: CustomerProfileData;
  prefilledValues?: Partial<QuoteRequestParams>;
  onSubmit: (params: QuoteRequestParams) => void;
  isLoading: boolean;
}

export interface QuoteResultsProps {
  quotes: QuoteDetails[];
  requestParams: QuoteRequestParams;
  onViewIllustration: (quoteId: string) => void;
  onStartApplication: (quoteId: string) => void;
  onEditQuote: () => void;
  onEmailResults: () => void;
  onSaveToHistory: () => void;
}

export interface AICrossSellCardProps {
  opportunity: AICrossSellOpportunity;
  onDismiss: () => void;
  onGetQuotes: () => void;
  onCallCustomer: () => void;
  onCreateTask: () => void;
}

export interface QuoteHistoryProps {
  customerId: string;
  history: QuoteHistoryItem[];
  onViewQuote: (historyId: string) => void;
  onEmailQuote: (historyId: string) => void;
}

// =============================================================================
// API REQUEST/RESPONSE TYPES
// =============================================================================

export interface Back9QuoteRequest {
  client_id: string;
  death_benefit: number;
  insured: {
    first_name: string;
    last_name: string;
    health: number; // 1-5 scale
    gender: string;
    smoker: string;
    birthdate: string;
  };
  mode: number; // Payment mode: 2 = Monthly
  selected_type: PolicyType;
  state: string;
  term_duration: number;
}

export interface Back9QuoteResponse {
  quotes: Array<{
    carrier: {
      name: string;
      am_best_rating: string;
    };
    product: {
      name: string;
      type: string;
    };
    premium: {
      monthly: number;
      annual: number;
    };
    death_benefit: number;
    term_duration: number;
    features?: string[];
    illustration_url?: string;
    application_url?: string;
  }>;
}

// =============================================================================
// CONSTANTS
// =============================================================================

export const TERM_LENGTH_OPTIONS = [10, 15, 20, 25, 30] as const;

export const COVERAGE_AMOUNT_OPTIONS = [
  100000,
  250000,
  500000,
  750000,
  1000000,
  1500000,
  2000000,
  2500000,
  3000000,
  5000000,
] as const;

export const US_STATES = [
  { code: 'AL', name: 'Alabama' },
  { code: 'AK', name: 'Alaska' },
  { code: 'AZ', name: 'Arizona' },
  { code: 'AR', name: 'Arkansas' },
  { code: 'CA', name: 'California' },
  { code: 'CO', name: 'Colorado' },
  { code: 'CT', name: 'Connecticut' },
  { code: 'DE', name: 'Delaware' },
  { code: 'FL', name: 'Florida' },
  { code: 'GA', name: 'Georgia' },
  { code: 'HI', name: 'Hawaii' },
  { code: 'ID', name: 'Idaho' },
  { code: 'IL', name: 'Illinois' },
  { code: 'IN', name: 'Indiana' },
  { code: 'IA', name: 'Iowa' },
  { code: 'KS', name: 'Kansas' },
  { code: 'KY', name: 'Kentucky' },
  { code: 'LA', name: 'Louisiana' },
  { code: 'ME', name: 'Maine' },
  { code: 'MD', name: 'Maryland' },
  { code: 'MA', name: 'Massachusetts' },
  { code: 'MI', name: 'Michigan' },
  { code: 'MN', name: 'Minnesota' },
  { code: 'MS', name: 'Mississippi' },
  { code: 'MO', name: 'Missouri' },
  { code: 'MT', name: 'Montana' },
  { code: 'NE', name: 'Nebraska' },
  { code: 'NV', name: 'Nevada' },
  { code: 'NH', name: 'New Hampshire' },
  { code: 'NJ', name: 'New Jersey' },
  { code: 'NM', name: 'New Mexico' },
  { code: 'NY', name: 'New York' },
  { code: 'NC', name: 'North Carolina' },
  { code: 'ND', name: 'North Dakota' },
  { code: 'OH', name: 'Ohio' },
  { code: 'OK', name: 'Oklahoma' },
  { code: 'OR', name: 'Oregon' },
  { code: 'PA', name: 'Pennsylvania' },
  { code: 'RI', name: 'Rhode Island' },
  { code: 'SC', name: 'South Carolina' },
  { code: 'SD', name: 'South Dakota' },
  { code: 'TN', name: 'Tennessee' },
  { code: 'TX', name: 'Texas' },
  { code: 'UT', name: 'Utah' },
  { code: 'VT', name: 'Vermont' },
  { code: 'VA', name: 'Virginia' },
  { code: 'WA', name: 'Washington' },
  { code: 'WV', name: 'West Virginia' },
  { code: 'WI', name: 'Wisconsin' },
  { code: 'WY', name: 'Wyoming' },
  { code: 'DC', name: 'District of Columbia' },
] as const;

export const HEALTH_CLASS_DESCRIPTIONS: Record<HealthClass, string> = {
  [HealthClass.EXCELLENT]: 'No health issues, ideal weight, non-smoker',
  [HealthClass.GOOD]: 'Minor health issues, generally healthy',
  [HealthClass.FAIR]: 'Some health conditions, controlled with medication',
  [HealthClass.POOR]: 'Significant health conditions',
};

export const POLICY_TYPE_DESCRIPTIONS: Record<PolicyType, string> = {
  [PolicyType.TERM]: 'Coverage for a specific period (10-30 years)',
  [PolicyType.WHOLE_LIFE]: 'Lifetime coverage with cash value',
  [PolicyType.UNIVERSAL_LIFE]: 'Flexible premiums with investment component',
  [PolicyType.FINAL_EXPENSE]: 'Smaller coverage for end-of-life expenses',
  [PolicyType.GUARANTEED_UNIVERSAL]: 'Guaranteed death benefit for life',
};

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatCurrencyWithCents(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function calculateAge(dateOfBirth: string): number {
  const today = new Date();
  const birthDate = new Date(dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

export function getConfidenceBadgeColor(confidence: OpportunityConfidence): string {
  switch (confidence) {
    case OpportunityConfidence.HIGH:
      return 'bg-emerald-100 text-emerald-800';
    case OpportunityConfidence.MEDIUM:
      return 'bg-amber-100 text-amber-800';
    case OpportunityConfidence.LOW:
      return 'bg-gray-100 text-gray-800';
  }
}

export function getIndicatorIcon(type: IndicatorTrigger['type']): string {
  switch (type) {
    case 'life_event':
      return 'calendar';
    case 'demographic':
      return 'user';
    case 'financial':
      return 'dollar-sign';
    case 'behavioral':
      return 'activity';
    case 'policy_gap':
      return 'shield-alert';
    default:
      return 'info';
  }
}
