import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  integer,
  jsonb,
  varchar,
  decimal,
  real,
  pgEnum,
  index,
  uniqueIndex,
  primaryKey,
  date,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ═══════════════════════════════════════════════════════════════════════════
// ENUMS
// ═══════════════════════════════════════════════════════════════════════════

export const userRoleEnum = pgEnum('user_role', [
  'owner',
  'admin',
  'supervisor',
  'agent',
  'trainee',
]);

export const subscriptionTierEnum = pgEnum('subscription_tier', [
  'starter',
  'professional',
  'enterprise',
]);

export const callDirectionEnum = pgEnum('call_direction', ['inbound', 'outbound']);

export const callStatusEnum = pgEnum('call_status', [
  'ringing',
  'in_progress',
  'completed',
  'missed',
  'voicemail',
  'transferred',
]);

export const triageStatusEnum = pgEnum('triage_status', [
  'pending',
  'in_progress',
  'completed',
  'escalated',
  'cancelled',
]);

export const triagePriorityEnum = pgEnum('triage_priority', [
  'low',
  'medium',
  'high',
  'urgent',
]);

export const triageTypeEnum = pgEnum('triage_type', [
  'call',
  'quote',
  'claim',
  'service',
  'lead',
  'after_hours',
  'message',
]);

export const quoteTypeEnum = pgEnum('quote_type', [
  'personal_auto',
  'homeowners',
  'renters',
  'umbrella',
  'mobile_home',
  'recreational_vehicle',
  'motorcycle',
  'commercial_auto',
  'general_liability',
  'bop',
  'workers_comp',
  'professional_liability',
  'flood',
]);

export const quoteStatusEnum = pgEnum('quote_status', [
  'draft',
  'submitted',
  'quoted',
  'presented',
  'accepted',
  'declined',
  'expired',
]);

export const policyStatusEnum = pgEnum('policy_status', [
  'active',
  'pending',
  'cancelled',
  'expired',
  'non_renewed',
]);

export const messageTypeEnum = pgEnum('message_type', ['sms', 'mms', 'email']);

export const messageDirectionEnum = pgEnum('message_direction', ['inbound', 'outbound']);

export const wrapupStatusEnum = pgEnum('wrapup_status', [
  'pending_ai_processing',
  'pending_review',
  'completed',
  'posted',
]);

export const policyChangeTypeEnum = pgEnum('policy_change_type', [
  'add_vehicle',
  'remove_vehicle',
  'replace_vehicle',
  'add_driver',
  'remove_driver',
  'address_change',
  'add_mortgagee',
  'remove_mortgagee',
  'coverage_change',
  'cancel_policy',
]);

export const policyChangeStatusEnum = pgEnum('policy_change_status', [
  'pending',        // Submitted, awaiting processing
  'in_review',      // Being reviewed by agent
  'submitted_to_carrier', // Sent to carrier
  'completed',      // Change processed
  'rejected',       // Rejected by carrier or agent
  'cancelled',      // Cancelled by user
]);

export const mortgageePaymentStatusEnum = pgEnum('mortgagee_payment_status', [
  'current',        // All payments up to date
  'late',           // Payment overdue
  'grace_period',   // Within grace period
  'lapsed',         // Policy lapsed for non-payment
  'unknown',        // Could not determine status
  'pending_check',  // Check in progress
  'error',          // Check failed
]);

export const mortgageeCheckStatusEnum = pgEnum('mortgagee_check_status', [
  'pending',        // Queued for processing
  'in_progress',    // Currently being checked
  'completed',      // Successfully completed
  'failed',         // Check failed (will retry)
  'captcha_failed', // CAPTCHA solving failed
  'not_found',      // Policy not found on MCI
  'site_blocked',   // Rate limited or blocked
]);

export const policyNoticeTypeEnum = pgEnum('policy_notice_type', [
  'billing',        // Payment due, past due, cancellation for non-payment
  'policy',         // Renewals, endorsements, cancellations
  'claim',          // New claims, status updates, settlements
]);

export const policyNoticeUrgencyEnum = pgEnum('policy_notice_urgency', [
  'low',
  'medium',
  'high',
  'urgent',
]);

export const policyNoticeReviewStatusEnum = pgEnum('policy_notice_review_status', [
  'pending',        // Not yet reviewed
  'assigned',       // Assigned to an agent
  'reviewed',       // Agent has reviewed
  'flagged',        // Flagged for follow-up or attention
  'actioned',       // Action taken and sent to AgencyZoom
  'dismissed',      // Dismissed (no action needed)
]);

export const webhookDeliveryStatusEnum = pgEnum('webhook_delivery_status', [
  'pending',        // Queued to send
  'success',        // Successfully delivered
  'failed',         // Delivery failed (will retry)
]);

// ═══════════════════════════════════════════════════════════════════════════
// MULTI-TENANCY: TENANTS (Agencies)
// ═══════════════════════════════════════════════════════════════════════════

export const tenants = pgTable('tenants', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  // Basic Info
  name: text('name').notNull(),
  slug: varchar('slug', { length: 63 }).notNull().unique(), // subdomain
  
  // Branding
  logoUrl: text('logo_url'),
  primaryColor: varchar('primary_color', { length: 7 }).default('#10B981'),
  accentColor: varchar('accent_color', { length: 7 }).default('#3B82F6'),
  
  // Contact
  phone: varchar('phone', { length: 20 }),
  email: text('email'),
  website: text('website'),
  address: jsonb('address').$type<{
    street: string;
    city: string;
    state: string;
    zip: string;
  }>(),
  
  // Business Hours
  timezone: varchar('timezone', { length: 50 }).default('America/Chicago'),
  businessHours: jsonb('business_hours').$type<Record<string, { open: string; close: string } | null>>(),
  
  // Subscription
  subscriptionTier: subscriptionTierEnum('subscription_tier').default('starter'),
  subscriptionStatus: varchar('subscription_status', { length: 20 }).default('active'),
  trialEndsAt: timestamp('trial_ends_at'),
  
  // Usage Limits (from subscription)
  maxUsers: integer('max_users').default(3),
  aiTokensLimit: integer('ai_tokens_limit').default(100000),
  transcriptionMinutesLimit: integer('transcription_minutes_limit').default(60),
  smsLimit: integer('sms_limit').default(500),
  storageGbLimit: integer('storage_gb_limit').default(5),
  
  // Usage Tracking
  aiTokensUsed: integer('ai_tokens_used').default(0),
  transcriptionMinutesUsed: integer('transcription_minutes_used').default(0),
  smsUsed: integer('sms_used').default(0),
  storageGbUsed: decimal('storage_gb_used', { precision: 10, scale: 2 }).default('0'),
  
  // Integration Credentials (encrypted in production)
  integrations: jsonb('integrations').$type<{
    agencyzoom?: {
      apiKey: string;
      apiSecret: string;
      webhookUrl: string;
      syncInterval: number;
      writebackEnabled: boolean;
    };
    hawksoft?: {
      clientId: string;
      clientSecret: string;
      agencyId: number;
      syncInterval: number;
    };
    twilio?: {
      accountSid: string;
      authToken: string;
      phoneNumber: string;
    };
    threecx?: {
      serverUrl: string;
      clientId: string;
      clientSecret: string;
    };
    nearmap?: {
      apiKey: string;
    };
    openai?: {
      apiKey: string;
    };
    deepgram?: {
      apiKey: string;
    };
    donna?: {
      username: string;
      password: string;
      baseUrl?: string;
      authUrl?: string;
      syncEnabled: boolean;
      syncInterval: number;
    };
  }>(),
  
  // Feature Flags
  features: jsonb('features').$type<{
    aiAssistant: boolean;
    voiceTranscription: boolean;
    propertyIntelligence: boolean;
    commercialQuotes: boolean;
    trainingSystem: boolean;
    riskMonitor: boolean;
    reviewAutoSend: boolean; // When false, review requests require manual approval
  }>().default({
    aiAssistant: true,
    voiceTranscription: true,
    propertyIntelligence: false,
    commercialQuotes: false,
    trainingSystem: true,
    riskMonitor: false,
    reviewAutoSend: true, // Default: auto-send enabled
  }),
  
  // AI Customization
  aiPersonality: text('ai_personality').default('professional and friendly'),
  aiCustomInstructions: text('ai_custom_instructions'),
  
  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  uniqueIndex('tenants_slug_idx').on(table.slug),
]);

// ═══════════════════════════════════════════════════════════════════════════
// USERS
// ═══════════════════════════════════════════════════════════════════════════

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  
  // Auth (linked to Supabase Auth)
  authId: uuid('auth_id').unique(), // Supabase auth.users.id
  
  // Profile
  email: text('email').notNull(),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  phone: varchar('phone', { length: 20 }),
  avatarUrl: text('avatar_url'),
  
  // Role & Permissions
  role: userRoleEnum('role').default('agent'),
  permissions: jsonb('permissions').$type<string[]>().default([]),
  
  // Work
  extension: varchar('extension', { length: 10 }),
  isAvailable: boolean('is_available').default(true),
  currentStatus: varchar('current_status', { length: 20 }).default('available'),
  
  // External System Links (for Agent/CSR mapping)
  agencyzoomId: varchar('agencyzoom_id', { length: 50 }),  // Links to AgencyZoom user/CSR
  agentCode: varchar('agent_code', { length: 20 }),        // HawkSoft producer/CSR code
  directDial: varchar('direct_dial', { length: 20 }),      // Direct line for SMS notifications
  cellPhone: varchar('cell_phone', { length: 20 }),        // Personal cell for fallback SMS
  
  // Training
  skillLevel: integer('skill_level').default(1), // 1-10
  completedModules: jsonb('completed_modules').$type<string[]>().default([]),
  certifications: jsonb('certifications').$type<string[]>().default([]),
  
  // Mentorship
  mentorId: uuid('mentor_id').references((): any => users.id),
  
  // Lead Queue Rotation
  inLeadRotation: boolean('in_lead_rotation').default(true),
  leadRotationOrder: integer('lead_rotation_order'),
  
  // Settings
  preferences: jsonb('preferences').$type<{
    theme: 'light' | 'dark' | 'system';
    notifications: {
      calls: boolean;
      messages: boolean;
      tasks: boolean;
      email: boolean;
    };
    defaultView: string;
  }>(),

  // Feature Permissions (per-user feature toggles)
  featurePermissions: jsonb('feature_permissions').$type<Record<string, boolean>>(),

  // Status
  isActive: boolean('is_active').default(true),
  lastActiveAt: timestamp('last_active_at'),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('users_tenant_idx').on(table.tenantId),
  index('users_auth_idx').on(table.authId),
  index('users_email_idx').on(table.tenantId, table.email),
  index('users_az_idx').on(table.tenantId, table.agencyzoomId),
  index('users_extension_idx').on(table.tenantId, table.extension),
]);

// ═══════════════════════════════════════════════════════════════════════════
// CUSTOMERS (Unified view from AZ + HS)
// ═══════════════════════════════════════════════════════════════════════════

export const customers = pgTable('customers', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  
  // External IDs (for syncing)
  agencyzoomId: varchar('agencyzoom_id', { length: 100 }),
  hawksoftClientCode: varchar('hawksoft_client_code', { length: 50 }),
  
  // Basic Info
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  email: text('email'),
  phone: varchar('phone', { length: 20 }),
  phoneAlt: varchar('phone_alt', { length: 20 }),
  
  // Address
  address: jsonb('address').$type<{
    street: string;
    city: string;
    state: string;
    zip: string;
    county?: string;
  }>(),
  
  // Demographics
  dateOfBirth: timestamp('date_of_birth'),
  ssn: varchar('ssn_last4', { length: 4 }), // Last 4 only
  
  // Assignment
  producerId: uuid('producer_id').references(() => users.id, { onDelete: 'set null' }),
  csrId: uuid('csr_id').references(() => users.id, { onDelete: 'set null' }),
  
  // Pipeline (from AgencyZoom)
  pipelineStage: varchar('pipeline_stage', { length: 50 }),
  leadSource: varchar('lead_source', { length: 100 }),
  
  // Lead vs Customer distinction
  // Leads are prospects in AgencyZoom that haven't become customers yet
  // Important: Leads CANNOT have service requests in AgencyZoom
  isLead: boolean('is_lead').default(false),
  leadStatus: varchar('lead_status', { length: 50 }), // e.g., 'new', 'contacted', 'qualified'
  convertedToCustomerAt: timestamp('converted_to_customer_at'),
  
  // AI Insights
  aiSummary: text('ai_summary'),
  aiMemories: jsonb('ai_memories').$type<Array<{
    memory: string;
    source: string;
    createdAt: string;
  }>>().default([]),
  churnRiskScore: decimal('churn_risk_score', { precision: 3, scale: 2 }),
  healthScore: decimal('health_score', { precision: 3, scale: 2 }),
  crossSellOpportunities: jsonb('cross_sell_opportunities').$type<string[]>().default([]),

  // Donna AI (AgencyIQ/Crux) Insights
  donnaData: jsonb('donna_data').$type<{
    sentimentScore: number;
    isPersonalVIP: boolean;
    isCommercialVIP: boolean;
    retentionProbability: number;
    crossSellProbability: number;
    estimatedWalletSize: number;
    currentAnnualPremium: number;
    potentialGap: number;
    recommendations: Array<{
      id: string;
      type: string;
      priority: 'high' | 'medium' | 'low';
      title: string;
      description: string;
      suggestedAction?: string;
      estimatedPremium?: number;
      confidence?: number;
    }>;
    activities: Array<{
      id: string;
      type: string;
      createdAt: string;
      summary: string;
      priority?: string;
    }>;
    lastSyncedAt: string;
    donnaCustomerId: string;
  }>(),

  // Sync Status
  lastSyncedFromAz: timestamp('last_synced_from_az'),
  lastSyncedFromHs: timestamp('last_synced_from_hs'),
  lastSyncedFromDonna: timestamp('last_synced_from_donna'),
  
  // Archive Status (soft-delete - never hard delete, customer may reappear)
  isArchived: boolean('is_archived').default(false),
  archivedAt: timestamp('archived_at'),
  archivedReason: text('archived_reason'),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('customers_tenant_idx').on(table.tenantId),
  index('customers_phone_idx').on(table.tenantId, table.phone),
  index('customers_email_idx').on(table.tenantId, table.email),
  index('customers_az_idx').on(table.tenantId, table.agencyzoomId),
  index('customers_hs_idx').on(table.tenantId, table.hawksoftClientCode),
  index('customers_archived_idx').on(table.tenantId, table.isArchived),
  index('customers_lead_idx').on(table.tenantId, table.isLead),
  // Unique constraint to prevent duplicate AgencyZoom leads
  uniqueIndex('customers_tenant_az_unique').on(table.tenantId, table.agencyzoomId),
]);

// ═══════════════════════════════════════════════════════════════════════════
// POLICIES (Synced from HawkSoft - READ ONLY)
// ═══════════════════════════════════════════════════════════════════════════

export const policies = pgTable('policies', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  customerId: uuid('customer_id').notNull().references(() => customers.id, { onDelete: 'cascade' }),
  
  // External ID
  hawksoftPolicyId: varchar('hawksoft_policy_id', { length: 100 }),
  
  // Policy Info
  policyNumber: varchar('policy_number', { length: 50 }).notNull(),
  lineOfBusiness: varchar('line_of_business', { length: 50 }).notNull(),
  carrier: varchar('carrier', { length: 100 }),
  
  // Dates
  effectiveDate: timestamp('effective_date').notNull(),
  expirationDate: timestamp('expiration_date').notNull(),
  
  // Premium
  premium: decimal('premium', { precision: 12, scale: 2 }),
  
  // Status
  status: policyStatusEnum('status').default('active'),
  
  // Coverages (snapshot from HawkSoft)
  coverages: jsonb('coverages').$type<Array<{
    type: string;
    limit: string;
    deductible?: string;
    premium?: number;
  }>>(),
  
  // Sync
  lastSyncedAt: timestamp('last_synced_at'),
  rawData: jsonb('raw_data'), // Full HawkSoft response for reference
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('policies_tenant_idx').on(table.tenantId),
  index('policies_customer_idx').on(table.customerId),
  index('policies_number_idx').on(table.tenantId, table.policyNumber),
]);

