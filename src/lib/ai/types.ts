/**
 * AI System Types
 * ================
 * Shared types for the AI orchestration layer
 */

// =============================================================================
// CORE TYPES
// =============================================================================

export type AIModel =
  | 'gpt-4o'           // Most capable, complex reasoning
  | 'gpt-4o-mini'      // Fast, cheap, simple tasks
  | 'claude-3-5-sonnet' // Long documents, creative writing
  | 'claude-3-5-haiku'; // Fast Claude for simple tasks

export type AITaskType =
  | 'simple_classification'
  | 'complex_reasoning'
  | 'long_document'
  | 'structured_output'
  | 'creative_writing'
  | 'sentiment_analysis'
  | 'summarization'
  | 'extraction';

export interface AIRequest {
  type: AITaskType;
  input: string | object;
  context?: AIContext;
  options?: AIRequestOptions;
}

export interface AIRequestOptions {
  model?: AIModel;
  temperature?: number;
  maxTokens?: number;
  forceRefresh?: boolean;
  timeout?: number;
}

export interface AIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  model: AIModel;
  tokensUsed: number;
  latencyMs: number;
  cached: boolean;
}

// =============================================================================
// CONTEXT TYPES
// =============================================================================

export interface AIContext {
  user?: UserContext;
  customer?: CustomerContext;
  organization?: OrganizationContext;
  temporal?: TemporalContext;
  history?: HistoryContext;
  market?: MarketContext;
}

export interface UserContext {
  userId: string;
  name: string;
  role: string;
  experience: 'junior' | 'mid' | 'senior';
  specialties?: string[];
  performance?: {
    conversionRate: number;
    retentionRate: number;
    avgCallTime: number;
  };
}

export interface CustomerContext {
  customerId: string;
  name: string;
  email?: string;
  phone?: string;
  customerSince?: string;
  clientLevel: 'A' | 'AA' | 'AAA';
  isOG: boolean;

  // Policies
  policies: PolicyContext[];
  totalPremium: number;

  // Behavior
  preferredChannel?: 'phone' | 'email' | 'text';
  preferredTime?: string;
  responseRate?: number;
  avgResponseTime?: number;
  engagementScore?: number;

  // Risk
  churnRisk?: number;
  claimFrequency?: number;

  // History
  lastContact?: string;
  recentInteractions?: InteractionContext[];
  openClaims?: ClaimContext[];
}

export interface PolicyContext {
  policyId: string;
  type: string;
  carrier: string;
  premium: number;
  effectiveDate: string;
  expirationDate: string;
  status: string;
  vehicles?: { year: number; make: string; model: string }[];
  drivers?: { name: string; age: number }[];
}

export interface InteractionContext {
  type: 'call' | 'email' | 'text' | 'chat';
  date: string;
  summary?: string;
  sentiment?: number;
  outcome?: string;
}

export interface ClaimContext {
  claimId: string;
  type: string;
  status: string;
  dateOpened: string;
  amount?: number;
}

export interface OrganizationContext {
  tenantId: string;
  name: string;
  goals?: {
    retentionTarget: number;
    crossSellTarget: number;
    newBusinessTarget: number;
  };
  capacity?: {
    availableAgents: number;
    callQueueLength: number;
  };
}

export interface TemporalContext {
  currentTime: Date;
  dayOfWeek: number;
  isBusinessHours: boolean;
  isEndOfMonth: boolean;
  isEndOfQuarter: boolean;
  season: 'spring' | 'summer' | 'fall' | 'winter';
}

export interface HistoryContext {
  previousPredictions?: PredictionHistory[];
  conversationHistory?: ConversationTurn[];
}

export interface PredictionHistory {
  type: string;
  prediction: any;
  actual?: any;
  timestamp: string;
}

export interface ConversationTurn {
  role: 'agent' | 'customer' | 'system';
  content: string;
  timestamp: string;
}

export interface MarketContext {
  averageRates?: Record<string, number>;
  competitorActivity?: string[];
  trends?: string[];
}

// =============================================================================
// PREDICTION TYPES
// =============================================================================

