-- Migration: Add VM Bridge integration fields
-- Created: 2026-01-13

-- Add VM Bridge session tracking to calls
ALTER TABLE calls ADD COLUMN IF NOT EXISTS vm_session_id VARCHAR(100);
ALTER TABLE calls ADD COLUMN IF NOT EXISTS external_number VARCHAR(20);

-- Add AI analysis fields (some may already exist)
ALTER TABLE calls ADD COLUMN IF NOT EXISTS ai_action_items JSONB DEFAULT '[]';
ALTER TABLE calls ADD COLUMN IF NOT EXISTS ai_topics JSONB DEFAULT '[]';

-- Add AgencyZoom sync tracking
ALTER TABLE calls ADD COLUMN IF NOT EXISTS agencyzoom_note_id VARCHAR(100);
ALTER TABLE calls ADD COLUMN IF NOT EXISTS agencyzoom_synced_at TIMESTAMPTZ;

-- Add indexes for efficient lookup
CREATE INDEX IF NOT EXISTS idx_calls_vm_session_id ON calls(vm_session_id);
CREATE INDEX IF NOT EXISTS idx_calls_external_number ON calls(external_number);

-- Add sentiment and entities to live transcript segments
ALTER TABLE live_transcript_segments ADD COLUMN IF NOT EXISTS sentiment VARCHAR(20);
ALTER TABLE live_transcript_segments ADD COLUMN IF NOT EXISTS entities JSONB;

-- Create pending VM events table for race condition handling
CREATE TABLE IF NOT EXISTS pending_vm_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  threecx_call_id VARCHAR(100) NOT NULL,
  session_id VARCHAR(100) NOT NULL,
  external_number VARCHAR(20),
  direction VARCHAR(10),
  extension VARCHAR(10),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '5 minutes'
);

CREATE INDEX IF NOT EXISTS idx_pending_vm_events_threecx ON pending_vm_events(threecx_call_id);

-- Auto-cleanup expired pending events (run periodically or via trigger)
-- DELETE FROM pending_vm_events WHERE expires_at < NOW();