// ═══════════════════════════════════════════════════════════════════════════
// VEHICLES (Synced from HawkSoft)
// ═══════════════════════════════════════════════════════════════════════════

export const vehicles = pgTable('vehicles', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  policyId: uuid('policy_id').notNull().references(() => policies.id, { onDelete: 'cascade' }),
  
  // Vehicle Info
  vin: varchar('vin', { length: 17 }),
  year: integer('year'),
  make: varchar('make', { length: 50 }),
  model: varchar('model', { length: 50 }),
  
  // Usage
  use: varchar('use', { length: 50 }), // pleasure, commute, business
  annualMiles: integer('annual_miles'),
  
  // Coverages specific to this vehicle
  coverages: jsonb('coverages'),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('vehicles_tenant_idx').on(table.tenantId),
  index('vehicles_policy_idx').on(table.policyId),
  index('vehicles_vin_idx').on(table.tenantId, table.vin),
]);

// ═══════════════════════════════════════════════════════════════════════════
// DRIVERS (Synced from HawkSoft)
// ═══════════════════════════════════════════════════════════════════════════

export const drivers = pgTable('drivers', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  policyId: uuid('policy_id').notNull().references(() => policies.id, { onDelete: 'cascade' }),
  
  // Driver Info
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  dateOfBirth: timestamp('date_of_birth'),
  licenseNumber: varchar('license_number', { length: 50 }),
  licenseState: varchar('license_state', { length: 2 }),
  
  // Status
  relationship: varchar('relationship', { length: 50 }), // insured, spouse, child, other
  isExcluded: boolean('is_excluded').default(false),
  
  // Violations
  violations: jsonb('violations').$type<Array<{
    type: string;
    date: string;
    points?: number;
  }>>().default([]),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('drivers_tenant_idx').on(table.tenantId),
  index('drivers_policy_idx').on(table.policyId),
]);

// ═══════════════════════════════════════════════════════════════════════════
// PROPERTIES (For homeowners, with Nearmap data)
// ═══════════════════════════════════════════════════════════════════════════

export const properties = pgTable('properties', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  customerId: uuid('customer_id').references(() => customers.id, { onDelete: 'set null' }),
  policyId: uuid('policy_id').references(() => policies.id, { onDelete: 'set null' }),
  
  // Address
  address: jsonb('address').$type<{
    street: string;
    city: string;
    state: string;
    zip: string;
    county?: string;
  }>().notNull(),
  
  // Geocoding
  latitude: decimal('latitude', { precision: 10, scale: 7 }),
  longitude: decimal('longitude', { precision: 10, scale: 7 }),
  
  // Construction (from HawkSoft or manual)
  yearBuilt: integer('year_built'),
  squareFeet: integer('square_feet'),
  stories: integer('stories'),
  constructionType: varchar('construction_type', { length: 50 }),
  roofType: varchar('roof_type', { length: 50 }),
  roofAge: integer('roof_age'),
  
  // Nearmap AI Analysis
  nearmapData: jsonb('nearmap_data').$type<{
    lastImageDate: string;
    roofCondition: string;
    roofConditionConfidence: number;
    features: Array<{
      type: string;
      present: boolean;
      confidence: number;
    }>;
    treesOverhanging: boolean;
    poolDetected: boolean;
    trampolineDetected: boolean;
    solarPanels: boolean;
  }>(),
  
  // Historical Images (for change detection)
  historicalImages: jsonb('historical_images').$type<Array<{
    date: string;
    imageUrl: string;
    roofCondition?: string;
  }>>().default([]),
  
  // Risk Assessment
  riskScore: decimal('risk_score', { precision: 3, scale: 2 }),
  hazardExposure: jsonb('hazard_exposure').$type<{
    wind: number;
    hail: number;
    flood: number;
    fire: number;
    earthquake: number;
  }>(),
  
  // AI-Generated Summary
  aiUnderwritingSummary: text('ai_underwriting_summary'),
  
  lastNearmapSync: timestamp('last_nearmap_sync'),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('properties_tenant_idx').on(table.tenantId),
  index('properties_customer_idx').on(table.customerId),
]);

// ═══════════════════════════════════════════════════════════════════════════
// PROPERTY LOOKUPS (Cache for Property Intelligence searches)
// ═══════════════════════════════════════════════════════════════════════════

export const propertyLookups = pgTable('property_lookups', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),

  // Address & Geocoding
  address: text('address').notNull(),
  formattedAddress: text('formatted_address'),
  latitude: decimal('latitude', { precision: 10, scale: 7 }).notNull(),
  longitude: decimal('longitude', { precision: 10, scale: 7 }).notNull(),

  // Nearmap Data (cached)
  nearmapData: jsonb('nearmap_data').$type<{
    surveyDate: string;
    building: {
      footprintArea: number;
      count: number;
      polygons: any[];
    };
    roof: {
      material: string;
      condition: string;
      conditionScore: number;
      area: number;
      age?: number;
      issues?: string[];
    };
    pool: {
      present: boolean;
      type?: 'in-ground' | 'above-ground';
      fenced?: boolean;
    };
    solar: {
      present: boolean;
      panelCount?: number;
      area?: number;
    };
    vegetation: {
      treeCount: number;
      coveragePercent: number;
      proximityToStructure: 'none' | 'minor' | 'moderate' | 'significant';
    };
    hazards: {
      trampoline: boolean;
      debris: boolean;
      construction: boolean;
    };
    tileUrl: string;
    staticImageUrl?: string;
  }>(),

  // RPR Data (cached)
  rprData: jsonb('rpr_data').$type<{
    propertyId: string;
    beds: number;
    baths: number;
    sqft: number;
    stories: number;
    yearBuilt: number;
    roofType: string;
    foundation: string;
    exteriorWalls: string;
    hvac: string;
    lotSqft: number;
    lotAcres: number;
    ownerName: string;
    ownerOccupied: boolean;
    mailingAddress: string;
    assessedValue: number;
    estimatedValue: number;
    taxAmount: number;
    lastSaleDate: string;
    lastSalePrice: number;
    schools: {
      district: string;
      elementary: string;
      middle: string;
      high: string;
    };
    listing?: {
      active: boolean;
      price: number;
      daysOnMarket: number;
      agent: string;
    };
  }>(),

  // AI Analysis (cached)
  aiAnalysis: jsonb('ai_analysis').$type<{
    roofScore: number;
    roofIssues: string[];
    roofAgeEstimate: string;
    roofConditionSummary: string;
    hazardScan: {
      trampoline: { detected: boolean; confidence: number };
      unfencedPool: { detected: boolean; confidence: number };
      debris: { detected: boolean; confidence: number };
      treeOverhang: { detected: boolean; severity: 'none' | 'minor' | 'moderate' | 'significant' };
    };
    underwritingNotes: string;
    riskLevel: 'low' | 'medium' | 'high';
    recommendedAction: string;
  }>(),

  // Historical Surveys
  historicalSurveys: jsonb('historical_surveys').$type<Array<{
    date: string;
    imageUrl: string;
  }>>().default([]),

  // Historical Comparison
  historicalComparison: jsonb('historical_comparison').$type<{
    comparedDates: { current: string; previous: string };
    changesDetected: boolean;
    changes: Array<{
      type: string;
      severity: 'minor' | 'major';
      description: string;
    }>;
  }>(),

  // Oblique Views
  obliqueViews: jsonb('oblique_views').$type<{
    north: string;
    south: string;
    east: string;
    west: string;
  }>(),

  // MMI Data (Market Data - listing/deed history)
  mmiData: jsonb('mmi_data').$type<{
    propertyId: string;
    listingHistory: Array<{
      LISTING_DATE: string;
      LIST_PRICE: number;
      CLOSE_PRICE: number;
      STATUS: string;
      LISTING_AGENT: string;
      LISTING_BROKER: string;
      DAYS_ON_MARKET?: number;
    }>;
    deedHistory: Array<{
      DATE: string;
      LOAN_AMOUNT: number;
      LENDER: string;
      LOAN_OFFICER?: string;
      TRANSACTION_TYPE: string;
      BUYER_NAME?: string;
      SELLER_NAME?: string;
      SALE_PRICE?: number;
    }>;
    currentStatus: 'off_market' | 'active' | 'pending' | 'sold' | 'unknown';
    lastSaleDate?: string;
    lastSalePrice?: number;
    lastUpdated: string;
  }>(),

  // Lookup Metadata
  lookupSource: varchar('lookup_source', { length: 20 }).default('manual'), // 'manual', 'quote', 'policy'
  linkedQuoteId: uuid('linked_quote_id').references(() => quotes.id, { onDelete: 'set null' }),
  linkedPropertyId: uuid('linked_property_id').references(() => properties.id, { onDelete: 'set null' }),

  // Cache TTL
  expiresAt: timestamp('expires_at'),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('property_lookups_tenant_idx').on(table.tenantId),
  index('property_lookups_address_idx').on(table.tenantId, table.address),
  index('property_lookups_coords_idx').on(table.latitude, table.longitude),
]);

// ═══════════════════════════════════════════════════════════════════════════
// CALLS
// ═══════════════════════════════════════════════════════════════════════════

export const calls = pgTable('calls', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  
  // Participants
  customerId: uuid('customer_id').references(() => customers.id, { onDelete: 'set null' }),
  agentId: uuid('agent_id').references(() => users.id, { onDelete: 'set null' }),
  
  // Call Direction - THREE STAGE PATTERN
  // directionLive: Set at call creation from WebSocket - IMMUTABLE, never changed
  // direction: Legacy field for backward compatibility
  // directionFinal: Set by MSSQL transcript worker - SOURCE OF TRUTH
  directionLive: callDirectionEnum('direction_live'),
  direction: callDirectionEnum('direction').notNull(),
  directionFinal: callDirectionEnum('direction_final'),
  
  status: callStatusEnum('status').default('ringing'),
  
  // Phone Numbers
  fromNumber: varchar('from_number', { length: 20 }).notNull(),
  toNumber: varchar('to_number', { length: 20 }).notNull(),
  
  // External Reference
  externalCallId: varchar('external_call_id', { length: 100 }), // Twilio/3CX ID
  extension: varchar('extension', { length: 10 }), // Agent extension for call correlation

  // Transcription Status
  transcriptionStatus: varchar('transcription_status', { length: 20 }).$type<'pending' | 'starting' | 'active' | 'failed' | 'completed'>(),
  transcriptionError: text('transcription_error'), // Error message if transcription failed
  transcriptionSegmentCount: integer('transcription_segment_count').default(0), // Live segment count

  // Timing
  startedAt: timestamp('started_at').defaultNow(),
  answeredAt: timestamp('answered_at'),
  endedAt: timestamp('ended_at'),
  durationSeconds: integer('duration_seconds'),
  
  // Recording
  recordingUrl: text('recording_url'),
  recordingDurationSeconds: integer('recording_duration_seconds'),
  
  // Transcription
  transcription: text('transcription'),
  transcriptionSegments: jsonb('transcription_segments').$type<Array<{
    start: number;
    end: number;
    speaker: 'agent' | 'customer';
    text: string;
    confidence: number;
  }>>(),
  
  // AI Analysis
  aiSummary: text('ai_summary'),
  aiSentiment: jsonb('ai_sentiment').$type<{
    overall: 'positive' | 'neutral' | 'negative';
    score: number;
    timeline: Array<{ time: number; score: number }>;
  }>(),
  predictedReason: varchar('predicted_reason', { length: 100 }),
  detectedEntities: jsonb('detected_entities').$type<Array<{
    type: 'vin' | 'policy_number' | 'date' | 'address' | 'phone' | 'email' | 'money';
    value: string;
    confidence: number;
  }>>(),
  qualityScore: decimal('quality_score', { precision: 3, scale: 2 }),
  
  // Notes
  notes: text('notes'),
  
  // Wrap-up
  disposition: varchar('disposition', { length: 50 }),
  followUpRequired: boolean('follow_up_required').default(false),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('calls_tenant_idx').on(table.tenantId),
  index('calls_customer_idx').on(table.customerId),
  index('calls_agent_idx').on(table.agentId),
  index('calls_from_idx').on(table.tenantId, table.fromNumber),
  index('calls_started_idx').on(table.tenantId, table.startedAt),
  index('calls_extension_idx').on(table.tenantId, table.extension),
]);

// ═══════════════════════════════════════════════════════════════════════════
// LIVE TRANSCRIPT SEGMENTS - Real-time transcription from VM Bridge
// ═══════════════════════════════════════════════════════════════════════════

export const liveTranscriptSegments = pgTable('live_transcript_segments', {
  id: varchar('id', { length: 12 }).primaryKey(), // nanoid
  callId: uuid('call_id').notNull().references(() => calls.id, { onDelete: 'cascade' }),

  // Segment data
  speaker: varchar('speaker', { length: 20 }).notNull(), // 'agent', 'customer', 'system'
  text: text('text').notNull(),
  confidence: real('confidence').default(0.9),

  // Ordering
  sequenceNumber: integer('sequence_number').notNull(),
  timestamp: timestamp('timestamp').defaultNow().notNull(),

  // Status
  isFinal: boolean('is_final').default(true),

  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('live_segments_call_idx').on(table.callId),
  index('live_segments_seq_idx').on(table.callId, table.sequenceNumber),
]);

// ═══════════════════════════════════════════════════════════════════════════
// TRIAGE QUEUE
// ═══════════════════════════════════════════════════════════════════════════

export const triageItems = pgTable('triage_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  
  // Type & Status
  type: triageTypeEnum('type').notNull(),
  status: triageStatusEnum('status').default('pending'),
  priority: triagePriorityEnum('priority').default('medium'),
  
  // Related Entities
  customerId: uuid('customer_id').references(() => customers.id, { onDelete: 'set null' }),
  callId: uuid('call_id').references(() => calls.id, { onDelete: 'set null' }),
  quoteId: uuid('quote_id').references(() => quotes.id, { onDelete: 'set null' }),
  messageId: uuid('message_id').references(() => messages.id, { onDelete: 'set null' }),

  // Assignment
  assignedToId: uuid('assigned_to_id').references(() => users.id, { onDelete: 'set null' }),
  assignedAt: timestamp('assigned_at'),
  
  // Content
  title: text('title').notNull(),
  description: text('description'),
  aiSummary: text('ai_summary'),
  
  // AI Priority Scoring
  aiPriorityScore: decimal('ai_priority_score', { precision: 5, scale: 2 }),
  aiPriorityReason: text('ai_priority_reason'),
  
  // SLA
  dueAt: timestamp('due_at'),
  slaBreached: boolean('sla_breached').default(false),
  
  // Resolution
  resolvedAt: timestamp('resolved_at'),
  resolvedById: uuid('resolved_by_id').references(() => users.id, { onDelete: 'set null' }),
  resolution: text('resolution'),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('triage_tenant_idx').on(table.tenantId),
  index('triage_status_idx').on(table.tenantId, table.status),
  index('triage_assigned_idx').on(table.assignedToId),
  index('triage_priority_idx').on(table.tenantId, table.priority, table.status),
  index('triage_ai_score_idx').on(table.tenantId, table.aiPriorityScore, table.createdAt),
]);

