// Agent Assist System Types
// Real-time guidance for intake staff during calls and form completion

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

export interface PlaybookScripts {
  opening: string[];
  discovery: string[];
  resolution: string[];
}

export interface Playbook {
  id: string;
  domain: PlaybookDomain;
  name: string;
  description: string;
  triggerKeywords: string[];
  doList: string[];
  dontList: string[];
  escalateIf: string[];
  scripts: PlaybookScripts;
  complianceNotes?: string[];
}

export interface PlaybookMatch {
  playbook: Playbook;
  confidence: number;
  matchedTriggers: string[];
}

// =============================================================================
// AI SUGGESTION TYPES
// =============================================================================

export type SuggestionType = 'knowledge' | 'compliance' | 'upsell' | 'next_action';

export interface AgentSuggestion {
  id: string;
  type: SuggestionType;
  title: string;
  content: string;
  confidence: number;
  source?: string;
  actionLabel?: string;
}

export interface SuggestionsRequest {
  transcript: string;
  customerProfile?: {
    name?: string;
    policyTypes?: string[];
    tenure?: string;
    claimsHistory?: number;
  };
  currentPlaybook?: string;
  callId?: string;
}

export interface SuggestionsResponse {
  success: boolean;
  suggestions: AgentSuggestion[];
  tokensUsed?: number;
  error?: string;
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
  | 'renters'
  | 'commercial_auto'
  | 'general_liability'
  | 'bop'
  | 'workers_comp'
  | 'umbrella';

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

export interface TelemetryRecord extends TelemetryEvent {
  id: string;
  tenantId: string;
  userId?: string;
  createdAt: Date;
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
  error?: string;
}

export interface TelemetryRequest {
  suggestionType: string;
  suggestionId?: string;
  playbookId?: string;
  action: TelemetryAction;
  feedback?: TelemetryFeedback;
  feedbackNote?: string;
  callId?: string;
  formSection?: string;
  content?: string;
  callTranscriptSnippet?: string;
}

export interface TelemetryResponse {
  success: boolean;
  id?: string;
  error?: string;
}

// =============================================================================
// COMPONENT PROP TYPES
// =============================================================================

export interface LiveAssistCardProps {
  playbook: Playbook | null;
  suggestions: AgentSuggestion[];
  isLoading?: boolean;
  onUseSuggestion?: (suggestion: AgentSuggestion) => void;
  onDismissSuggestion?: (suggestion: AgentSuggestion) => void;
  onPlaybookFeedback?: (playbookId: string, feedback: TelemetryFeedback) => void;
}

export interface AgentAssistSidebarProps {
  quoteType: QuoteType;
  currentSection: string;
  expandedSections?: string[];
  onSectionClick?: (sectionId: string) => void;
  className?: string;
}

export interface AgentAssistPanelProps {
  suggestions: AgentSuggestion[];
  isLoading?: boolean;
  onUseSuggestion?: (suggestion: AgentSuggestion) => void;
  onFeedback?: (suggestionId: string, feedback: TelemetryFeedback) => void;
}
