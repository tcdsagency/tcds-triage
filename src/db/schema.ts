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
  }>(),
  
  // Feature Flags
  features: jsonb('features').$type<{
    aiAssistant: boolean;
    voiceTranscription: boolean;
    propertyIntelligence: boolean;
    commercialQuotes: boolean;
    trainingSystem: boolean;
    riskMonitor: boolean;
  }>().default({
    aiAssistant: true,
    voiceTranscription: true,
    propertyIntelligence: false,
    commercialQuotes: false,
    trainingSystem: true,
    riskMonitor: false,
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
  producerId: uuid('producer_id').references(() => users.id),
  csrId: uuid('csr_id').references(() => users.id),
  
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
  
  // Sync Status
  lastSyncedFromAz: timestamp('last_synced_from_az'),
  lastSyncedFromHs: timestamp('last_synced_from_hs'),
  
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

  // Lookup Metadata
  lookupSource: varchar('lookup_source', { length: 20 }).default('manual'), // 'manual', 'quote', 'policy'
  linkedQuoteId: uuid('linked_quote_id'),
  linkedPropertyId: uuid('linked_property_id'),

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
  customerId: uuid('customer_id').references(() => customers.id),
  agentId: uuid('agent_id').references(() => users.id),
  
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
  customerId: uuid('customer_id').references(() => customers.id),
  callId: uuid('call_id').references(() => calls.id),
  quoteId: uuid('quote_id').references(() => quotes.id),
  
  // Assignment
  assignedToId: uuid('assigned_to_id').references(() => users.id),
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
  resolvedById: uuid('resolved_by_id').references(() => users.id),
  resolution: text('resolution'),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('triage_tenant_idx').on(table.tenantId),
  index('triage_status_idx').on(table.tenantId, table.status),
  index('triage_assigned_idx').on(table.assignedToId),
  index('triage_priority_idx').on(table.tenantId, table.priority, table.status),
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
  status: text('status').notNull().default('pending_ai_processing'),
  
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
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  completedAt: timestamp('completed_at'),
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