// ═══════════════════════════════════════════════════════════════════════════
// REPORTED ISSUES (for debugging production problems)
// ═══════════════════════════════════════════════════════════════════════════

export const reportedIssues = pgTable('reported_issues', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),

  // What type of item had the issue
  itemType: varchar('item_type', { length: 50 }).notNull(), // 'wrapup', 'message', 'triage', etc.
  itemId: varchar('item_id', { length: 100 }).notNull(), // UUID or other ID of the item

  // Issue details
  issueType: varchar('issue_type', { length: 100 }), // 'match_failed', 'wrong_customer', 'missing_data', etc.
  description: text('description'), // User's description of the problem

  // Snapshot of the item data at time of report (for debugging)
  itemSnapshot: jsonb('item_snapshot').$type<Record<string, unknown>>(),

  // User corrections/edits
  userCorrections: jsonb('user_corrections').$type<Record<string, unknown>>(),

  // Error details if there was an error
  errorMessage: text('error_message'),
  errorStack: text('error_stack'),

  // Request context
  requestPayload: jsonb('request_payload').$type<Record<string, unknown>>(),
  responsePayload: jsonb('response_payload').$type<Record<string, unknown>>(),

  // Resolution
  isResolved: boolean('is_resolved').default(false),
  resolvedAt: timestamp('resolved_at'),
  resolvedById: uuid('resolved_by_id').references(() => users.id, { onDelete: 'set null' }),
  resolutionNotes: text('resolution_notes'),

  // Metadata
  reportedById: uuid('reported_by_id').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('reported_issues_tenant_idx').on(table.tenantId),
  index('reported_issues_item_idx').on(table.itemType, table.itemId),
  index('reported_issues_resolved_idx').on(table.isResolved),
]);

// ═══════════════════════════════════════════════════════════════════════════
// QUOTES
// ═══════════════════════════════════════════════════════════════════════════

export const quotes = pgTable('quotes', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  customerId: uuid('customer_id').references(() => customers.id),
  
  // Quote Type
  type: quoteTypeEnum('type').notNull(),
  status: quoteStatusEnum('status').default('draft'),
  
  // Agent
  createdById: uuid('created_by_id').references(() => users.id),
  
  // Contact Info (if no customer yet)
  contactInfo: jsonb('contact_info').$type<{
    firstName: string;
    lastName: string;
    email?: string;
    phone?: string;
    address?: {
      street: string;
      city: string;
      state: string;
      zip: string;
    };
  }>(),
  
  // Quote Data (varies by type)
  quoteData: jsonb('quote_data'),
  
  // Vehicles (for auto quotes)
  vehicles: jsonb('vehicles').$type<Array<{
    vin?: string;
    year: number;
    make: string;
    model: string;
    use: string;
    annualMiles: number;
  }>>(),
  
  // Drivers (for auto quotes)
  drivers: jsonb('drivers').$type<Array<{
    firstName: string;
    lastName: string;
    dob: string;
    licenseNumber?: string;
    licenseState?: string;
    violations?: Array<{ type: string; date: string }>;
  }>>(),
  
  // Property (for home quotes)
  property: jsonb('property').$type<{
    address: { street: string; city: string; state: string; zip: string };
    yearBuilt?: number;
    squareFeet?: number;
    constructionType?: string;
    roofType?: string;
    roofAge?: number;
  }>(),
  
  // Carrier Quotes
  carrierQuotes: jsonb('carrier_quotes').$type<Array<{
    carrier: string;
    premium: number;
    coverages: Array<{ type: string; limit: string; deductible?: string }>;
    quoteNumber?: string;
    expiresAt?: string;
  }>>().default([]),
  
  // Selected Quote
  selectedCarrier: varchar('selected_carrier', { length: 100 }),
  selectedPremium: decimal('selected_premium', { precision: 12, scale: 2 }),
  
  // Documents
  uploadedDocuments: jsonb('uploaded_documents').$type<Array<{
    name: string;
    url: string;
    type: string;
    uploadedAt: string;
    aiExtractedData?: any;
  }>>().default([]),
  
  // AI Assistance
  aiExtractedData: jsonb('ai_extracted_data'),
  aiSuggestions: jsonb('ai_suggestions').$type<string[]>().default([]),
  
  // Follow-up
  followUpDate: timestamp('follow_up_date'),
  notes: text('notes'),
  
  // Conversion
  convertedToPolicyId: uuid('converted_to_policy_id').references(() => policies.id),
  convertedAt: timestamp('converted_at'),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('quotes_tenant_idx').on(table.tenantId),
  index('quotes_customer_idx').on(table.customerId),
  index('quotes_status_idx').on(table.tenantId, table.status),
  index('quotes_type_idx').on(table.tenantId, table.type),
]);

// ═══════════════════════════════════════════════════════════════════════════
// MESSAGES (SMS/Email)
// ═══════════════════════════════════════════════════════════════════════════

export const messages = pgTable('messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  customerId: uuid('customer_id').references(() => customers.id),

  // Message Info
  type: messageTypeEnum('type').notNull(),
  direction: messageDirectionEnum('direction').notNull(),

  // Participants
  fromNumber: varchar('from_number', { length: 100 }),
  toNumber: varchar('to_number', { length: 100 }),
  fromEmail: text('from_email'),
  toEmail: text('to_email'),

  // Content
  body: text('body').notNull(),
  mediaUrls: jsonb('media_urls').$type<string[]>().default([]),

  // External Reference
  externalId: varchar('external_id', { length: 100 }), // Twilio SID

  // Status
  status: varchar('status', { length: 20 }).default('sent'),
  deliveredAt: timestamp('delivered_at'),
  readAt: timestamp('read_at'),

  // Agent
  sentById: uuid('sent_by_id').references(() => users.id),

  // AI
  aiGenerated: boolean('ai_generated').default(false),
  aiDraft: text('ai_draft'), // If agent modified AI suggestion

  // AgencyZoom Contact Info (from contact lookup)
  contactId: varchar('contact_id', { length: 100 }), // AgencyZoom customer/lead ID
  contactName: text('contact_name'),
  contactType: varchar('contact_type', { length: 20 }), // 'customer' or 'lead'

  // Acknowledgment Workflow (for incoming messages)
  isAcknowledged: boolean('is_acknowledged').default(false),
  acknowledgedById: uuid('acknowledged_by_id').references(() => users.id),
  acknowledgedAt: timestamp('acknowledged_at'),

  // Scheduling (for outgoing messages)
  scheduledAt: timestamp('scheduled_at'),
  scheduleStatus: varchar('schedule_status', { length: 20 }), // 'pending', 'sent', 'failed'

  // After-hours tracking
  isAfterHours: boolean('is_after_hours').default(false),
  afterHoursAutoReplySent: boolean('after_hours_auto_reply_sent').default(false),

  // AgencyZoom Sync
  syncedToAz: boolean('synced_to_az').default(false),
  azActivityId: varchar('az_activity_id', { length: 100 }),

  sentAt: timestamp('sent_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('messages_tenant_idx').on(table.tenantId),
  index('messages_customer_idx').on(table.customerId),
  index('messages_phone_idx').on(table.tenantId, table.fromNumber),
  index('messages_acknowledged_idx').on(table.tenantId, table.isAcknowledged),
  index('messages_scheduled_idx').on(table.tenantId, table.scheduledAt, table.scheduleStatus),
]);

// ═══════════════════════════════════════════════════════════════════════════
// ACTIVITIES / NOTES (Synced to AgencyZoom)
// ═══════════════════════════════════════════════════════════════════════════

export const activities = pgTable('activities', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  customerId: uuid('customer_id').notNull().references(() => customers.id, { onDelete: 'cascade' }),
  
  // Type
  type: varchar('type', { length: 50 }).notNull(), // call, note, email, task, quote, policy_change
  
  // Related Entities
  callId: uuid('call_id').references(() => calls.id),
  quoteId: uuid('quote_id').references(() => quotes.id),
  policyId: uuid('policy_id').references(() => policies.id),
  
  // Content
  title: text('title').notNull(),
  description: text('description'),
  
  // Agent
  createdById: uuid('created_by_id').references(() => users.id),
  
  // AI Generated
  aiGenerated: boolean('ai_generated').default(false),
  
  // AgencyZoom Sync
  syncedToAz: boolean('synced_to_az').default(false),
  azActivityId: varchar('az_activity_id', { length: 100 }),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('activities_tenant_idx').on(table.tenantId),
  index('activities_customer_idx').on(table.customerId),
  index('activities_type_idx').on(table.tenantId, table.type),
]);

// ═══════════════════════════════════════════════════════════════════════════
// TASKS
// ═══════════════════════════════════════════════════════════════════════════

export const tasks = pgTable('tasks', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  
  // Related
  customerId: uuid('customer_id').references(() => customers.id),
  
  // Task Info
  title: text('title').notNull(),
  description: text('description'),
  
  // Assignment
  assignedToId: uuid('assigned_to_id').references(() => users.id),
  createdById: uuid('created_by_id').references(() => users.id),
  
  // Status
  status: varchar('status', { length: 20 }).default('pending'),
  priority: triagePriorityEnum('priority').default('medium'),
  
  // Timing
  dueAt: timestamp('due_at'),
  completedAt: timestamp('completed_at'),
  
  // AgencyZoom Sync
  syncedToAz: boolean('synced_to_az').default(false),
  azTaskId: varchar('az_task_id', { length: 100 }),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('tasks_tenant_idx').on(table.tenantId),
  index('tasks_assigned_idx').on(table.assignedToId),
  index('tasks_status_idx').on(table.tenantId, table.status),
]);

// ═══════════════════════════════════════════════════════════════════════════
// TRAINING MODULES
// ═══════════════════════════════════════════════════════════════════════════

export const trainingModules = pgTable('training_modules', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }), // null = global
  
  // Module Info
  title: text('title').notNull(),
  description: text('description'),
  category: varchar('category', { length: 50 }).notNull(),
  
  // Content
  content: jsonb('content').$type<{
    type: 'video' | 'text' | 'quiz' | 'simulation';
    videoUrl?: string;
    textContent?: string;
    quizQuestions?: Array<{
      question: string;
      options: string[];
      correctIndex: number;
      explanation?: string;
    }>;
    simulationConfig?: any;
  }>(),
  
  // Requirements
  requiredSkillLevel: integer('required_skill_level').default(1),
  prerequisiteModuleIds: jsonb('prerequisite_module_ids').$type<string[]>().default([]),
  estimatedMinutes: integer('estimated_minutes'),
  
  // Skill Points
  skillPointsAwarded: integer('skill_points_awarded').default(10),
  
  isActive: boolean('is_active').default(true),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('training_modules_tenant_idx').on(table.tenantId),
  index('training_modules_category_idx').on(table.category),
]);

// ═══════════════════════════════════════════════════════════════════════════
// USER TRAINING PROGRESS
// ═══════════════════════════════════════════════════════════════════════════

export const userTrainingProgress = pgTable('user_training_progress', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  moduleId: uuid('module_id').notNull().references(() => trainingModules.id, { onDelete: 'cascade' }),
  
  // Progress
  status: varchar('status', { length: 20 }).default('not_started'), // not_started, in_progress, completed
  progressPercent: integer('progress_percent').default(0),
  
  // Quiz Results
  quizScore: decimal('quiz_score', { precision: 5, scale: 2 }),
  quizAttempts: integer('quiz_attempts').default(0),
  
  // Timing
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('training_progress_user_idx').on(table.userId),
  index('training_progress_module_idx').on(table.moduleId),
]);

// ═══════════════════════════════════════════════════════════════════════════
// KNOWLEDGE BASE
// ═══════════════════════════════════════════════════════════════════════════

export const knowledgeArticles = pgTable('knowledge_articles', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }), // null = global
  
  // Article Info
  title: text('title').notNull(),
  slug: varchar('slug', { length: 200 }).notNull(),
  category: varchar('category', { length: 50 }).notNull(),
  tags: jsonb('tags').$type<string[]>().default([]),
  
  // Content
  content: text('content').notNull(), // Markdown
  
  // Search
  searchVector: text('search_vector'), // For full-text search
  
  // Status
  isPublished: boolean('is_published').default(true),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('knowledge_tenant_idx').on(table.tenantId),
  index('knowledge_category_idx').on(table.category),
]);

// ═══════════════════════════════════════════════════════════════════════════
// SYNC LOG (For debugging integration issues)
// ═══════════════════════════════════════════════════════════════════════════

export const syncLogs = pgTable('sync_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  
  // Sync Info
  integration: varchar('integration', { length: 50 }).notNull(), // agencyzoom, hawksoft
  direction: varchar('direction', { length: 10 }).notNull(), // inbound, outbound
  entityType: varchar('entity_type', { length: 50 }).notNull(), // customer, policy, activity
  entityId: uuid('entity_id'),
  
  // Status
  status: varchar('status', { length: 20 }).notNull(), // success, failed, partial
  errorMessage: text('error_message'),
  
  // Data
  requestData: jsonb('request_data'),
  responseData: jsonb('response_data'),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('sync_logs_tenant_idx').on(table.tenantId),
  index('sync_logs_integration_idx').on(table.tenantId, table.integration),
  index('sync_logs_created_idx').on(table.tenantId, table.createdAt),
]);

// Customer Directory Sync Metadata
// Uses tenant_id + integration as unique key (no auto-increment ID) to avoid orphan rows
export const syncMetadata = pgTable('sync_metadata', {
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  integration: varchar('integration', { length: 50 }).notNull(), // agencyzoom, hawksoft
  
  // Sync timestamps
  lastIncrementalSyncAt: timestamp('last_incremental_sync_at'),
  lastFullSyncAt: timestamp('last_full_sync_at'),
  
  // Sync status
  lastSyncStatus: varchar('last_sync_status', { length: 20 }), // success, failed, partial
  lastSyncRecordsProcessed: integer('last_sync_records_processed'),
  lastSyncErrorMessage: text('last_sync_error_message'),
  
  // For HawkSoft: track the asOf timestamp for incremental sync
  incrementalSyncCursor: varchar('incremental_sync_cursor', { length: 100 }),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  // Composite primary key: one row per tenant + integration
  primaryKey({ columns: [table.tenantId, table.integration] }),
]);


// ═══════════════════════════════════════════════════════════════════════════
// CALL EVENTS (Append-only Event Log for Debugging)
// ═══════════════════════════════════════════════════════════════════════════

export const callEvents = pgTable('call_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  
  // Call linkage
  callId: uuid('call_id').references(() => calls.id, { onDelete: 'cascade' }),
  externalCallId: text('external_call_id'),
  
  // Event details
  eventType: text('event_type').notNull(),
  source: text('source').notNull(),
  
  // Event payload
  payload: jsonb('payload'),
  
  // Timing
  timestamp: timestamp('timestamp').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('call_events_call_idx').on(table.callId),
  index('call_events_external_idx').on(table.externalCallId),
  index('call_events_timestamp_idx').on(table.timestamp),
  index('call_events_type_idx').on(table.eventType),
]);

// ═══════════════════════════════════════════════════════════════════════════
// WRAPUP DRAFTS (AI Call Summaries - Heart of Triage)
// ═══════════════════════════════════════════════════════════════════════════

