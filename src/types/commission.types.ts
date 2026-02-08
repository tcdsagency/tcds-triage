/**
 * Commission Tracker Types
 * ========================
 * Type definitions for the commission tracking and reconciliation system.
 */

// =============================================================================
// ENUMS / CONSTANTS
// =============================================================================

export type CommissionAgentRole = 'owner' | 'producer' | 'csr' | 'house';

export type CommissionTransactionType =
  | 'new_business'
  | 'renewal'
  | 'cancellation'
  | 'endorsement'
  | 'return_premium'
  | 'bonus'
  | 'override'
  | 'contingency'
  | 'other';

export type CommissionImportStatus =
  | 'pending'
  | 'parsing'
  | 'mapping'
  | 'previewing'
  | 'importing'
  | 'completed'
  | 'failed';

export type CommissionReconciliationStatus =
  | 'unmatched'
  | 'partial_match'
  | 'matched'
  | 'discrepancy'
  | 'resolved';

export type CommissionAnomalyType =
  | 'missing_policy'
  | 'duplicate_transaction'
  | 'rate_deviation'
  | 'negative_commission'
  | 'missing_agent'
  | 'unresolved_carrier'
  | 'split_mismatch'
  | 'other';

export type CommissionAnomalySeverity = 'info' | 'warning' | 'error';

export type CommissionMonthCloseStatusType = 'open' | 'in_review' | 'locked';

export type CommissionAuditAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'import'
  | 'reconcile'
  | 'allocate'
  | 'month_close'
  | 'month_reopen'
  | 'draw_payment';

// =============================================================================
// ENTITY TYPES
// =============================================================================

export interface CommissionAgent {
  id: string;
  tenantId: string;
  firstName: string;
  lastName: string;
  email: string | null;
  role: CommissionAgentRole;
  isActive: boolean;
  userId: string | null;
  hasDrawAccount: boolean;
  monthlyDrawAmount: string | null;
  defaultSplitPercent: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  // Joined data
  codes?: CommissionAgentCode[];
}

export interface CommissionAgentCode {
  id: string;
  tenantId: string;
  agentId: string;
  code: string;
  carrierId: string | null;
  description: string | null;
  createdAt: string;
}

export interface CommissionCarrier {
  id: string;
  tenantId: string;
  name: string;
  carrierCode: string | null;
  defaultNewBusinessRate: string | null;
  defaultRenewalRate: string | null;
  isActive: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  // Joined data
  aliases?: CommissionCarrierAlias[];
}

export interface CommissionCarrierAlias {
  id: string;
  tenantId: string;
  carrierId: string;
  alias: string;
  createdAt: string;
}

