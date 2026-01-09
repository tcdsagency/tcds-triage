// =============================================================================
// ELIGIBILITY TYPES
// Type definitions for the eligibility/gatekeeper enforcement system
// =============================================================================

/**
 * Overall eligibility status for a quote
 */
export type EligibilityStatus = 'ELIGIBLE' | 'REVIEW' | 'DECLINE';

/**
 * Severity level for alerts
 * - red: Blocks submission (DECLINE/REDIRECT actions)
 * - yellow: Warning that allows submission with acknowledgment (WARN action)
 */
export type AlertSeverity = 'red' | 'yellow';

/**
 * Action type from gatekeeper definitions
 */
export type GatekeeperAction = 'decline' | 'warn' | 'redirect';

/**
 * An individual eligibility alert
 */
export interface EligibilityAlert {
  /** Unique identifier for this alert */
  id: string;
  /** The field that triggered this alert */
  field: string;
  /** Human-readable field label */
  fieldLabel?: string;
  /** The value that triggered the alert */
  triggeredValue: any;
  /** Alert severity (red = blocker, yellow = warning) */
  severity: AlertSeverity;
  /** The gatekeeper action type */
  action: GatekeeperAction;
  /** Message explaining the issue */
  message: string;
  /** Optional script for agent to use with customer */
  agentScript?: string;
  /** Whether this alert has been acknowledged by the agent */
  acknowledged: boolean;
  /** Timestamp when alert was first triggered */
  triggeredAt: Date;
}

/**
 * Result of evaluating eligibility for a quote
 */
export interface EligibilityResult {
  /** Overall eligibility status */
  status: EligibilityStatus;
  /** All active alerts */
  alerts: EligibilityAlert[];
  /** Red alerts that block submission */
  blockers: EligibilityAlert[];
  /** Yellow warnings that allow submission with acknowledgment */
  warnings: EligibilityAlert[];
  /** Whether there are unacknowledged blockers preventing submission */
  hasUnacknowledgedBlockers: boolean;
  /** Whether there are unacknowledged warnings */
  hasUnacknowledgedWarnings: boolean;
  /** Count of total issues */
  issueCount: number;
}

/**
 * Gatekeeper definition as defined in quote schemas
 */
export interface GatekeeperDefinition {
  field: string;
  condition: string;
  message: string;
  action: GatekeeperAction;
  agentScript?: string;
}

/**
 * Quote type identifier
 */
export type QuoteType =
  | 'personal_auto'
  | 'homeowners'
  | 'mobile_home'
  | 'renters'
  | 'umbrella'
  | 'bop'
  | 'general_liability'
  | 'workers_comp'
  | 'recreational'
  | 'flood'
  | 'commercial_auto';

/**
 * Props for eligibility context
 */
export interface EligibilityContextValue {
  /** Current eligibility result */
  result: EligibilityResult;
  /** Whether evaluation is in progress */
  isEvaluating: boolean;
  /** Acknowledge a warning alert */
  acknowledgeAlert: (alertId: string) => void;
  /** Acknowledge all warnings */
  acknowledgeAllWarnings: () => void;
  /** Get alerts for a specific field */
  getFieldAlerts: (fieldName: string) => EligibilityAlert[];
  /** Check if a field has alerts */
  hasFieldAlert: (fieldName: string) => boolean;
  /** Get the severity of alerts for a field */
  getFieldSeverity: (fieldName: string) => AlertSeverity | null;
  /** Force re-evaluation */
  reevaluate: () => void;
}

/**
 * Default/empty eligibility result
 */
export const EMPTY_ELIGIBILITY_RESULT: EligibilityResult = {
  status: 'ELIGIBLE',
  alerts: [],
  blockers: [],
  warnings: [],
  hasUnacknowledgedBlockers: false,
  hasUnacknowledgedWarnings: false,
  issueCount: 0,
};