export const wrapupDrafts = pgTable('wrapup_drafts', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  
  // Call linkage
  callId: uuid('call_id').notNull().references(() => calls.id, { onDelete: 'cascade' }),
  
  // Direction (denormalized)
  direction: text('direction').notNull().default('Inbound'),
  
  // Agent info
  agentExtension: text('agent_extension'),
  agentName: text('agent_name'),
  
  // Status workflow
  status: wrapupStatusEnum('status').notNull().default('pending_ai_processing'),
  
  // Customer info (extracted)
  customerName: text('customer_name'),
  customerPhone: text('customer_phone'),
  customerEmail: text('customer_email'),
  policyNumbers: text('policy_numbers').array(),
  insuranceType: text('insurance_type'),
  requestType: text('request_type'),
  summary: text('summary'),
  
  // AI Processing
  aiCleanedSummary: text('ai_cleaned_summary'),
  aiProcessingStatus: text('ai_processing_status').default('pending'),
  aiProcessedAt: timestamp('ai_processed_at'),
  aiExtraction: jsonb('ai_extraction'),
  aiConfidence: decimal('ai_confidence', { precision: 3, scale: 2 }),
  
  // Customer matching
  matchStatus: text('match_status').default('unprocessed'),
  trestleData: jsonb('trestle_data'),
  aiRecommendation: jsonb('ai_recommendation'),
  
  // Reviewer decision
  reviewerDecision: text('reviewer_decision'),
  reviewerId: uuid('reviewer_id').references(() => users.id),
  reviewedAt: timestamp('reviewed_at'),
  
  // Outcome
  outcome: text('outcome'),
  agencyzoomNoteId: text('agencyzoom_note_id'),
  agencyzoomTicketId: text('agencyzoom_ticket_id'),
  noteAutoPosted: boolean('note_auto_posted').default(false),
  noteAutoPostedAt: timestamp('note_auto_posted_at'),
  
  // Phone update
  needsPhoneUpdate: boolean('needs_phone_update').default(false),
  phoneUpdateAcknowledgedAt: timestamp('phone_update_acknowledged_at'),
  phoneUpdateNote: text('phone_update_note'),

  // Auto-void tracking (hangups, short calls)
  isAutoVoided: boolean('is_auto_voided').default(false),
  autoVoidReason: text('auto_void_reason'), // 'short_call', 'hangup', etc.

  createdAt: timestamp('created_at').defaultNow().notNull(),
  completedAt: timestamp('completed_at'),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  uniqueIndex('wrapup_drafts_call_unique').on(table.callId),
  index('wrapup_drafts_status_idx').on(table.tenantId, table.status),
  index('wrapup_drafts_match_idx').on(table.tenantId, table.matchStatus),
  index('wrapup_drafts_created_idx').on(table.tenantId, table.createdAt),
]);

// ═══════════════════════════════════════════════════════════════════════════
// MATCH SUGGESTIONS (Customer Match Suggestions for Unmatched Calls)
// ═══════════════════════════════════════════════════════════════════════════

export const matchSuggestions = pgTable('match_suggestions', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  
  // Link to wrapup draft
  wrapupDraftId: uuid('wrapup_draft_id').notNull().references(() => wrapupDrafts.id, { onDelete: 'cascade' }),
  
  // Source and type
  source: text('source').notNull(),
  contactType: text('contact_type').notNull(),
  
  // Contact info
  contactId: text('contact_id'),
  contactName: text('contact_name'),
  contactPhone: text('contact_phone'),
  contactEmail: text('contact_email'),
  
  // Match quality
  confidence: decimal('confidence', { precision: 3, scale: 2 }),
  matchReason: text('match_reason'),
  
  // Recommendation
  recommendedAction: text('recommended_action'),
  
  // Selection
  isSelected: boolean('is_selected').default(false),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('match_suggestions_wrapup_idx').on(table.wrapupDraftId),
  index('match_suggestions_confidence_idx').on(table.wrapupDraftId, table.confidence),
]);

// ═══════════════════════════════════════════════════════════════════════════
// CALL NOTES LOG (Automatic Call Logging with AZ Note Posting)
// ═══════════════════════════════════════════════════════════════════════════

export const callNotesLog = pgTable('call_notes_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  
  // Call identification
  callId: uuid('call_id').references(() => calls.id, { onDelete: 'set null' }),
  externalCallId: text('external_call_id'),
  historyId: text('history_id'),
  
  callerPhone: text('caller_phone').notNull(),
  callerName: text('caller_name'),
  calledPhone: text('called_phone'),
  agentExtension: text('agent_extension'),
  agentName: text('agent_name'),
  direction: text('direction').notNull(),
  
  // Call timing
  callStartTime: timestamp('call_start_time'),
  callEndTime: timestamp('call_end_time'),
  duration: integer('duration'),
  
  // Customer matching
  matchStatus: text('match_status').notNull().default('pending'),
  matchConfidence: decimal('match_confidence', { precision: 3, scale: 2 }),
  matchMethod: text('match_method'),
  suggestedMatches: jsonb('suggested_matches'),
  
  // Customer info
  customerId: text('customer_id'),
  customerType: text('customer_type'),
  customerName: text('customer_name'),
  customerEmail: text('customer_email'),
  
  // Transcription and AI
  transcriptUrl: text('transcript_url'),
  recordingUrl: text('recording_url'),
  transcript: text('transcript'),
  aiSummary: text('ai_summary'),
  aiCallType: text('ai_call_type'),
  
  // AgencyZoom posting
  azNoteStatus: text('az_note_status').notNull().default('pending'),
  azNoteId: text('az_note_id'),
  azNoteError: text('az_note_error'),
  azNotePostedAt: timestamp('az_note_posted_at'),
  
  // Service request tracking
  azTicketId: text('az_ticket_id'),
  azTicketStatus: text('az_ticket_status'),
  azTicketStageName: text('az_ticket_stage_name'),
  azTicketStatusUpdatedAt: timestamp('az_ticket_status_updated_at'),
  azTicketUrl: text('az_ticket_url'),
  
  // Call classification
  isHangup: boolean('is_hangup').notNull().default(false),
  hangupCategory: text('hangup_category'),
  
  // Customer matching flags
  needsCustomerMatch: boolean('needs_customer_match').notNull().default(false),
  needsContactUpdate: boolean('needs_contact_update').notNull().default(false),
  extractedContactInfo: jsonb('extracted_contact_info'),
  
  // Source tracking
  source: text('source').notNull().default('zapier'),
  rawPayload: jsonb('raw_payload'),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('call_notes_log_caller_idx').on(table.callerPhone),
  index('call_notes_log_customer_idx').on(table.customerId),
  index('call_notes_log_created_idx').on(table.tenantId, table.createdAt),
  index('call_notes_log_match_idx').on(table.tenantId, table.matchStatus),
  index('call_notes_log_az_idx').on(table.tenantId, table.azNoteStatus),
]);

// ═══════════════════════════════════════════════════════════════════════════
// LEAD QUEUE (Round-Robin Lead Assignment)
// ═══════════════════════════════════════════════════════════════════════════

export const leadQueueEntries = pgTable('lead_queue_entries', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  
  // Source tracking
  source: text('source').notNull(),
  sourceReference: text('source_reference'),
  
  // Contact information
  contactName: text('contact_name'),
  contactPhone: text('contact_phone'),
  contactEmail: text('contact_email'),
  contactAddress: text('contact_address'),
  
  // Lead details
  insuranceType: text('insurance_type'),
  leadNotes: text('lead_notes'),
  rawPayload: jsonb('raw_payload'),
  
  // Queue status
  status: text('status').notNull().default('queued'),
  priority: text('priority').notNull().default('normal'),
  
  // Round-robin assignment (references users)
  assignedUserId: uuid('assigned_user_id').references(() => users.id, { onDelete: 'set null' }),
  notifiedAt: timestamp('notified_at'),
  expiresAt: timestamp('expires_at'),
  escalatedAt: timestamp('escalated_at'),
  
  // Claim tracking
  claimedBy: uuid('claimed_by').references(() => users.id, { onDelete: 'set null' }),
  claimedAt: timestamp('claimed_at'),
  
  // AgencyZoom integration
  agencyzoomLeadId: text('agencyzoom_lead_id'),
  agencyzoomSyncStatus: text('agencyzoom_sync_status'),
  agencyzoomSyncError: text('agencyzoom_sync_error'),
  agencyzoomSyncedAt: timestamp('agencyzoom_synced_at'),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('lead_queue_status_idx').on(table.tenantId, table.status),
  index('lead_queue_source_idx').on(table.tenantId, table.source),
  index('lead_queue_assigned_idx').on(table.assignedUserId),
  index('lead_queue_expires_idx').on(table.expiresAt),
  index('lead_queue_created_idx').on(table.tenantId, table.createdAt),
]);

export const leadRoundRobinState = pgTable('lead_round_robin_state', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  teamId: text('team_id').default('default'),
  lastUserId: uuid('last_user_id').references(() => users.id, { onDelete: 'set null' }),
  handoffCount: integer('handoff_count').notNull().default(0),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  uniqueIndex('lead_round_robin_tenant_team_idx').on(table.tenantId, table.teamId),
]);

export const leadClaimActivity = pgTable('lead_claim_activity', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  leadId: uuid('lead_id').notNull().references(() => leadQueueEntries.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  action: text('action').notNull(),
  metadata: jsonb('metadata'),
  timestamp: timestamp('timestamp').defaultNow().notNull(),
}, (table) => [
  index('lead_claim_activity_lead_idx').on(table.leadId),
  index('lead_claim_activity_user_idx').on(table.userId),
  index('lead_claim_activity_timestamp_idx').on(table.tenantId, table.timestamp),
]);

// ═══════════════════════════════════════════════════════════════════════════
// GENERATED ID CARDS
// ═══════════════════════════════════════════════════════════════════════════

export const generatedIdCards = pgTable('generated_id_cards', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),

  // Contact information (from AgencyZoom)
  contactId: text('contact_id').notNull(),
  contactType: text('contact_type').notNull(), // 'customer' or 'lead'
  contactName: text('contact_name').notNull(),

  // HawkSoft reference
  hawksoftClientNumber: text('hawksoft_client_number'),

  // Policy information
  policyNumber: text('policy_number').notNull(),
  carrier: text('carrier').notNull(),
  carrierNaic: text('carrier_naic'),
  effectiveDate: text('effective_date').notNull(),
  expirationDate: text('expiration_date').notNull(),

  // Vehicle count
  vehicleCount: integer('vehicle_count').notNull().default(1),

  // Vehicles included (JSON array)
  vehicles: jsonb('vehicles').$type<Array<{
    year: string;
    make: string;
    model: string;
    vin: string;
  }>>(),

  // PDF storage
  pdfBase64: text('pdf_base64'),

  // Delivery tracking
  deliveryMethod: text('delivery_method'), // 'download', 'email', 'sms'
  deliveredTo: text('delivered_to'), // email address or phone number
  deliveredAt: timestamp('delivered_at'),

  // Creator
  createdById: uuid('created_by_id').references(() => users.id),

  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('generated_id_cards_tenant_idx').on(table.tenantId),
  index('generated_id_cards_contact_idx').on(table.contactId),
  index('generated_id_cards_policy_idx').on(table.policyNumber),
  index('generated_id_cards_created_idx').on(table.tenantId, table.createdAt),
]);


// ═══════════════════════════════════════════════════════════════════════════
// RELATIONS
// ═══════════════════════════════════════════════════════════════════════════

export const tenantsRelations = relations(tenants, ({ many }) => ({
  users: many(users),
  customers: many(customers),
  policies: many(policies),
  calls: many(calls),
  quotes: many(quotes),
  triageItems: many(triageItems),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [users.tenantId],
    references: [tenants.id],
  }),
  mentor: one(users, {
    fields: [users.mentorId],
    references: [users.id],
  }),
  assignedCalls: many(calls),
  assignedTriageItems: many(triageItems),
  trainingProgress: many(userTrainingProgress),
}));

export const customersRelations = relations(customers, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [customers.tenantId],
    references: [tenants.id],
  }),
  producer: one(users, {
    fields: [customers.producerId],
    references: [users.id],
  }),
  csr: one(users, {
    fields: [customers.csrId],
    references: [users.id],
  }),
  policies: many(policies),
  calls: many(calls),
  quotes: many(quotes),
  activities: many(activities),
  messages: many(messages),
  properties: many(properties),
}));

export const policiesRelations = relations(policies, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [policies.tenantId],
    references: [tenants.id],
  }),
  customer: one(customers, {
    fields: [policies.customerId],
    references: [customers.id],
  }),
  vehicles: many(vehicles),
  drivers: many(drivers),
}));

export const callsRelations = relations(calls, ({ one }) => ({
  tenant: one(tenants, {
    fields: [calls.tenantId],
    references: [tenants.id],
  }),
  customer: one(customers, {
    fields: [calls.customerId],
    references: [customers.id],
  }),
  agent: one(users, {
    fields: [calls.agentId],
    references: [users.id],
  }),
}));

export const quotesRelations = relations(quotes, ({ one }) => ({
  tenant: one(tenants, {
    fields: [quotes.tenantId],
    references: [tenants.id],
  }),
  customer: one(customers, {
    fields: [quotes.customerId],
    references: [customers.id],
  }),
  createdBy: one(users, {
    fields: [quotes.createdById],
    references: [users.id],
  }),
}));

export const triageItemsRelations = relations(triageItems, ({ one }) => ({
  tenant: one(tenants, {
    fields: [triageItems.tenantId],
    references: [tenants.id],
  }),
  customer: one(customers, {
    fields: [triageItems.customerId],
    references: [customers.id],
  }),
  call: one(calls, {
    fields: [triageItems.callId],
    references: [calls.id],
  }),
  quote: one(quotes, {
    fields: [triageItems.quoteId],
    references: [quotes.id],
  }),
  message: one(messages, {
    fields: [triageItems.messageId],
    references: [messages.id],
  }),
  assignedTo: one(users, {
    fields: [triageItems.assignedToId],
    references: [users.id],
  }),
}));

// ═══════════════════════════════════════════════════════════════════════════
// RISK MONITOR - Property Listing/Sale Detection
// ═══════════════════════════════════════════════════════════════════════════

export const propertyStatusEnum = pgEnum('property_status', [
  'off_market',
  'active',
  'pending',
  'sold',
  'unknown',
]);

export const riskAlertTypeEnum = pgEnum('risk_alert_type', [
  'listing_detected',
  'pending_sale',
  'sold',
  'price_change',
  'status_change',
]);

export const riskAlertStatusEnum = pgEnum('risk_alert_status', [
  'new',
  'acknowledged',
  'in_progress',
  'resolved',
  'dismissed',
]);

export const riskAlertPriorityEnum = pgEnum('risk_alert_priority', [
  '1', // Low
  '2',
  '3', // Medium
  '4',
  '5', // Critical
]);