export interface ChurnPrediction {
  score: number;           // 0-1 probability
  confidence: number;      // 0-1 confidence
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  factors: ChurnFactor[];
  recommendation: string;
  suggestedActions: string[];
  retentionScript?: string;
}

export interface ChurnFactor {
  factor: string;
  impact: number;          // -1 to 1 (negative = reduces churn)
  description: string;
}

export interface CrossSellPrediction {
  product: string;
  probability: number;
  expectedRevenue: number;
  confidence: number;
  reasoning: string;
  timing: 'immediate' | 'renewal' | 'next_contact' | 'future';
  approach: string;
  talkingPoints: string[];
}

// =============================================================================
// TASK TYPES
// =============================================================================

export interface PredictedTask {
  type: 'retention_call' | 'cross_sell' | 'claim_followup' | 'renewal_review' | 'general_outreach';
  customerId: string;
  customerName: string;
  priority: 'urgent' | 'high' | 'medium' | 'low';
  reasoning: string;
  estimatedDuration: number;  // minutes
  expectedOutcome: {
    success: number;
    revenue?: number;
    retention?: number;
  };
  preparation: string[];
  script?: string;
  scheduledTime?: string;
  dueBy?: string;
}

export interface DailyTaskList {
  date: string;
  agentId: string;
  tasks: PredictedTask[];
  summary: {
    totalTasks: number;
    estimatedTime: number;
    expectedRevenue: number;
    retentionImpact: string;
  };
}

// =============================================================================
// COMMUNICATION TYPES
// =============================================================================

export interface ComposedMessage {
  subject?: string;
  body: string;
  tone: 'formal' | 'friendly' | 'brief' | 'detailed';
  personalization: string[];
  callsToAction: string[];
  alternatives?: {
    tone: string;
    body: string;
  }[];
}

export interface MessageCompositionRequest {
  type: 'email' | 'sms';
  purpose: 'renewal_reminder' | 'claim_update' | 'welcome' | 'followup' | 'quote_followup' | 'payment_reminder' | 'general';
  customerId: string;
  context?: Record<string, any>;
  tone?: 'formal' | 'friendly' | 'brief';
}

// =============================================================================
// CALL ANALYSIS TYPES
// =============================================================================

export interface CallAnalysis {
  sentiment: {
    score: number;         // -1 to 1
    label: 'negative' | 'neutral' | 'positive';
    confidence: number;
  };
  intent: {
    primary: string;
    confidence: number;
    secondary?: string[];
  };
  urgency: 'low' | 'medium' | 'high' | 'critical';
  suggestedResponses: SuggestedResponse[];
  alerts: CallAlert[];
  escalation?: EscalationRecommendation;
}

export interface SuggestedResponse {
  response: string;
  reasoning: string;
  tone: string;
}

export interface CallAlert {
  type: string;
  message: string;
  severity: 'info' | 'warning' | 'critical';
  action?: string;
}

export interface EscalationRecommendation {
  shouldEscalate: boolean;
  reason?: string;
  escalateTo?: string;
  escalateIf?: string;
}

// =============================================================================
// QA TYPES
// =============================================================================

export interface CallQAReview {
  callId: string;
  scores: {
    overall: number;
    greeting: number;
    activeListening: number;
    productKnowledge: number;
    objectionHandling: number;
    closing: number;
    compliance: number;
  };
  strengths: string[];
  improvements: QAImprovement[];
  compliance: {
    passed: boolean;
    checks: ComplianceCheck[];
  };
  coachingOpportunities: string[];
  flaggedForReview: boolean;
  managerSummary: string;
}

export interface QAImprovement {
  area: string;
  issue: string;
  example?: string;
  suggestion: string;
  trainingResource?: string;
}

export interface ComplianceCheck {
  item: string;
  passed: boolean;
  note?: string;
}

// =============================================================================
// SEARCH TYPES
// =============================================================================

export interface SemanticSearchResult {
  id: string;
  type: 'customer' | 'policy' | 'call' | 'document' | 'note' | 'knowledge';
  title: string;
  content: string;
  relevance: number;
  metadata: Record<string, any>;
  quickActions?: string[];
}

export interface SearchQuery {
  query: string;
  type?: string;
  limit?: number;
  filters?: Record<string, any>;
}
