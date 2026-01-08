// Agent Assist System Types
// Real-time guidance for intake staff with contextual scripts and tips

// =============================================================================
// PLAYBOOK TYPES
// =============================================================================

export type PlaybookDomain =
  | 'billing_payments'
  | 'new_business'
  | 'renewals'
  | 'claims'
  | 'policy_changes'
  | 'escalations';

export interface Playbook {
  id: string;
  domain: PlaybookDomain;
  title: string;
  description: string;
  triggers: string[];
  confirm: string;
  do: string[];
  dont: string[];
  escalateIf: string[];
  scripts: {
    opening: string[];
    discovery: string[];
    resolution: string[];
  };
  complianceNotes?: string[];
}

// =============================================================================
// SUGGESTION TYPES
// =============================================================================

export type SuggestionType = 'knowledge' | 'compliance' | 'upsell' | 'next_action';

export interface AgentSuggestion {
  id: string;
  type: SuggestionType;
  title: string;
  content: string;
  confidence: number;
  source?: string;
}

// =============================================================================
// FORM GUIDANCE TYPES
// =============================================================================

export type FormGuidanceTipType = 'script' | 'tip' | 'warning' | 'checklist';

export interface FormGuidanceTip {
  type: FormGuidanceTipType;
  title: string;
  content: string | string[];
}

export interface FormSectionGuidance {
  id: string;
  title: string;
  tips: FormGuidanceTip[];
}

export type QuoteType =
  | 'personal_auto'
  | 'homeowners'
  | 'mobile_home'
  | 'renters'
  | 'umbrella'
  | 'commercial_auto'
  | 'commercial_property'
  | 'bop'
  | 'general_liability'
  | 'workers_comp'
  | 'recreational'
  | 'flood'
  | 'life';

// =============================================================================
// TELEMETRY TYPES
// =============================================================================

export type TelemetryAction = 'shown' | 'used' | 'dismissed' | 'expanded' | 'collapsed';
export type TelemetryFeedback = 'helpful' | 'not_helpful' | 'too_basic' | 'incorrect';

export interface TelemetryEvent {
  suggestionType: string;
  suggestionId?: string;
  playbookId?: string;
  content?: string;
  action: TelemetryAction;
  feedback?: TelemetryFeedback;
  feedbackNote?: string;
  callId?: string;
  formSection?: string;
  callTranscriptSnippet?: string;
}

// =============================================================================
// API REQUEST/RESPONSE TYPES
// =============================================================================

export interface PlaybookMatchRequest {
  transcript: string;
  callType?: string;
}

export interface PlaybookMatchResponse {
  success: boolean;
  playbook: Playbook | null;
  confidence: number;
  matchedTriggers: string[];
}

export interface SuggestionsRequest {
  transcript: string;
  customerName?: string;
  policyInfo?: {
    carrier?: string;
    policyNumber?: string;
    expirationDate?: string;
  };
  currentPlaybook?: string;
}

export interface SuggestionsResponse {
  success: boolean;
  suggestions: AgentSuggestion[];
  tokensUsed?: number;
  error?: string;
}

export interface TelemetryRequest {
  events: TelemetryEvent[];
  userId?: string;
  callId?: string;
}

export interface TelemetryResponse {
  success: boolean;
  recorded: number;
  error?: string;
}