// Monitored policies for property risk detection
export const riskMonitorPolicies = pgTable('risk_monitor_policies', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),

  // AgencyZoom references
  azContactId: varchar('az_contact_id', { length: 100 }),
  azPolicyId: varchar('az_policy_id', { length: 100 }),

  // Customer info
  contactName: text('contact_name').notNull(),
  contactEmail: text('contact_email'),
  contactPhone: varchar('contact_phone', { length: 20 }),

  // Property address
  addressLine1: text('address_line1').notNull(),
  addressLine2: text('address_line2'),
  city: varchar('city', { length: 100 }).notNull(),
  state: varchar('state', { length: 2 }).notNull(),
  zipCode: varchar('zip_code', { length: 10 }).notNull(),

  // Policy info
  policyNumber: varchar('policy_number', { length: 50 }),
  carrier: varchar('carrier', { length: 100 }),
  policyType: varchar('policy_type', { length: 50 }), // homeowners, dwelling fire, etc.
  effectiveDate: timestamp('effective_date'),
  expirationDate: timestamp('expiration_date'),

  // Customer relationship info (for alert filtering)
  customerSinceDate: timestamp('customer_since_date'), // When customer became a client

  // Current property status
  currentStatus: propertyStatusEnum('current_status').default('off_market').notNull(),
  previousStatus: propertyStatusEnum('previous_status'),
  lastStatusChange: timestamp('last_status_change'),

  // Listing details (when active/pending)
  listingPrice: integer('listing_price'),
  listingDate: timestamp('listing_date'),
  listingAgent: text('listing_agent'),
  daysOnMarket: integer('days_on_market'),
  mlsNumber: varchar('mls_number', { length: 50 }),

  // Sale details (when sold)
  lastSalePrice: integer('last_sale_price'),
  lastSaleDate: timestamp('last_sale_date'),

  // RPR/MMI data
  rprPropertyId: varchar('rpr_property_id', { length: 100 }),
  mmiPropertyId: varchar('mmi_property_id', { length: 100 }),
  ownerName: text('owner_name'),
  ownerOccupied: boolean('owner_occupied'),
  estimatedValue: integer('estimated_value'),

  // Monitoring status
  isActive: boolean('is_active').default(true).notNull(),
  lastCheckedAt: timestamp('last_checked_at'),
  lastCheckSource: varchar('last_check_source', { length: 20 }), // 'rpr', 'mmi', 'both'
  checkErrorCount: integer('check_error_count').default(0),
  lastCheckError: text('last_check_error'),

  // Metadata
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  tenantIdx: index('risk_policies_tenant_idx').on(table.tenantId),
  statusIdx: index('risk_policies_status_idx').on(table.currentStatus),
  lastCheckedIdx: index('risk_policies_last_checked_idx').on(table.lastCheckedAt),
  addressIdx: index('risk_policies_address_idx').on(table.addressLine1, table.city, table.state),
}));

// Alerts generated when property status changes
export const riskMonitorAlerts = pgTable('risk_monitor_alerts', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  policyId: uuid('policy_id').notNull().references(() => riskMonitorPolicies.id),

  // Alert details
  alertType: riskAlertTypeEnum('alert_type').notNull(),
  priority: riskAlertPriorityEnum('priority').default('3').notNull(),
  status: riskAlertStatusEnum('status').default('new').notNull(),

  // Content
  title: text('title').notNull(),
  description: text('description'),

  // Status change that triggered the alert
  previousStatus: propertyStatusEnum('previous_status'),
  newStatus: propertyStatusEnum('new_status').notNull(),

  // Additional data at time of alert
  listingPrice: integer('listing_price'),
  salePrice: integer('sale_price'),
  dataSource: varchar('data_source', { length: 20 }), // 'rpr', 'mmi'
  rawData: jsonb('raw_data'), // Full response data for debugging

  // Assignment
  assignedToUserId: uuid('assigned_to_user_id').references(() => users.id),
  assignedAt: timestamp('assigned_at'),

  // Resolution
  acknowledgedAt: timestamp('acknowledged_at'),
  acknowledgedByUserId: uuid('acknowledged_by_user_id').references(() => users.id),
  resolvedAt: timestamp('resolved_at'),
  resolvedByUserId: uuid('resolved_by_user_id').references(() => users.id),
  resolution: text('resolution'), // Notes on how it was resolved
  resolutionType: varchar('resolution_type', { length: 50 }), // 'customer_moving', 'false_positive', 'policy_updated', etc.

  // Email notification tracking
  emailSentAt: timestamp('email_sent_at'),
  emailRecipients: jsonb('email_recipients'),

  // Metadata
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  tenantIdx: index('risk_alerts_tenant_idx').on(table.tenantId),
  policyIdx: index('risk_alerts_policy_idx').on(table.policyId),
  statusIdx: index('risk_alerts_status_idx').on(table.status),
  priorityIdx: index('risk_alerts_priority_idx').on(table.priority),
  createdAtIdx: index('risk_alerts_created_at_idx').on(table.createdAt),
}));

// Global settings for the risk monitor scheduler
export const riskMonitorSettings = pgTable('risk_monitor_settings', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id).unique(),

  // Scheduler controls
  isPaused: boolean('is_paused').default(false).notNull(),
  pausedAt: timestamp('paused_at'),
  pausedByUserId: uuid('paused_by_user_id').references(() => users.id),
  pauseReason: text('pause_reason'),

  // Schedule window (CST)
  scheduleStartHour: integer('schedule_start_hour').default(21).notNull(), // 9pm
  scheduleEndHour: integer('schedule_end_hour').default(4).notNull(), // 4am
  checkIntervalMinutes: integer('check_interval_minutes').default(15).notNull(),

  // Rate limiting
  dailyRequestBudget: integer('daily_request_budget').default(100).notNull(),
  requestsToday: integer('requests_today').default(0).notNull(),
  lastBudgetResetAt: timestamp('last_budget_reset_at'),

  // Check cycle
  recheckDays: integer('recheck_days').default(3).notNull(), // Re-check each property every N days
  delayBetweenCallsMs: integer('delay_between_calls_ms').default(5000).notNull(), // Rate limiting between API calls

  // Scheduler state
  lastSchedulerRunAt: timestamp('last_scheduler_run_at'),
  lastSchedulerCompletedAt: timestamp('last_scheduler_completed_at'),
  lastSchedulerError: text('last_scheduler_error'),
  schedulerRunCount: integer('scheduler_run_count').default(0).notNull(),

  // Email notifications
  emailNotificationsEnabled: boolean('email_notifications_enabled').default(true).notNull(),
  emailRecipients: jsonb('email_recipients'), // Array of email addresses

  // API credentials status
  rprCredentialsValid: boolean('rpr_credentials_valid').default(false),
  mmiCredentialsValid: boolean('mmi_credentials_valid').default(false),
  lastCredentialsCheckAt: timestamp('last_credentials_check_at'),

  // Metadata
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Activity log for scheduler runs
export const riskMonitorActivityLog = pgTable('risk_monitor_activity_log', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),

  // Run info
  runId: uuid('run_id').notNull(), // Groups events from same run
  runType: varchar('run_type', { length: 20 }).notNull(), // 'scheduled', 'manual', 'test'

  // Timing
  startedAt: timestamp('started_at').notNull(),
  completedAt: timestamp('completed_at'),
  durationMs: integer('duration_ms'),

  // Results
  policiesChecked: integer('policies_checked').default(0).notNull(),
  alertsCreated: integer('alerts_created').default(0).notNull(),
  errorsEncountered: integer('errors_encountered').default(0).notNull(),

  // API usage
  rprCallsMade: integer('rpr_calls_made').default(0).notNull(),
  mmiCallsMade: integer('mmi_calls_made').default(0).notNull(),

  // Status
  status: varchar('status', { length: 20 }).notNull(), // 'running', 'completed', 'failed', 'cancelled'
  errorMessage: text('error_message'),

  // Summary
  summary: jsonb('summary'), // Detailed breakdown of what was checked/found

  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  tenantIdx: index('risk_activity_log_tenant_idx').on(table.tenantId),
  runIdIdx: index('risk_activity_log_run_id_idx').on(table.runId),
  startedAtIdx: index('risk_activity_log_started_at_idx').on(table.startedAt),
}));

// Detailed event log for each API call and status change
export const riskMonitorActivityEvents = pgTable('risk_monitor_activity_events', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  runId: uuid('run_id'), // Links to activity log run
  policyId: uuid('policy_id').references(() => riskMonitorPolicies.id),

  // Event type
  eventType: varchar('event_type', { length: 50 }).notNull(),
  // Types: 'api_call_rpr', 'api_call_mmi', 'status_change', 'alert_created', 'error', 'email_sent'

  // Event details
  description: text('description'),

  // For API calls
  apiSource: varchar('api_source', { length: 20 }), // 'rpr', 'mmi'
  apiEndpoint: text('api_endpoint'),
  apiResponseTimeMs: integer('api_response_time_ms'),
  apiStatusCode: integer('api_status_code'),
  apiSuccess: boolean('api_success'),

  // For status changes
  previousStatus: propertyStatusEnum('previous_status'),
  newStatus: propertyStatusEnum('new_status'),

  // Raw data
  requestData: jsonb('request_data'),
  responseData: jsonb('response_data'),
  errorDetails: jsonb('error_details'),

  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  tenantIdx: index('risk_events_tenant_idx').on(table.tenantId),
  runIdIdx: index('risk_events_run_id_idx').on(table.runId),
  policyIdIdx: index('risk_events_policy_id_idx').on(table.policyId),
  eventTypeIdx: index('risk_events_type_idx').on(table.eventType),
  createdAtIdx: index('risk_events_created_at_idx').on(table.createdAt),
}));

// ═══════════════════════════════════════════════════════════════════════════
// RISK MONITOR RELATIONS
// ═══════════════════════════════════════════════════════════════════════════

export const riskMonitorPoliciesRelations = relations(riskMonitorPolicies, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [riskMonitorPolicies.tenantId],
    references: [tenants.id],
  }),
  alerts: many(riskMonitorAlerts),
  events: many(riskMonitorActivityEvents),
}));

export const riskMonitorAlertsRelations = relations(riskMonitorAlerts, ({ one }) => ({
  tenant: one(tenants, {
    fields: [riskMonitorAlerts.tenantId],
    references: [tenants.id],
  }),
  policy: one(riskMonitorPolicies, {
    fields: [riskMonitorAlerts.policyId],
    references: [riskMonitorPolicies.id],
  }),
  assignedTo: one(users, {
    fields: [riskMonitorAlerts.assignedToUserId],
    references: [users.id],
  }),
  acknowledgedBy: one(users, {
    fields: [riskMonitorAlerts.acknowledgedByUserId],
    references: [users.id],
  }),
  resolvedBy: one(users, {
    fields: [riskMonitorAlerts.resolvedByUserId],
    references: [users.id],
  }),
}));

export const riskMonitorSettingsRelations = relations(riskMonitorSettings, ({ one }) => ({
  tenant: one(tenants, {
    fields: [riskMonitorSettings.tenantId],
    references: [tenants.id],
  }),
  pausedBy: one(users, {
    fields: [riskMonitorSettings.pausedByUserId],
    references: [users.id],
  }),
}));

export const riskMonitorActivityLogRelations = relations(riskMonitorActivityLog, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [riskMonitorActivityLog.tenantId],
    references: [tenants.id],
  }),
  events: many(riskMonitorActivityEvents),
}));

export const riskMonitorActivityEventsRelations = relations(riskMonitorActivityEvents, ({ one }) => ({
  tenant: one(tenants, {
    fields: [riskMonitorActivityEvents.tenantId],
    references: [tenants.id],
  }),
  policy: one(riskMonitorPolicies, {
    fields: [riskMonitorActivityEvents.policyId],
    references: [riskMonitorPolicies.id],
  }),
}));

// ═══════════════════════════════════════════════════════════════════════════
// PAYMENT ADVANCES - Agency payment advances for customer premiums
// ═══════════════════════════════════════════════════════════════════════════

export const paymentAdvanceStatusEnum = pgEnum('payment_advance_status', [
  'pending',
  'processed',
  'failed',
]);

export const paymentAdvanceTypeEnum = pgEnum('payment_advance_type', [
  'card',
  'checking',
]);

export const paymentAdvances = pgTable('payment_advances', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),

  // Customer info
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),

  // Policy
  policyNumber: text('policy_number').notNull(),

  // Payment amounts
  amount: real('amount').notNull(),
  processingFee: real('processing_fee').notNull(),
  convenienceFee: real('convenience_fee').default(0),
  convenienceFeeWaived: boolean('convenience_fee_waived').default(false),
  totalAmount: real('total_amount').notNull(),

  // Payment method
  paymentType: paymentAdvanceTypeEnum('payment_type').notNull(),
  paymentInfo: text('payment_info').notNull(), // Encrypted card/ACH details

  // Dates
  draftDate: text('draft_date').notNull(), // Date to charge customer
  submittedDate: text('submitted_date').notNull(), // Date form was submitted

  // Status
  status: paymentAdvanceStatusEnum('status').default('pending'),
  processedAt: timestamp('processed_at'),

  // Notes
  notes: text('notes'),
  reason: text('reason'), // 'Hardship', 'New policy issued/payment date match', 'Other'
  reasonDetails: text('reason_details'), // Details if reason is 'Other'

  // AgencyZoom linkage
  agencyzoomId: text('agencyzoom_id'),
  agencyzoomType: text('agencyzoom_type'), // 'customer' | 'lead'

  // Submitter
  submitterEmail: text('submitter_email'),
  submitterUserId: uuid('submitter_user_id').references(() => users.id),

  // Notifications
  reminderSent: boolean('reminder_sent').default(false),
  reminderSentAt: timestamp('reminder_sent_at'),
  emailSentAt: timestamp('email_sent_at'),

  // Metadata
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  tenantIdx: index('payment_advances_tenant_idx').on(table.tenantId),
  policyIdx: index('payment_advances_policy_idx').on(table.policyNumber),
  statusIdx: index('payment_advances_status_idx').on(table.status),
  draftDateIdx: index('payment_advances_draft_date_idx').on(table.draftDate),
  createdAtIdx: index('payment_advances_created_at_idx').on(table.createdAt),
}));

// ═══════════════════════════════════════════════════════════════════════════
// PAYMENT ADVANCES RELATIONS
// ═══════════════════════════════════════════════════════════════════════════

export const paymentAdvancesRelations = relations(paymentAdvances, ({ one }) => ({
  tenant: one(tenants, {
    fields: [paymentAdvances.tenantId],
    references: [tenants.id],
  }),
  submitter: one(users, {
    fields: [paymentAdvances.submitterUserId],
    references: [users.id],
  }),
}));

// ═══════════════════════════════════════════════════════════════════════════
// SAME DAY PAYMENTS - Client payment processing (admin-only history)
// No fees, no reminders - for same-day processing only
// ═══════════════════════════════════════════════════════════════════════════

export const sameDayPaymentStatusEnum = pgEnum('same_day_payment_status', [
  'pending',
  'processed',
  'failed',
]);

export const sameDayPayments = pgTable('same_day_payments', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),

  // Customer info
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),

  // Policy
  policyNumber: text('policy_number').notNull(),

  // Payment amount (no fees for same-day)
  amount: real('amount').notNull(),

  // Payment method
  paymentType: paymentAdvanceTypeEnum('payment_type').notNull(),
  paymentInfo: text('payment_info').notNull(), // Encrypted card/ACH details

  // Dates
  submittedDate: text('submitted_date').notNull(), // Date form was submitted

  // Status
  status: sameDayPaymentStatusEnum('status').default('pending'),
  processedAt: timestamp('processed_at'),

  // Notes
  notes: text('notes'),

  // AgencyZoom linkage
  agencyzoomId: text('agencyzoom_id'),
  agencyzoomType: text('agencyzoom_type'), // 'customer' | 'lead'

  // Submitter
  submitterEmail: text('submitter_email'),
  submitterUserId: uuid('submitter_user_id').references(() => users.id),

  // Metadata
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  tenantIdx: index('same_day_payments_tenant_idx').on(table.tenantId),
  policyIdx: index('same_day_payments_policy_idx').on(table.policyNumber),
  statusIdx: index('same_day_payments_status_idx').on(table.status),
  createdAtIdx: index('same_day_payments_created_at_idx').on(table.createdAt),
}));

export const sameDayPaymentsRelations = relations(sameDayPayments, ({ one }) => ({
  tenant: one(tenants, {
    fields: [sameDayPayments.tenantId],
    references: [tenants.id],
  }),
  submitter: one(users, {
    fields: [sameDayPayments.submitterUserId],
    references: [users.id],
  }),
}));

