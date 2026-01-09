// Re-export database schema types
import type {
  tenants,
  users,
  customers,
  policies,
  vehicles,
  drivers,
  properties,
  calls,
  wrapupDrafts,
  quotes,
  messages,
  activities,
  tasks,
  trainingModules,
  userTrainingProgress,
  knowledgeArticles,
  syncLogs,
} from '@/db/schema';

// Inferred types from schema
export type Tenant = typeof tenants.$inferSelect;
export type NewTenant = typeof tenants.$inferInsert;

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type Customer = typeof customers.$inferSelect;
export type NewCustomer = typeof customers.$inferInsert;

export type Policy = typeof policies.$inferSelect;
export type NewPolicy = typeof policies.$inferInsert;

export type Vehicle = typeof vehicles.$inferSelect;
export type NewVehicle = typeof vehicles.$inferInsert;

export type Driver = typeof drivers.$inferSelect;
export type NewDriver = typeof drivers.$inferInsert;

export type Property = typeof properties.$inferSelect;
export type NewProperty = typeof properties.$inferInsert;

export type Call = typeof calls.$inferSelect;
export type NewCall = typeof calls.$inferInsert;

export type WrapupDraft = typeof wrapupDrafts.$inferSelect;
export type NewWrapupDraft = typeof wrapupDrafts.$inferInsert;

export type Quote = typeof quotes.$inferSelect;
export type NewQuote = typeof quotes.$inferInsert;

export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;

export type Activity = typeof activities.$inferSelect;
export type NewActivity = typeof activities.$inferInsert;

export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;

export type TrainingModule = typeof trainingModules.$inferSelect;
export type NewTrainingModule = typeof trainingModules.$inferInsert;

export type UserTrainingProgress = typeof userTrainingProgress.$inferSelect;
export type NewUserTrainingProgress = typeof userTrainingProgress.$inferInsert;

export type KnowledgeArticle = typeof knowledgeArticles.$inferSelect;
export type NewKnowledgeArticle = typeof knowledgeArticles.$inferInsert;

export type SyncLog = typeof syncLogs.$inferSelect;
export type NewSyncLog = typeof syncLogs.$inferInsert;

// Enum types
export type UserRole = 'owner' | 'admin' | 'supervisor' | 'agent' | 'trainee';
export type SubscriptionTier = 'starter' | 'professional' | 'enterprise';
export type CallDirection = 'inbound' | 'outbound';
export type CallStatus = 'ringing' | 'in_progress' | 'completed' | 'missed' | 'voicemail' | 'transferred';
export type TriageStatus = 'pending' | 'in_progress' | 'completed' | 'escalated' | 'cancelled';
export type TriagePriority = 'low' | 'medium' | 'high' | 'urgent';
export type TriageType = 'call' | 'quote' | 'claim' | 'service' | 'lead' | 'after_hours';
export type QuoteType =
  | 'personal_auto'
  | 'homeowners'
  | 'renters'
  | 'umbrella'
  | 'mobile_home'
  | 'recreational_vehicle'
  | 'motorcycle'
  | 'commercial_auto'
  | 'general_liability'
  | 'bop'
  | 'workers_comp'
  | 'professional_liability'
  | 'flood';
export type QuoteStatus = 'draft' | 'submitted' | 'quoted' | 'presented' | 'accepted' | 'declined' | 'expired';
export type PolicyStatus = 'active' | 'pending' | 'cancelled' | 'expired' | 'non_renewed';
export type MessageType = 'sms' | 'mms' | 'email';
export type MessageDirection = 'inbound' | 'outbound';

// API Response types
export interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}

// Pagination
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// Customer with relations
export interface CustomerWithRelations extends Customer {
  policies?: Policy[];
  producer?: User;
  csr?: User;
  properties?: Property[];
}

// Call with relations
export interface CallWithRelations extends Call {
  customer?: Customer;
  agent?: User;
}

// Quote with relations
export interface QuoteWithRelations extends Quote {
  customer?: Customer;
  createdBy?: User;
}

// Wrapup draft with relations
export interface WrapupDraftWithRelations extends WrapupDraft {
  call?: Call;
}

// Session user (from Supabase + our users table)
export interface SessionUser extends User {
  tenant: Tenant;
}

// Nearmap types
export interface NearmapFeature {
  type: string;
  present: boolean;
  confidence: number;
}

export interface NearmapAnalysis {
  lastImageDate: string;
  roofCondition: string;
  roofConditionConfidence: number;
  features: NearmapFeature[];
  treesOverhanging: boolean;
  poolDetected: boolean;
  trampolineDetected: boolean;
  solarPanels: boolean;
}

// AI Types
export interface AISummary {
  summary: string;
  keyPoints: string[];
  actionItems: string[];
  sentiment: 'positive' | 'neutral' | 'negative';
  confidence: number;
}

export interface AIEntityDetection {
  type: 'vin' | 'policy_number' | 'date' | 'address' | 'phone' | 'email' | 'money';
  value: string;
  confidence: number;
  context?: string;
}

export interface TranscriptionSegment {
  start: number;
  end: number;
  speaker: 'agent' | 'customer';
  text: string;
  confidence: number;
}

// Life Insurance Types
export * from './lifeInsurance.types';
