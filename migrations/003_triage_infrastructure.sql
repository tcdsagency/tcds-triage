-- Migration: Add Triage Infrastructure Tables
-- Created: 2026-01-06
-- Description: Adds wrapup drafts, match suggestions, call events, and agents table
--              These are the critical tables needed for call triage to function

-- ============================================================================
-- USERS TABLE ADDITIONS
-- Add lead rotation fields to users (no separate agents table)
-- ============================================================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS in_lead_rotation BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS lead_rotation_order INTEGER;

-- Create unique constraint on (tenant_id, email) for upsert support
-- Note: Using ADD CONSTRAINT which will fail if constraint exists, so wrap in exception handler
DO $$ BEGIN
  ALTER TABLE users ADD CONSTRAINT users_tenant_email_unique UNIQUE (tenant_id, email);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- CALL EVENTS TABLE
-- Append-only event log for calls (debugging and audit trail)
-- ============================================================================

CREATE TABLE IF NOT EXISTS call_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Call linkage
  call_id UUID REFERENCES calls(id) ON DELETE CASCADE,
  external_call_id TEXT,  -- 3CX call ID
  
  -- Event details
  event_type TEXT NOT NULL,  -- 'call_started', 'call_answered', 'call_ended', 'direction_corrected', etc.
  source TEXT NOT NULL,      -- '3cx_websocket', '3cx_webhook', 'mssql', 'ui', 'api'
  
  -- Event payload
  payload JSONB,
  
  -- Timing
  timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS call_events_call_idx ON call_events(call_id);
CREATE INDEX IF NOT EXISTS call_events_external_idx ON call_events(external_call_id);
CREATE INDEX IF NOT EXISTS call_events_timestamp_idx ON call_events(timestamp);
CREATE INDEX IF NOT EXISTS call_events_type_idx ON call_events(event_type);

-- ============================================================================
-- WRAPUP DRAFTS TABLE
-- AI-generated call summaries pending agent review (heart of triage)
-- ============================================================================

CREATE TABLE IF NOT EXISTS wrapup_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Call linkage
  call_id UUID NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
  
  -- Direction (denormalized for quick filtering)
  direction TEXT NOT NULL DEFAULT 'Inbound',  -- 'Inbound' | 'Outbound'
  
  -- Agent info from telephony
  agent_extension TEXT,
  agent_name TEXT,
  
  -- Status workflow
  -- pending_ai_processing -> ai_processed -> pending_review -> matched -> completed/posted
  status TEXT NOT NULL DEFAULT 'pending_ai_processing',
  
  -- Customer info (from transcript extraction)
  customer_name TEXT,
  customer_phone TEXT,
  customer_email TEXT,
  policy_numbers TEXT[],
  insurance_type TEXT,
  request_type TEXT,
  summary TEXT,
  
  -- AI Processing
  ai_cleaned_summary TEXT,
  ai_processing_status TEXT DEFAULT 'pending',  -- 'pending', 'processing', 'completed', 'failed'
  ai_processed_at TIMESTAMP,
  ai_extraction JSONB,  -- Full AI extraction result
  ai_confidence DECIMAL(3, 2),  -- 0.00 - 1.00
  
  -- Customer matching
  match_status TEXT DEFAULT 'unprocessed',  -- 'unprocessed', 'processing', 'matched', 'needs_review', 'no_match'
  trestle_data JSONB,       -- Phone lookup data
  ai_recommendation JSONB,  -- AI's match recommendation
  
  -- Reviewer decision
  reviewer_decision TEXT,   -- 'approved', 'edited', 'rejected'
  reviewer_id UUID REFERENCES users(id),
  reviewed_at TIMESTAMP,
  
  -- Outcome
  outcome TEXT,  -- 'note_posted', 'ticket_created', 'no_action', 'escalated'
  agencyzoom_note_id TEXT,
  agencyzoom_ticket_id TEXT,
  note_auto_posted BOOLEAN DEFAULT false,
  note_auto_posted_at TIMESTAMP,
  
  -- Phone update flag
  needs_phone_update BOOLEAN DEFAULT false,
  phone_update_acknowledged_at TIMESTAMP,
  phone_update_note TEXT,
  
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS wrapup_drafts_call_unique ON wrapup_drafts(call_id);
CREATE INDEX IF NOT EXISTS wrapup_drafts_status_idx ON wrapup_drafts(tenant_id, status);
CREATE INDEX IF NOT EXISTS wrapup_drafts_match_idx ON wrapup_drafts(tenant_id, match_status);
CREATE INDEX IF NOT EXISTS wrapup_drafts_created_idx ON wrapup_drafts(tenant_id, created_at DESC);

-- ============================================================================
-- MATCH SUGGESTIONS TABLE
-- Customer match suggestions for unmatched calls
-- ============================================================================