// ═══════════════════════════════════════════════════════════════════════════
// AGENT ASSIST TELEMETRY - Track AI suggestion usage and feedback
// ═══════════════════════════════════════════════════════════════════════════

export const agentAssistActionEnum = pgEnum('agent_assist_action', [
  'shown',
  'used',
  'dismissed',
  'expanded',
  'collapsed',
]);

export const agentAssistFeedbackEnum = pgEnum('agent_assist_feedback', [
  'helpful',
  'not_helpful',
  'too_basic',
  'incorrect',
]);

export const agentAssistTelemetry = pgTable('agent_assist_telemetry', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  userId: uuid('user_id').references(() => users.id),

  // Call context (if during a call)
  callId: uuid('call_id').references(() => calls.id),

  // What was shown
  suggestionType: varchar('suggestion_type', { length: 50 }).notNull(), // 'playbook', 'knowledge', 'compliance', 'upsell', 'next_action'
  suggestionId: varchar('suggestion_id', { length: 100 }),
  playbookId: varchar('playbook_id', { length: 100 }),
  content: text('content'),

  // User action
  action: agentAssistActionEnum('action').notNull(),

  // Feedback
  feedback: agentAssistFeedbackEnum('feedback'),
  feedbackNote: text('feedback_note'),

  // Context
  callTranscriptSnippet: text('call_transcript_snippet'), // Last 500 chars when suggestion was shown
  formSection: varchar('form_section', { length: 100 }), // For form-based assist

  // Metadata
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  tenantIdx: index('agent_assist_telemetry_tenant_idx').on(table.tenantId),
  userIdx: index('agent_assist_telemetry_user_idx').on(table.userId),
  callIdx: index('agent_assist_telemetry_call_idx').on(table.callId),
  typeIdx: index('agent_assist_telemetry_type_idx').on(table.suggestionType),
  playbookIdx: index('agent_assist_telemetry_playbook_idx').on(table.playbookId),
  createdAtIdx: index('agent_assist_telemetry_created_at_idx').on(table.createdAt),
}));

// ═══════════════════════════════════════════════════════════════════════════
// AGENT ASSIST TELEMETRY RELATIONS
// ═══════════════════════════════════════════════════════════════════════════

export const agentAssistTelemetryRelations = relations(agentAssistTelemetry, ({ one }) => ({
  tenant: one(tenants, {
    fields: [agentAssistTelemetry.tenantId],
    references: [tenants.id],
  }),
  user: one(users, {
    fields: [agentAssistTelemetry.userId],
    references: [users.id],
  }),
  call: one(calls, {
    fields: [agentAssistTelemetry.callId],
    references: [calls.id],
  }),
}));

// ═══════════════════════════════════════════════════════════════════════════
// QUOTE DOCUMENTS - Extracted quote data from carrier PDFs
// ═══════════════════════════════════════════════════════════════════════════

export const quoteDocumentStatusEnum = pgEnum('quote_document_status', [
  'uploaded',
  'extracting',
  'extracted',
  'posted',
  'error',
]);

export const quoteDocumentTypeEnum = pgEnum('quote_document_type', [
  'auto',
  'home',
  'renters',
  'umbrella',
  'recreational',
  'commercial_auto',
  'general_liability',
  'bop',
  'workers_comp',
  'other',
]);

export const quoteDocuments = pgTable('quote_documents', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  uploadedById: uuid('uploaded_by_id').references(() => users.id),

  // File info
  originalFileName: text('original_file_name').notNull(),
  fileSize: integer('file_size'),
  mimeType: text('mime_type').default('application/pdf'),
  storagePath: text('storage_path'), // Path to stored PDF

  // Source info
  source: text('source').default('upload'), // 'upload' | 'email'
  emailMessageId: text('email_message_id'), // If imported from email
  emailSubject: text('email_subject'),
  emailFrom: text('email_from'),

  // Extracted quote data
  carrierName: text('carrier_name'),
  quoteType: quoteDocumentTypeEnum('quote_type'),
  quotedPremium: real('quoted_premium'),
  termMonths: integer('term_months'),
  effectiveDate: timestamp('effective_date'),
  expirationDate: timestamp('expiration_date'),
  quoteNumber: text('quote_number'),

  // Customer info
  customerName: text('customer_name'),
  customerAddress: text('customer_address'),
  customerCity: text('customer_city'),
  customerState: text('customer_state'),
  customerZip: text('customer_zip'),
  customerPhone: text('customer_phone'),
  customerEmail: text('customer_email'),

  // Coverage details (JSON)
  coverageDetails: jsonb('coverage_details'), // { liability, collision, comprehensive, etc. }
  vehicleInfo: jsonb('vehicle_info'), // [{ year, make, model, vin }]
  propertyInfo: jsonb('property_info'), // { address, yearBuilt, squareFeet, roofType }
  driverInfo: jsonb('driver_info'), // [{ name, dob, licenseNumber }]

  // Processing status
  status: quoteDocumentStatusEnum('status').default('uploaded'),
  extractionError: text('extraction_error'),
  rawExtraction: jsonb('raw_extraction'), // Full AI response
  extractedAt: timestamp('extracted_at'),

  // AgencyZoom integration
  azLeadId: text('az_lead_id'),
  azCustomerId: text('az_customer_id'),
  azPostedAt: timestamp('az_posted_at'),
  azPipelineId: integer('az_pipeline_id'),
  azStageName: text('az_stage_name'),
  azNoteId: text('az_note_id'),

  // Metadata
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  tenantIdx: index('quote_documents_tenant_idx').on(table.tenantId),
  statusIdx: index('quote_documents_status_idx').on(table.status),
  carrierIdx: index('quote_documents_carrier_idx').on(table.carrierName),
  customerNameIdx: index('quote_documents_customer_name_idx').on(table.customerName),
  createdAtIdx: index('quote_documents_created_at_idx').on(table.createdAt),
}));

export const quoteDocumentsRelations = relations(quoteDocuments, ({ one }) => ({
  tenant: one(tenants, {
    fields: [quoteDocuments.tenantId],
    references: [tenants.id],
  }),
  uploadedBy: one(users, {
    fields: [quoteDocuments.uploadedById],
    references: [users.id],
  }),
}));

// ═══════════════════════════════════════════════════════════════════════════
// SEMANTIC SEARCH - EMBEDDINGS
// ═══════════════════════════════════════════════════════════════════════════

export const embeddingTypeEnum = pgEnum('embedding_type', [
  'customer',
  'policy',
  'call',
  'document',
  'note',
  'knowledge',
]);

/**
 * Vector Embeddings for Semantic Search
 *
 * Note: The actual vector column should be added via raw SQL migration:
 * ALTER TABLE embeddings ADD COLUMN embedding vector(1536);
 * CREATE INDEX embeddings_vector_idx ON embeddings USING ivfflat (embedding vector_cosine_ops);
 *
 * For now, we store embeddings as JSON array and use pgvector functions via raw queries.
 */
export const embeddings = pgTable('embeddings', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),

  // What this embedding represents
  type: embeddingTypeEnum('type').notNull(),
  sourceId: text('source_id').notNull(), // ID of the source record
  sourceTable: text('source_table').notNull(), // Table name

  // Content that was embedded
  content: text('content').notNull(),
  contentHash: text('content_hash').notNull(), // For deduplication

  // Metadata for filtering
  metadata: jsonb('metadata').$type<Record<string, any>>(),

  // Embedding storage (JSON array format, convert to vector for queries)
  // Use raw SQL with pgvector for actual similarity search
  embeddingJson: jsonb('embedding_json').$type<number[]>(),

  // Model info
  model: text('model').default('text-embedding-3-small'),
  dimensions: integer('dimensions').default(1536),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  tenantIdx: index('embeddings_tenant_idx').on(table.tenantId),
  typeIdx: index('embeddings_type_idx').on(table.type),
  sourceIdx: index('embeddings_source_idx').on(table.sourceId, table.sourceTable),
  contentHashIdx: uniqueIndex('embeddings_content_hash_idx').on(table.tenantId, table.contentHash),
}));

export const embeddingsRelations = relations(embeddings, ({ one }) => ({
  tenant: one(tenants, {
    fields: [embeddings.tenantId],
    references: [tenants.id],
  }),
}));

// ═══════════════════════════════════════════════════════════════════════════
// AI PREDICTIONS - For tracking and retraining
// ═══════════════════════════════════════════════════════════════════════════

export const aiPredictions = pgTable('ai_predictions', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),

  // What was predicted
  type: text('type').notNull(), // churn, cross_sell, intent, sentiment, etc.
  subjectType: text('subject_type').notNull(), // customer, call, policy
  subjectId: text('subject_id').notNull(),

  // The prediction
  prediction: jsonb('prediction').notNull(), // The full prediction object
  confidence: real('confidence'), // 0-1

  // Actual outcome (filled in later)
  actualOutcome: jsonb('actual_outcome'),
  wasAccurate: boolean('was_accurate'),

  // Context at time of prediction
  context: jsonb('context'),

  // Model info
  model: text('model'),
  tokensUsed: integer('tokens_used'),
  latencyMs: integer('latency_ms'),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  verifiedAt: timestamp('verified_at'),
}, (table) => ({
  tenantIdx: index('ai_predictions_tenant_idx').on(table.tenantId),
  typeIdx: index('ai_predictions_type_idx').on(table.type),
  subjectIdx: index('ai_predictions_subject_idx').on(table.subjectType, table.subjectId),
  createdAtIdx: index('ai_predictions_created_at_idx').on(table.createdAt),
}));

export const aiPredictionsRelations = relations(aiPredictions, ({ one }) => ({
  tenant: one(tenants, {
    fields: [aiPredictions.tenantId],
    references: [tenants.id],
  }),
}));

// ═══════════════════════════════════════════════════════════════════════════
// REVIEW REQUESTS - Track Google review solicitation SMS
// ═══════════════════════════════════════════════════════════════════════════

export const reviewRequestStatusEnum = pgEnum('review_request_status', [
  'pending_approval', // Waiting for manual approval (when auto-send is OFF)
  'pending',          // Approved and scheduled, waiting to be sent
  'sent',             // SMS successfully delivered
  'failed',           // SMS delivery failed
  'cancelled',        // Manually cancelled by agent
  'opted_out',        // Customer replied STOP
  'suppressed',       // Skipped - customer already has a review
]);

export const reviewRequests = pgTable('review_requests', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),

  // Link to originating call
  callSessionId: text('call_session_id'),
  callId: uuid('call_id').references(() => calls.id),

  // Customer info
  customerName: text('customer_name').notNull(),
  customerPhone: text('customer_phone').notNull(),
  customerId: text('customer_id'), // AgencyZoom ID

  // Sentiment from call analysis
  sentiment: varchar('sentiment', { length: 20 }), // positive, neutral, negative

  // Scheduling
  scheduledFor: timestamp('scheduled_for').notNull(),
  status: reviewRequestStatusEnum('status').default('pending').notNull(),
  sentAt: timestamp('sent_at'),

  // SMS delivery tracking
  twilioMessageId: text('twilio_message_id'),
  errorMessage: text('error_message'),

  // Suppression (skip if customer already reviewed)
  suppressed: boolean('suppressed').default(false),
  suppressionReason: varchar('suppression_reason', { length: 50 }), // existing_review, manual, opted_out
  googleReviewId: uuid('google_review_id'), // Link to existing review if suppressed

  // Metadata
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  processedBy: uuid('processed_by').references(() => users.id),
}, (table) => ({
  tenantIdx: index('review_requests_tenant_idx').on(table.tenantId),
  statusIdx: index('review_requests_status_idx').on(table.status),
  scheduledForIdx: index('review_requests_scheduled_for_idx').on(table.scheduledFor),
  customerPhoneIdx: index('review_requests_customer_phone_idx').on(table.customerPhone),
  customerIdIdx: index('review_requests_customer_id_idx').on(table.customerId),
}));

// ═══════════════════════════════════════════════════════════════════════════
// POLICY CHANGE REQUESTS - Track policy modification requests
// ═══════════════════════════════════════════════════════════════════════════

export const policyChangeRequests = pgTable('policy_change_requests', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),

  // Policy reference
  policyId: uuid('policy_id').references(() => policies.id, { onDelete: 'set null' }),
  policyNumber: varchar('policy_number', { length: 50 }).notNull(),

  // Customer reference
  customerId: uuid('customer_id').references(() => customers.id, { onDelete: 'set null' }),

  // Change details
  changeType: policyChangeTypeEnum('change_type').notNull(),
  status: policyChangeStatusEnum('status').default('pending').notNull(),
  effectiveDate: date('effective_date').notNull(),

  // Form data (varies by change type)
  formData: jsonb('form_data').$type<Record<string, any>>().notNull(),

  // Processing
  notes: text('notes'),
  agentNotes: text('agent_notes'),
  carrierResponse: text('carrier_response'),

  // Tracking
  submittedBy: uuid('submitted_by').references(() => users.id, { onDelete: 'set null' }),
  processedBy: uuid('processed_by').references(() => users.id, { onDelete: 'set null' }),
  processedAt: timestamp('processed_at'),

  // Metadata
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  tenantIdx: index('policy_change_requests_tenant_idx').on(table.tenantId),
  policyIdIdx: index('policy_change_requests_policy_id_idx').on(table.policyId),
  customerIdIdx: index('policy_change_requests_customer_id_idx').on(table.customerId),
  statusIdx: index('policy_change_requests_status_idx').on(table.status),
  changeTypeIdx: index('policy_change_requests_change_type_idx').on(table.changeType),
  createdAtIdx: index('policy_change_requests_created_at_idx').on(table.createdAt),
}));

// ═══════════════════════════════════════════════════════════════════════════
// GOOGLE REVIEWS - Imported reviews for matching to customers
// ═══════════════════════════════════════════════════════════════════════════

export const matchConfidenceEnum = pgEnum('match_confidence', [
  'exact',   // Phone number match
  'high',    // Exact name match
  'medium',  // Fuzzy name match
  'low',     // Partial match
  'manual',  // Manually matched by agent
]);

export const googleReviews = pgTable('google_reviews', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),

  // Google review data
  googleReviewId: text('google_review_id').unique(), // Google's unique ID
  reviewerName: text('reviewer_name').notNull(),
  reviewerNameNormalized: text('reviewer_name_normalized'), // Lowercase, no special chars
  reviewerProfileUrl: text('reviewer_profile_url'),
  rating: integer('rating').notNull(), // 1-5 stars
  comment: text('comment'), // Review text
  reviewTimestamp: timestamp('review_timestamp'), // When review was left

  // Customer matching
  matchedCustomerId: text('matched_customer_id'), // AgencyZoom customer ID
  matchedCustomerName: text('matched_customer_name'),
  matchedCustomerPhone: text('matched_customer_phone'),
  matchConfidence: matchConfidenceEnum('match_confidence'),
  matchedAt: timestamp('matched_at'),
  matchedBy: uuid('matched_by').references(() => users.id),

  // Import tracking
  importedAt: timestamp('imported_at').defaultNow().notNull(),
  importSource: varchar('import_source', { length: 20 }), // manual, api, csv
  rawPayload: jsonb('raw_payload'),

  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  tenantIdx: index('google_reviews_tenant_idx').on(table.tenantId),
  googleReviewIdIdx: index('google_reviews_google_id_idx').on(table.googleReviewId),
  reviewerNameNormalizedIdx: index('google_reviews_reviewer_name_idx').on(table.reviewerNameNormalized),
  matchedCustomerIdIdx: index('google_reviews_matched_customer_idx').on(table.matchedCustomerId),
  ratingIdx: index('google_reviews_rating_idx').on(table.rating),
  reviewTimestampIdx: index('google_reviews_timestamp_idx').on(table.reviewTimestamp),
}));