export interface CommissionFieldMapping {
  id: string;
  tenantId: string;
  name: string;
  carrierId: string | null;
  mapping: Record<string, string>;
  csvHeaders: string[] | null;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CommissionImportBatch {
  id: string;
  tenantId: string;
  fileName: string;
  status: CommissionImportStatus;
  carrierId: string | null;
  fieldMappingId: string | null;
  totalRows: number;
  importedRows: number;
  skippedRows: number;
  errorRows: number;
  duplicateRows: number;
  rawData: Record<string, string>[] | null;
  parsedHeaders: string[] | null;
  importedByUserId: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

export interface CommissionImportError {
  id: string;
  tenantId: string;
  batchId: string;
  rowNumber: number;
  field: string | null;
  value: string | null;
  errorMessage: string;
  rawRow: Record<string, string> | null;
  createdAt: string;
}

export interface CommissionPolicy {
  id: string;
  tenantId: string;
  policyNumber: string;
  carrierId: string | null;
  carrierName: string | null;
  insuredName: string | null;
  lineOfBusiness: string | null;
  effectiveDate: string | null;
  expirationDate: string | null;
  premium: string | null;
  primaryAgentId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CommissionTransaction {
  id: string;
  tenantId: string;
  policyId: string | null;
  carrierId: string | null;
  importBatchId: string | null;
  policyNumber: string;
  carrierName: string | null;
  insuredName: string | null;
  transactionType: CommissionTransactionType | null;
  lineOfBusiness: string | null;
  effectiveDate: string | null;
  statementDate: string | null;
  agentPaidDate: string | null;
  grossPremium: string | null;
  commissionRate: string | null;
  commissionAmount: string;
  reportingMonth: string | null;
  dedupeHash: string | null;
  notes: string | null;
  isManualEntry: boolean;
  createdAt: string;
  updatedAt: string;
  // Joined data
  allocations?: CommissionAllocation[];
  carrier?: CommissionCarrier;
}

export interface CommissionAllocation {
  id: string;
  tenantId: string;
  transactionId: string;
  agentId: string;
  splitPercent: string;
  splitAmount: string;
  createdAt: string;
  // Joined data
  agent?: CommissionAgent;
}

export interface CommissionBankDeposit {
  id: string;
  tenantId: string;
  depositDate: string;
  amount: string;
  carrierId: string | null;
  carrierName: string | null;
  referenceNumber: string | null;
  reportingMonth: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CommissionCarrierReconciliation {
  id: string;
  tenantId: string;
  carrierId: string;
  reportingMonth: string;
  carrierStatementTotal: string | null;
  bankDepositTotal: string | null;
  systemTransactionTotal: string | null;
  statementVsDeposit: string | null;
  statementVsSystem: string | null;
  depositVsSystem: string | null;
  status: CommissionReconciliationStatus;
  resolvedByUserId: string | null;
  resolutionNotes: string | null;
  createdAt: string;
  updatedAt: string;
  // Joined data
  carrier?: CommissionCarrier;
}

export interface CommissionDrawPayment {
  id: string;
  tenantId: string;
  agentId: string;
  paymentDate: string;
  amount: string;
  reportingMonth: string;
  notes: string | null;
  createdAt: string;
  // Joined data
  agent?: CommissionAgent;
}

export interface CommissionDrawBalance {
  id: string;
  tenantId: string;
  agentId: string;
  reportingMonth: string;
  balanceForward: string;
  totalCommissionsEarned: string;
  totalDrawPayments: string;
  endingBalance: string;
  createdAt: string;
  updatedAt: string;
  // Joined data
  agent?: CommissionAgent;
}

export interface CommissionAnomaly {
  id: string;
  tenantId: string;
  type: CommissionAnomalyType;
  severity: CommissionAnomalySeverity;
  message: string;
  details: Record<string, unknown> | null;
  transactionId: string | null;
  importBatchId: string | null;
  isResolved: boolean;
  resolvedByUserId: string | null;
  resolutionNotes: string | null;
  resolvedAt: string | null;
  createdAt: string;
}

export interface CommissionMonthCloseStatus {
  id: string;
  tenantId: string;
  reportingMonth: string;
  status: CommissionMonthCloseStatusType;
  lockedByUserId: string | null;
  lockedAt: string | null;
  unlockedByUserId: string | null;
  unlockedAt: string | null;
  validationResults: ValidationCheckResult[] | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

// =============================================================================
// BUSINESS LOGIC TYPES
// =============================================================================

export interface ValidationCheckResult {
  check: string;
  label: string;
  passed: boolean;
  message: string;
  details?: Record<string, unknown>;
}

export interface ReconciliationSummary {
  carrierId: string;
  carrierName: string;
  reportingMonth: string;
  carrierStatementTotal: number;
  bankDepositTotal: number;
  systemTransactionTotal: number;
  statementVsDeposit: number;
  statementVsSystem: number;
  depositVsSystem: number;
  status: CommissionReconciliationStatus;
  isMatched: boolean;
}

export interface DrawBalanceSummary {
  agentId: string;
  agentName: string;
  reportingMonth: string;
  balanceForward: number;
  totalCommissionsEarned: number;
  totalDrawPayments: number;
  endingBalance: number;
  monthlyDrawAmount: number;
}

export interface ImportPreviewRow {
  rowNumber: number;
  policyNumber: string;
  carrierName: string;
  insuredName: string;
  transactionType: string;
  commissionAmount: number;
  effectiveDate: string;
  isDuplicate: boolean;
  errors: string[];
}

export interface DashboardStats {
  totalCommissionsThisMonth: number;
  totalCommissionsLastMonth: number;
  monthOverMonthChange: number;
  pendingReconciliations: number;
  unresolvedAnomalies: number;
  activeAgents: number;
  recentImports: CommissionImportBatch[];
}

export interface AgentStatement {
  agent: CommissionAgent;
  reportingMonth: string;
  transactions: CommissionTransaction[];
  totalCommission: number;
  drawPayments: CommissionDrawPayment[];
  totalDrawPayments: number;
  netPayable: number;
}

export interface CarrierSummary {
  carrier: CommissionCarrier;
  reportingMonth: string;
  transactionCount: number;
  totalCommission: number;
  byTransactionType: Record<string, { count: number; total: number }>;
}