CREATE TABLE IF NOT EXISTS match_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Link to wrapup draft
  wrapup_draft_id UUID NOT NULL REFERENCES wrapup_drafts(id) ON DELETE CASCADE,
  
  -- Source and type
  source TEXT NOT NULL,       -- 'agencyzoom', 'hawksoft', 'trestle', 'ai'
  contact_type TEXT NOT NULL, -- 'customer', 'lead'
  
  -- Contact info
  contact_id TEXT,
  contact_name TEXT,
  contact_phone TEXT,
  contact_email TEXT,
  
  -- Match quality
  confidence DECIMAL(3, 2),   -- 0.00 - 1.00
  match_reason TEXT,          -- 'exact_phone', 'fuzzy_name', 'policy_number', etc.
  
  -- Recommendation
  recommended_action TEXT,    -- 'use_existing', 'create_lead', 'manual_review'
  
  -- Selection
  is_selected BOOLEAN DEFAULT false,
  
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS match_suggestions_wrapup_idx ON match_suggestions(wrapup_draft_id);
CREATE INDEX IF NOT EXISTS match_suggestions_confidence_idx ON match_suggestions(wrapup_draft_id, confidence DESC);

-- ============================================================================
-- CALL NOTES LOG TABLE
-- Automatic logging of all calls with transcription and AZ note posting
-- ============================================================================