// ═══════════════════════════════════════════════════════════════════════════
// REVIEW REQUESTS RELATIONS
// ═══════════════════════════════════════════════════════════════════════════

export const reviewRequestsRelations = relations(reviewRequests, ({ one }) => ({
  tenant: one(tenants, {
    fields: [reviewRequests.tenantId],
    references: [tenants.id],
  }),
  call: one(calls, {
    fields: [reviewRequests.callId],
    references: [calls.id],
  }),
  processedByUser: one(users, {
    fields: [reviewRequests.processedBy],
    references: [users.id],
  }),
}));

export const googleReviewsRelations = relations(googleReviews, ({ one }) => ({
  tenant: one(tenants, {
    fields: [googleReviews.tenantId],
    references: [tenants.id],
  }),
  matchedByUser: one(users, {
    fields: [googleReviews.matchedBy],
    references: [users.id],
  }),
}));

// ═══════════════════════════════════════════════════════════════════════════
// SMS TEMPLATES
// ═══════════════════════════════════════════════════════════════════════════

export const smsTemplates = pgTable('sms_templates', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),

  name: varchar('name', { length: 100 }).notNull(),
  category: varchar('category', { length: 50 }), // billing, quotes, claims, service, marketing
  content: text('content').notNull(),

  // Variable placeholders: {{customerName}}, {{agentName}}, {{policyNumber}}, etc.
  variables: jsonb('variables').$type<string[]>(), // List of variable names used

  isActive: boolean('is_active').default(true),
  usageCount: integer('usage_count').default(0),

  createdBy: uuid('created_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  tenantIdx: index('sms_templates_tenant_idx').on(table.tenantId),
  categoryIdx: index('sms_templates_category_idx').on(table.category),
}));

// ═══════════════════════════════════════════════════════════════════════════
// WEBHOOKS
// ═══════════════════════════════════════════════════════════════════════════

export const webhookEventEnum = pgEnum('webhook_event', [
  'call.started',
  'call.ended',
  'call.missed',
  'message.received',
  'message.sent',
  'lead.created',
  'lead.updated',
  'quote.created',
  'quote.updated',
  'customer.created',
  'customer.updated',
]);

export const webhooks = pgTable('webhooks', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),

  name: varchar('name', { length: 100 }).notNull(),
  url: text('url').notNull(),
  secret: varchar('secret', { length: 64 }), // For HMAC signature verification

  events: jsonb('events').$type<string[]>().notNull(), // Events to trigger on
  headers: jsonb('headers').$type<Record<string, string>>(), // Custom headers

  isActive: boolean('is_active').default(true),

  // Stats
  lastTriggeredAt: timestamp('last_triggered_at'),
  successCount: integer('success_count').default(0),
  failureCount: integer('failure_count').default(0),
  lastError: text('last_error'),

  createdBy: uuid('created_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  tenantIdx: index('webhooks_tenant_idx').on(table.tenantId),
  activeIdx: index('webhooks_active_idx').on(table.isActive),
}));

// ═══════════════════════════════════════════════════════════════════════════
// API KEYS
// ═══════════════════════════════════════════════════════════════════════════

export const apiKeys = pgTable('api_keys', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),

  name: varchar('name', { length: 100 }).notNull(),
  keyPrefix: varchar('key_prefix', { length: 8 }).notNull(), // First 8 chars for identification
  keyHash: varchar('key_hash', { length: 64 }).notNull(), // SHA-256 hash of full key

  // Permissions
  permissions: jsonb('permissions').$type<string[]>(), // read, write, admin
  allowedIps: jsonb('allowed_ips').$type<string[]>(), // IP whitelist
  rateLimit: integer('rate_limit').default(1000), // Requests per hour

  isActive: boolean('is_active').default(true),
  expiresAt: timestamp('expires_at'),

  // Usage tracking
  lastUsedAt: timestamp('last_used_at'),
  usageCount: integer('usage_count').default(0),

  createdBy: uuid('created_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  revokedAt: timestamp('revoked_at'),
}, (table) => ({
  tenantIdx: index('api_keys_tenant_idx').on(table.tenantId),
  keyPrefixIdx: index('api_keys_prefix_idx').on(table.keyPrefix),
  activeIdx: index('api_keys_active_idx').on(table.isActive),
}));

// ═══════════════════════════════════════════════════════════════════════════
// AI TOKEN USAGE TRACKING
// ═══════════════════════════════════════════════════════════════════════════

export const aiProviderEnum = pgEnum('ai_provider', ['openai', 'anthropic', 'google']);

export const aiTokenUsage = pgTable('ai_token_usage', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),

  // Provider & Model
  provider: aiProviderEnum('provider').notNull(),
  model: varchar('model', { length: 100 }).notNull(),

  // Token counts
  promptTokens: integer('prompt_tokens').notNull().default(0),
  completionTokens: integer('completion_tokens').notNull().default(0),
  totalTokens: integer('total_tokens').notNull().default(0),

  // Cost tracking (in cents to avoid floating point)
  estimatedCostCents: integer('estimated_cost_cents').default(0),

  // Request metadata
  endpoint: varchar('endpoint', { length: 200 }), // Which API route used this
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  requestDurationMs: integer('request_duration_ms'),
  success: boolean('success').default(true),
  errorMessage: text('error_message'),

  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  tenantIdx: index('ai_token_usage_tenant_idx').on(table.tenantId),
  providerIdx: index('ai_token_usage_provider_idx').on(table.tenantId, table.provider),
  createdAtIdx: index('ai_token_usage_created_idx').on(table.tenantId, table.createdAt),
  modelIdx: index('ai_token_usage_model_idx').on(table.tenantId, table.model),
}));

// Daily aggregation for faster dashboard queries
export const aiTokenUsageDaily = pgTable('ai_token_usage_daily', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),

  // Aggregation key
  date: date('date').notNull(),
  provider: aiProviderEnum('provider').notNull(),
  model: varchar('model', { length: 100 }).notNull(),

  // Aggregated totals
  requestCount: integer('request_count').notNull().default(0),
  promptTokens: integer('prompt_tokens').notNull().default(0),
  completionTokens: integer('completion_tokens').notNull().default(0),
  totalTokens: integer('total_tokens').notNull().default(0),
  estimatedCostCents: integer('estimated_cost_cents').default(0),
  errorCount: integer('error_count').default(0),
  avgDurationMs: integer('avg_duration_ms'),

  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  tenantDateIdx: uniqueIndex('ai_token_daily_tenant_date_idx').on(table.tenantId, table.date, table.provider, table.model),
}));

// ═══════════════════════════════════════════════════════════════════════════
// API RETRY QUEUE (Failed External API Calls)
// ═══════════════════════════════════════════════════════════════════════════
// Stores failed API calls for retry (AgencyZoom, Trestle, etc.)

export const apiRetryQueueStatusEnum = pgEnum('api_retry_queue_status', [
  'pending',      // Waiting to be retried
  'processing',   // Currently being retried
  'completed',    // Successfully completed
  'failed',       // Permanently failed (max retries exceeded)
  'cancelled',    // Manually cancelled
]);

export const apiRetryQueue = pgTable('api_retry_queue', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),

  // Operation details
  operationType: text('operation_type').notNull(), // 'agencyzoom_note', 'agencyzoom_ticket', 'agencyzoom_lead', 'trestle_lookup'
  targetService: text('target_service').notNull(), // 'agencyzoom', 'trestle', etc.

  // Request data (stored as JSON for replay)
  requestPayload: jsonb('request_payload').notNull(),

  // Context for the operation
  wrapupDraftId: uuid('wrapup_draft_id').references(() => wrapupDrafts.id, { onDelete: 'set null' }),
  callId: uuid('call_id').references(() => calls.id, { onDelete: 'set null' }),
  customerId: text('customer_id'), // AgencyZoom customer ID (not our internal ID)

  // Status tracking
  status: apiRetryQueueStatusEnum('status').notNull().default('pending'),

  // Retry tracking
  attemptCount: integer('attempt_count').notNull().default(0),
  maxAttempts: integer('max_attempts').notNull().default(3),
  lastAttemptAt: timestamp('last_attempt_at'),
  nextAttemptAt: timestamp('next_attempt_at'),

  // Error tracking
  lastError: text('last_error'),
  errorHistory: jsonb('error_history').$type<Array<{ timestamp: string; error: string; attempt: number }>>(),

  // Result on success
  resultData: jsonb('result_data'),

  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  completedAt: timestamp('completed_at'),
}, (table) => [
  index('api_retry_queue_status_idx').on(table.tenantId, table.status),
  index('api_retry_queue_next_attempt_idx').on(table.status, table.nextAttemptAt),
  index('api_retry_queue_service_idx').on(table.tenantId, table.targetService),
  index('api_retry_queue_wrapup_idx').on(table.wrapupDraftId),
]);

// ═══════════════════════════════════════════════════════════════════════════
// LIFE INSURANCE QUOTES (Back9 Integration)
// ═══════════════════════════════════════════════════════════════════════════

export const lifeQuoteStatusEnum = pgEnum('life_quote_status', [
  'quoted',
  'emailed',
  'application_started',
  'application_submitted',
  'policy_issued',
  'declined',
  'expired',
]);

export const lifeQuotes = pgTable('life_quotes', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  customerId: uuid('customer_id').notNull().references(() => customers.id, { onDelete: 'cascade' }),
  agentId: uuid('agent_id').notNull().references(() => users.id, { onDelete: 'cascade' }),

  // Quote request data
  requestParams: jsonb('request_params').notNull().$type<{
    firstName: string;
    lastName: string;
    dateOfBirth: string;
    gender: string;
    state: string;
    healthClass: string;
    tobaccoUse: string;
    coverageAmount: number;
    termLength: number;
    policyType: string;
  }>(),

  // Best quote from results
  bestQuote: jsonb('best_quote').notNull().$type<{
    id: string;
    carrier: {
      id: string;
      name: string;
      logoUrl?: string;
      amBestRating: string;
      amBestRatingNumeric: number;
    };
    productName: string;
    monthlyPremium: number;
    annualPremium: number;
    deathBenefit: number;
    termLength: number;
    policyType: string;
    features: string[];
    illustrationUrl?: string;
    applicationUrl?: string;
  }>(),

  // All quotes returned
  allQuotes: jsonb('all_quotes').notNull().$type<Array<{
    id: string;
    carrier: {
      id: string;
      name: string;
      logoUrl?: string;
      amBestRating: string;
      amBestRatingNumeric: number;
    };
    productName: string;
    monthlyPremium: number;
    annualPremium: number;
    deathBenefit: number;
    termLength: number;
    policyType: string;
    features: string[];
    illustrationUrl?: string;
    applicationUrl?: string;
  }>>(),

  // Status
  status: lifeQuoteStatusEnum('status').notNull().default('quoted'),

  // Metadata
  emailedToCustomer: boolean('emailed_to_customer').default(false),
  applicationStarted: boolean('application_started').default(false),
  selectedQuoteId: text('selected_quote_id'),
  notes: text('notes'),

  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('life_quotes_customer_idx').on(table.customerId),
  index('life_quotes_agent_idx').on(table.agentId),
  index('life_quotes_status_idx').on(table.status),
  index('life_quotes_created_at_idx').on(table.createdAt),
  index('life_quotes_tenant_idx').on(table.tenantId),
]);

// Life Quote Relations
export const lifeQuotesRelations = relations(lifeQuotes, ({ one }) => ({
  tenant: one(tenants, {
    fields: [lifeQuotes.tenantId],
    references: [tenants.id],
  }),
  customer: one(customers, {
    fields: [lifeQuotes.customerId],
    references: [customers.id],
  }),
  agent: one(users, {
    fields: [lifeQuotes.agentId],
    references: [users.id],
  }),
}));

// ═══════════════════════════════════════════════════════════════════════════
// MORTGAGEE PAYMENT TRACKING
// ═══════════════════════════════════════════════════════════════════════════

// Tracks active mortgagees per policy (synced from HawkSoft lienholders)
export const mortgagees = pgTable('mortgagees', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),

  // Link to policy
  policyId: uuid('policy_id').notNull().references(() => policies.id, { onDelete: 'cascade' }),
  customerId: uuid('customer_id').references(() => customers.id, { onDelete: 'set null' }),

  // Mortgagee details (from HawkSoft lienholder data)
  name: text('name').notNull(),
  loanNumber: varchar('loan_number', { length: 100 }),
  addressLine1: text('address_line1'),
  addressLine2: text('address_line2'),
  city: varchar('city', { length: 100 }),
  state: varchar('state', { length: 2 }),
  zipCode: varchar('zip_code', { length: 10 }),

  // Type classification
  type: varchar('type', { length: 50 }).default('mortgagee'), // mortgagee, lienholder, loss_payee
  position: integer('position').default(1), // 1st, 2nd, 3rd mortgagee

  // Tracking
  isActive: boolean('is_active').default(true).notNull(),
  lastPaymentCheckAt: timestamp('last_payment_check_at'),
  currentPaymentStatus: mortgageePaymentStatusEnum('current_payment_status').default('unknown'),

  // MyCoverageInfo lookup data
  mciLastFound: boolean('mci_last_found'),
  mciPolicyNumber: varchar('mci_policy_number', { length: 100 }), // May differ from HS policy number

  // Payment details (updated after each check)
  paidThroughDate: date('paid_through_date'),
  nextDueDate: date('next_due_date'),
  amountDue: decimal('amount_due', { precision: 12, scale: 2 }),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  tenantIdx: index('mortgagees_tenant_idx').on(table.tenantId),
  policyIdx: index('mortgagees_policy_idx').on(table.policyId),
  customerIdx: index('mortgagees_customer_idx').on(table.customerId),
  statusIdx: index('mortgagees_status_idx').on(table.currentPaymentStatus),
  activeIdx: index('mortgagees_active_idx').on(table.tenantId, table.isActive),
}));

// History of all payment verification checks
export const mortgageePaymentChecks = pgTable('mortgagee_payment_checks', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),

  // References
  mortgageeId: uuid('mortgagee_id').notNull().references(() => mortgagees.id, { onDelete: 'cascade' }),
  policyId: uuid('policy_id').notNull().references(() => policies.id, { onDelete: 'cascade' }),

  // Check metadata
  runId: uuid('run_id'), // Groups checks from same scheduler run
  checkType: varchar('check_type', { length: 20 }).default('scheduled'), // scheduled, manual, batch

  // Status
  status: mortgageeCheckStatusEnum('status').notNull().default('pending'),

  // Results
  paymentStatus: mortgageePaymentStatusEnum('payment_status'),
  paidThroughDate: date('paid_through_date'),
  nextDueDate: date('next_due_date'),
  amountDue: decimal('amount_due', { precision: 12, scale: 2 }),
  premiumAmount: decimal('premium_amount', { precision: 12, scale: 2 }),

  // Policy info from MCI (snapshot)
  mciPolicyNumber: varchar('mci_policy_number', { length: 100 }),
  mciCarrier: varchar('mci_carrier', { length: 200 }),
  mciEffectiveDate: date('mci_effective_date'),
  mciExpirationDate: date('mci_expiration_date'),
  mciCancellationDate: date('mci_cancellation_date'),
  mciReason: text('mci_reason'), // Cancellation reason if applicable

  // Scraping details
  screenshotUrl: text('screenshot_url'), // S3 URL of page screenshot for audit
  rawResponse: jsonb('raw_response'), // Full scraped data

  // Error handling
  errorMessage: text('error_message'),
  errorCode: varchar('error_code', { length: 50 }),
  retryCount: integer('retry_count').default(0),

  // Timing
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  durationMs: integer('duration_ms'),

  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  tenantIdx: index('mpc_tenant_idx').on(table.tenantId),
  mortgageeIdx: index('mpc_mortgagee_idx').on(table.mortgageeId),
  policyIdx: index('mpc_policy_idx').on(table.policyId),
  runIdx: index('mpc_run_idx').on(table.runId),
  statusIdx: index('mpc_status_idx').on(table.status),
  createdAtIdx: index('mpc_created_at_idx').on(table.createdAt),
  paymentStatusIdx: index('mpc_payment_status_idx').on(table.paymentStatus),
}));

// Settings for mortgagee payment scheduler (follows riskMonitorSettings pattern)
export const mortgageePaymentSettings = pgTable('mortgagee_payment_settings', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id).unique(),

  // Scheduler controls
  isPaused: boolean('is_paused').default(false).notNull(),
  pausedAt: timestamp('paused_at'),
  pausedByUserId: uuid('paused_by_user_id').references(() => users.id),
  pauseReason: text('pause_reason'),

  // Schedule window (CST, run overnight to avoid rate limits)
  scheduleStartHour: integer('schedule_start_hour').default(22).notNull(), // 10pm
  scheduleEndHour: integer('schedule_end_hour').default(5).notNull(), // 5am

  // Rate limiting
  dailyCheckBudget: integer('daily_check_budget').default(200).notNull(),
  checksToday: integer('checks_today').default(0).notNull(),
  lastBudgetResetAt: timestamp('last_budget_reset_at'),

  // Check cycle
  recheckDays: integer('recheck_days').default(7).notNull(), // Re-check every 7 days
  delayBetweenChecksMs: integer('delay_between_checks_ms').default(30000).notNull(), // 30 seconds

  // Microservice connection
  microserviceUrl: text('microservice_url'), // e.g., http://mci-scraper:8080
  microserviceApiKey: varchar('microservice_api_key', { length: 64 }),

  // 2Captcha settings
  twoCaptchaApiKey: varchar('two_captcha_api_key', { length: 64 }),
  twoCaptchaBalance: decimal('two_captcha_balance', { precision: 10, scale: 4 }),
  twoCaptchaLastCheckedAt: timestamp('two_captcha_last_checked_at'),

  // Alerts
  alertOnLatePayment: boolean('alert_on_late_payment').default(true).notNull(),
  alertOnLapsed: boolean('alert_on_lapsed').default(true).notNull(),
  emailNotificationsEnabled: boolean('email_notifications_enabled').default(true).notNull(),
  emailRecipients: jsonb('email_recipients').$type<string[]>(),

  // Scheduler state
  lastSchedulerRunAt: timestamp('last_scheduler_run_at'),
  lastSchedulerCompletedAt: timestamp('last_scheduler_completed_at'),
  lastSchedulerError: text('last_scheduler_error'),
  schedulerRunCount: integer('scheduler_run_count').default(0).notNull(),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Activity log for scheduler runs (follows riskMonitorActivityLog pattern)
export const mortgageePaymentActivityLog = pgTable('mortgagee_payment_activity_log', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),

  // Run info
  runId: uuid('run_id').notNull(),
  runType: varchar('run_type', { length: 20 }).notNull(), // 'scheduled', 'manual', 'batch'

  // Timing
  startedAt: timestamp('started_at').notNull(),
  completedAt: timestamp('completed_at'),
  durationMs: integer('duration_ms'),

  // Results
  policiesChecked: integer('policies_checked').default(0).notNull(),
  latePaymentsFound: integer('late_payments_found').default(0).notNull(),
  lapsedFound: integer('lapsed_found').default(0).notNull(),
  errorsEncountered: integer('errors_encountered').default(0).notNull(),
  captchasSolved: integer('captchas_solved').default(0).notNull(),

  // Status
  status: varchar('status', { length: 20 }).default('running').notNull(),
  errorMessage: text('error_message'),

  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  tenantIdx: index('mpact_tenant_idx').on(table.tenantId),
  runIdIdx: index('mpact_run_id_idx').on(table.runId),
  startedAtIdx: index('mpact_started_at_idx').on(table.startedAt),
}));

// Mortgagee Relations
export const mortgageesRelations = relations(mortgagees, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [mortgagees.tenantId],
    references: [tenants.id],
  }),
  policy: one(policies, {
    fields: [mortgagees.policyId],
    references: [policies.id],
  }),
  customer: one(customers, {
    fields: [mortgagees.customerId],
    references: [customers.id],
  }),
  paymentChecks: many(mortgageePaymentChecks),
}));

export const mortgageePaymentChecksRelations = relations(mortgageePaymentChecks, ({ one }) => ({
  tenant: one(tenants, {
    fields: [mortgageePaymentChecks.tenantId],
    references: [tenants.id],
  }),
  mortgagee: one(mortgagees, {
    fields: [mortgageePaymentChecks.mortgageeId],
    references: [mortgagees.id],
  }),
  policy: one(policies, {
    fields: [mortgageePaymentChecks.policyId],
    references: [policies.id],
  }),
}));

export const mortgageePaymentSettingsRelations = relations(mortgageePaymentSettings, ({ one }) => ({
  tenant: one(tenants, {
    fields: [mortgageePaymentSettings.tenantId],
    references: [tenants.id],
  }),
  pausedByUser: one(users, {
    fields: [mortgageePaymentSettings.pausedByUserId],
    references: [users.id],
  }),
}));

export const mortgageePaymentActivityLogRelations = relations(mortgageePaymentActivityLog, ({ one }) => ({
  tenant: one(tenants, {
    fields: [mortgageePaymentActivityLog.tenantId],
    references: [tenants.id],
  }),
}));

// ═══════════════════════════════════════════════════════════════════════════
// POLICY NOTICES (from Adapt Insurance API)
// ═══════════════════════════════════════════════════════════════════════════

export const policyNotices = pgTable('policy_notices', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),

  // External Reference
  adaptNoticeId: varchar('adapt_notice_id', { length: 100 }).unique(), // ID from Adapt API

  // Notice Type
  noticeType: policyNoticeTypeEnum('notice_type').notNull(),
  urgency: policyNoticeUrgencyEnum('urgency').default('medium'),

  // Policy Info
  policyNumber: varchar('policy_number', { length: 50 }),
  insuredName: text('insured_name'),
  carrier: varchar('carrier', { length: 100 }),
  lineOfBusiness: varchar('line_of_business', { length: 50 }), // auto, home, etc.

  // Customer Match
  customerId: uuid('customer_id').references(() => customers.id, { onDelete: 'set null' }),
  policyId: uuid('policy_id').references(() => policies.id, { onDelete: 'set null' }),

  // Notice Content
  title: text('title').notNull(),
  description: text('description'),

  // Billing-specific Fields
  amountDue: decimal('amount_due', { precision: 12, scale: 2 }),
  dueDate: date('due_date'),
  gracePeriodEnd: date('grace_period_end'),

  // Claims-specific Fields
  claimNumber: varchar('claim_number', { length: 50 }),
  claimDate: date('claim_date'),
  claimStatus: varchar('claim_status', { length: 50 }),

  // Review Workflow
  reviewStatus: policyNoticeReviewStatusEnum('review_status').default('pending'),
  assignedToId: uuid('assigned_to_id').references(() => users.id, { onDelete: 'set null' }),
  assignedAt: timestamp('assigned_at'),
  reviewedById: uuid('reviewed_by_id').references(() => users.id, { onDelete: 'set null' }),
  reviewedAt: timestamp('reviewed_at'),
  reviewNotes: text('review_notes'),

  // Action Taken
  actionTaken: varchar('action_taken', { length: 100 }), // e.g., 'contact_customer', 'send_reminder', 'escalate'
  actionDetails: text('action_details'),
  actionedAt: timestamp('actioned_at'),

  // Zapier Webhook
  zapierWebhookSent: boolean('zapier_webhook_sent').default(false),
  zapierWebhookSentAt: timestamp('zapier_webhook_sent_at'),
  zapierWebhookStatus: varchar('zapier_webhook_status', { length: 20 }), // success, failed

  // Raw Data
  rawPayload: jsonb('raw_payload'), // Original payload from Adapt API

  // Priority & AI Enhancement
  priorityScore: integer('priority_score').default(50), // 0-100 score for call queue prioritization
  donnaContext: jsonb('donna_context'), // AI-generated call context (talking points, objection handlers)
  customerValue: decimal('customer_value', { precision: 12, scale: 2 }), // Total premium value of customer
  matchConfidence: varchar('match_confidence', { length: 20 }), // high, medium, low, none

  // Dates
  noticeDate: timestamp('notice_date'), // When the notice was generated
  fetchedAt: timestamp('fetched_at').defaultNow(), // When we fetched it
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('policy_notices_tenant_idx').on(table.tenantId),
  index('policy_notices_adapt_id_idx').on(table.adaptNoticeId),
  index('policy_notices_status_idx').on(table.tenantId, table.reviewStatus),
  index('policy_notices_type_idx').on(table.tenantId, table.noticeType),
  index('policy_notices_urgency_idx').on(table.tenantId, table.urgency, table.reviewStatus),
  index('policy_notices_assigned_idx').on(table.assignedToId),
  index('policy_notices_customer_idx').on(table.customerId),
  index('policy_notices_policy_idx').on(table.policyId),
  index('policy_notices_due_date_idx').on(table.tenantId, table.dueDate),
  index('policy_notices_priority_idx').on(table.tenantId, table.priorityScore, table.reviewStatus),
]);

// ═══════════════════════════════════════════════════════════════════════════
// POLICY NOTICE WEBHOOK DELIVERIES
// ═══════════════════════════════════════════════════════════════════════════

export const policyNoticeWebhookDeliveries = pgTable('policy_notice_webhook_deliveries', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  policyNoticeId: uuid('policy_notice_id').notNull().references(() => policyNotices.id, { onDelete: 'cascade' }),

  // Webhook Details
  webhookUrl: text('webhook_url').notNull(),
  payload: jsonb('payload').notNull(), // The payload that was/will be sent

  // Delivery Status
  status: webhookDeliveryStatusEnum('status').default('pending'),
  httpStatus: integer('http_status'), // HTTP response code
  responseBody: text('response_body'), // Response from webhook
  errorMessage: text('error_message'),

  // Retry Logic
  attemptCount: integer('attempt_count').default(0).notNull(),
  nextRetryAt: timestamp('next_retry_at'),
  maxAttempts: integer('max_attempts').default(5).notNull(),

  // Timing
  sentAt: timestamp('sent_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('pnwd_tenant_idx').on(table.tenantId),
  index('pnwd_notice_idx').on(table.policyNoticeId),
  index('pnwd_status_idx').on(table.status),
  index('pnwd_retry_idx').on(table.status, table.nextRetryAt),
]);

// Policy Notice Relations
export const policyNoticesRelations = relations(policyNotices, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [policyNotices.tenantId],
    references: [tenants.id],
  }),
  customer: one(customers, {
    fields: [policyNotices.customerId],
    references: [customers.id],
  }),
  policy: one(policies, {
    fields: [policyNotices.policyId],
    references: [policies.id],
  }),
  assignedTo: one(users, {
    fields: [policyNotices.assignedToId],
    references: [users.id],
    relationName: 'assignedNotices',
  }),
  reviewedBy: one(users, {
    fields: [policyNotices.reviewedById],
    references: [users.id],
    relationName: 'reviewedNotices',
  }),
  webhookDeliveries: many(policyNoticeWebhookDeliveries),
}));

export const policyNoticeWebhookDeliveriesRelations = relations(policyNoticeWebhookDeliveries, ({ one }) => ({
  tenant: one(tenants, {
    fields: [policyNoticeWebhookDeliveries.tenantId],
    references: [tenants.id],
  }),
  policyNotice: one(policyNotices, {
    fields: [policyNoticeWebhookDeliveries.policyNoticeId],
    references: [policyNotices.id],
  }),
}));

// ═══════════════════════════════════════════════════════════════════════════
// CANOPY CONNECT
// ═══════════════════════════════════════════════════════════════════════════

export const canopyMatchStatusEnum = pgEnum('canopy_match_status', [
  'pending',
  'matched',
  'created',
  'needs_review',
  'ignored',
]);

export const canopyConnectPulls = pgTable('canopy_connect_pulls', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),

  // Canopy identifiers
  pullId: varchar('pull_id', { length: 100 }).notNull(),
  pullStatus: varchar('pull_status', { length: 50 }), // SUCCESS, PENDING, FAILED

  // Primary insured
  firstName: varchar('first_name', { length: 100 }),
  lastName: varchar('last_name', { length: 100 }),
  email: varchar('email', { length: 255 }),
  phone: varchar('phone', { length: 20 }),
  dateOfBirth: date('date_of_birth'),

  // Address
  address: jsonb('address').$type<{
    street?: string;
    city?: string;
    state?: string;
    zip?: string;
    fullAddress?: string;
  }>(),

  // Secondary insured
  secondaryInsured: jsonb('secondary_insured').$type<{
    firstName?: string;
    lastName?: string;
    dateOfBirth?: string;
    relationship?: string;
  }>(),

  // Carrier info
  carrierName: varchar('carrier_name', { length: 100 }),
  carrierFriendlyName: varchar('carrier_friendly_name', { length: 100 }),

  // Raw data from Canopy
  policies: jsonb('policies').$type<any[]>().default([]),
  vehicles: jsonb('vehicles').$type<any[]>().default([]),
  drivers: jsonb('drivers').$type<any[]>().default([]),
  dwellings: jsonb('dwellings').$type<any[]>().default([]),
  coverages: jsonb('coverages').$type<any[]>().default([]),
  claims: jsonb('claims').$type<any[]>().default([]),
  documents: jsonb('documents').$type<any[]>().default([]),

  // Metadata
  canopyLinkUsed: varchar('canopy_link_used', { length: 255 }),
  totalPremiumCents: integer('total_premium_cents'),
  policyCount: integer('policy_count').default(0),
  vehicleCount: integer('vehicle_count').default(0),
  driverCount: integer('driver_count').default(0),

  // Match status
  matchStatus: canopyMatchStatusEnum('match_status').default('pending'),
  matchedCustomerId: uuid('matched_customer_id').references(() => customers.id),
  matchedAgencyzoomId: varchar('matched_agencyzoom_id', { length: 50 }),
  matchedAgencyzoomType: varchar('matched_agencyzoom_type', { length: 20 }), // 'lead' or 'customer'
  matchedAt: timestamp('matched_at'),
  matchedByUserId: uuid('matched_by_user_id').references(() => users.id),

  // Note sync
  agencyzoomNoteSynced: boolean('agencyzoom_note_synced').default(false),
  agencyzoomNoteId: varchar('agencyzoom_note_id', { length: 50 }),

  // Raw payload
  rawPayload: jsonb('raw_payload'),

  // Timestamps
  pulledAt: timestamp('pulled_at'), // When customer completed the import
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  pullIdIdx: uniqueIndex('canopy_pull_id_idx').on(table.pullId),
  phoneIdx: index('canopy_phone_idx').on(table.phone),
  matchStatusIdx: index('canopy_match_status_idx').on(table.matchStatus),
  tenantIdx: index('canopy_tenant_idx').on(table.tenantId),
}));

export const canopyConnectPullsRelations = relations(canopyConnectPulls, ({ one }) => ({
  tenant: one(tenants, {
    fields: [canopyConnectPulls.tenantId],
    references: [tenants.id],
  }),
  matchedCustomer: one(customers, {
    fields: [canopyConnectPulls.matchedCustomerId],
    references: [customers.id],
  }),
  matchedBy: one(users, {
    fields: [canopyConnectPulls.matchedByUserId],
    references: [users.id],
  }),
}));