CREATE TABLE IF NOT EXISTS call_notes_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Call identification
  call_id UUID REFERENCES calls(id) ON DELETE SET NULL,
  external_call_id TEXT,     -- 3CX call ID
  history_id TEXT,           -- For MSSQL reconciliation
  
  caller_phone TEXT NOT NULL,
  caller_name TEXT,          -- CNAM caller ID
  called_phone TEXT,
  agent_extension TEXT,
  agent_name TEXT,
  direction TEXT NOT NULL,   -- 'Inbound' | 'Outbound'
  
  -- Call timing
  call_start_time TIMESTAMP,
  call_end_time TIMESTAMP,
  duration INTEGER,  -- seconds
  
  -- Customer matching
  match_status TEXT NOT NULL DEFAULT 'pending',
  match_confidence DECIMAL(3, 2),
  match_method TEXT,
  suggested_matches JSONB,
  
  -- Customer info (from matching)
  customer_id TEXT,
  customer_type TEXT,  -- 'customer', 'lead'
  customer_name TEXT,
  customer_email TEXT,
  
  -- Transcription and AI
  transcript_url TEXT,
  recording_url TEXT,
  transcript TEXT,
  ai_summary TEXT,
  ai_call_type TEXT,
  
  -- AgencyZoom posting
  az_note_status TEXT NOT NULL DEFAULT 'pending',
  az_note_id TEXT,
  az_note_error TEXT,
  az_note_posted_at TIMESTAMP,
  
  -- Service request/ticket tracking
  az_ticket_id TEXT,
  az_ticket_status TEXT,
  az_ticket_stage_name TEXT,
  az_ticket_status_updated_at TIMESTAMP,
  az_ticket_url TEXT,
  
  -- Call classification
  is_hangup BOOLEAN NOT NULL DEFAULT false,
  hangup_category TEXT,
  
  -- Customer matching flags
  needs_customer_match BOOLEAN NOT NULL DEFAULT false,
  needs_contact_update BOOLEAN NOT NULL DEFAULT false,
  extracted_contact_info JSONB,
  
  -- Source tracking
  source TEXT NOT NULL DEFAULT 'zapier',
  raw_payload JSONB,
  
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS call_notes_log_caller_idx ON call_notes_log(caller_phone);
CREATE INDEX IF NOT EXISTS call_notes_log_customer_idx ON call_notes_log(customer_id);
CREATE INDEX IF NOT EXISTS call_notes_log_created_idx ON call_notes_log(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS call_notes_log_match_idx ON call_notes_log(tenant_id, match_status);
CREATE INDEX IF NOT EXISTS call_notes_log_az_idx ON call_notes_log(tenant_id, az_note_status);

-- ============================================================================
-- LEAD QUEUE TABLES
-- For round-robin lead assignment
-- ============================================================================

CREATE TABLE IF NOT EXISTS lead_queue_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Source tracking
  source TEXT NOT NULL,        -- 'call_in', 'webform', 'zapier', etc.
  source_reference TEXT,       -- External ID from source
  
  -- Contact information
  contact_name TEXT,
  contact_phone TEXT,
  contact_email TEXT,
  contact_address TEXT,
  
  -- Lead details
  insurance_type TEXT,
  lead_notes TEXT,
  raw_payload JSONB,
  
  -- Queue status
  status TEXT NOT NULL DEFAULT 'queued',  -- 'queued', 'notified', 'escalated', 'claimed', 'converted', 'expired'
  priority TEXT NOT NULL DEFAULT 'normal',
  
  -- Round-robin assignment (references users, not agents)
  assigned_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  notified_at TIMESTAMP,
  expires_at TIMESTAMP,
  escalated_at TIMESTAMP,
  
  -- Claim tracking
  claimed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  claimed_at TIMESTAMP,
  
  -- AgencyZoom integration
  agencyzoom_lead_id TEXT,
  agencyzoom_sync_status TEXT,
  agencyzoom_sync_error TEXT,
  agencyzoom_synced_at TIMESTAMP,
  
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS lead_queue_status_idx ON lead_queue_entries(tenant_id, status);
CREATE INDEX IF NOT EXISTS lead_queue_source_idx ON lead_queue_entries(tenant_id, source);
CREATE INDEX IF NOT EXISTS lead_queue_assigned_idx ON lead_queue_entries(assigned_user_id);
CREATE INDEX IF NOT EXISTS lead_queue_expires_idx ON lead_queue_entries(expires_at);
CREATE INDEX IF NOT EXISTS lead_queue_created_idx ON lead_queue_entries(tenant_id, created_at DESC);

-- Round-robin state tracking
CREATE TABLE IF NOT EXISTS lead_round_robin_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  team_id TEXT DEFAULT 'default',
  last_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  handoff_count INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS lead_round_robin_tenant_team_idx ON lead_round_robin_state(tenant_id, team_id);

-- Lead activity log
CREATE TABLE IF NOT EXISTS lead_claim_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES lead_queue_entries(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,  -- 'notified', 'claimed', 'timed_out', 'escalated', 'converted'
  metadata JSONB,
  timestamp TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS lead_claim_activity_lead_idx ON lead_claim_activity(lead_id);
CREATE INDEX IF NOT EXISTS lead_claim_activity_user_idx ON lead_claim_activity(user_id);
CREATE INDEX IF NOT EXISTS lead_claim_activity_timestamp_idx ON lead_claim_activity(tenant_id, timestamp DESC);

-- ============================================================================
-- ADD MISSING COLUMNS TO EXISTING TABLES
-- ============================================================================

-- Users table - already has agencyzoom_id, agent_code, direct_dial, cell_phone from previous migration

-- Customers table - lead tracking and archive support
ALTER TABLE customers ADD COLUMN IF NOT EXISTS is_lead BOOLEAN DEFAULT false;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS lead_status VARCHAR(50);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS converted_to_customer_at TIMESTAMP;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT false;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS archived_reason TEXT;

CREATE INDEX IF NOT EXISTS customers_lead_idx ON customers(tenant_id, is_lead);
CREATE INDEX IF NOT EXISTS customers_archived_idx ON customers(tenant_id, is_archived);

-- Calls table - add more fields from original schema
ALTER TABLE calls ADD COLUMN IF NOT EXISTS external_call_id TEXT;  -- 3CX call ID
ALTER TABLE calls ADD COLUMN IF NOT EXISTS direction_live TEXT;     -- Set once at call start, immutable
ALTER TABLE calls ADD COLUMN IF NOT EXISTS direction_final TEXT;    -- Set by MSSQL post-call
ALTER TABLE calls ADD COLUMN IF NOT EXISTS direction_confidence TEXT DEFAULT 'low';
ALTER TABLE calls ADD COLUMN IF NOT EXISTS direction_source TEXT;
ALTER TABLE calls ADD COLUMN IF NOT EXISTS raw_caller TEXT;
ALTER TABLE calls ADD COLUMN IF NOT EXISTS raw_called TEXT;
ALTER TABLE calls ADD COLUMN IF NOT EXISTS caller_type TEXT;  -- 'extension', 'external', 'ambiguous'
ALTER TABLE calls ADD COLUMN IF NOT EXISTS called_type TEXT;
ALTER TABLE calls ADD COLUMN IF NOT EXISTS wrapup_start_time TIMESTAMP;
ALTER TABLE calls ADD COLUMN IF NOT EXISTS customer_context JSONB;
ALTER TABLE calls ADD COLUMN IF NOT EXISTS ai_quick_overview JSONB;
ALTER TABLE calls ADD COLUMN IF NOT EXISTS ai_extraction JSONB;
ALTER TABLE calls ADD COLUMN IF NOT EXISTS ai_confidence DECIMAL(3, 2);

CREATE INDEX IF NOT EXISTS calls_external_idx ON calls(external_call_id);

-- ============================================================================
-- VERIFICATION
-- ============================================================================

SELECT 'wrapup_drafts' as table_name, COUNT(*) as column_count 
FROM information_schema.columns WHERE table_name = 'wrapup_drafts'
UNION ALL
SELECT 'match_suggestions', COUNT(*) 
FROM information_schema.columns WHERE table_name = 'match_suggestions'
UNION ALL
SELECT 'call_events', COUNT(*) 
FROM information_schema.columns WHERE table_name = 'call_events'
UNION ALL
SELECT 'call_notes_log', COUNT(*) 
FROM information_schema.columns WHERE table_name = 'call_notes_log'
UNION ALL
SELECT 'lead_queue_entries', COUNT(*) 
FROM information_schema.columns WHERE table_name = 'lead_queue_entries';
