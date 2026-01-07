-- Migration: Add sync-related fields to users and customers tables
-- Created: 2026-01-06
-- Description: Adds agent mapping fields, lead tracking, and archive support

-- ============================================================================
-- USERS TABLE - Agent/CSR External System Links
-- ============================================================================

-- AgencyZoom user ID for producer/CSR resolution during sync
ALTER TABLE users ADD COLUMN IF NOT EXISTS agencyzoom_id VARCHAR(50);

-- HawkSoft producer/CSR code
ALTER TABLE users ADD COLUMN IF NOT EXISTS agent_code VARCHAR(20);

-- Direct dial for SMS notifications (leads queue, escalations)
ALTER TABLE users ADD COLUMN IF NOT EXISTS direct_dial VARCHAR(20);

-- Personal cell for fallback SMS
ALTER TABLE users ADD COLUMN IF NOT EXISTS cell_phone VARCHAR(20);

-- Indexes for lookups
CREATE INDEX IF NOT EXISTS users_az_idx ON users(tenant_id, agencyzoom_id);
CREATE INDEX IF NOT EXISTS users_extension_idx ON users(tenant_id, extension);

-- ============================================================================
-- CUSTOMERS TABLE - Lead Tracking
-- ============================================================================

-- Distinguish leads from customers (leads can't have service requests in AZ)
ALTER TABLE customers ADD COLUMN IF NOT EXISTS is_lead BOOLEAN DEFAULT false;

-- Lead-specific status (new, contacted, qualified, etc.)
ALTER TABLE customers ADD COLUMN IF NOT EXISTS lead_status VARCHAR(50);

-- Track when lead converts to customer
ALTER TABLE customers ADD COLUMN IF NOT EXISTS converted_to_customer_at TIMESTAMP;

-- Index for filtering leads vs customers
CREATE INDEX IF NOT EXISTS customers_lead_idx ON customers(tenant_id, is_lead);

-- ============================================================================
-- CUSTOMERS TABLE - Soft Delete / Archive Support
-- ============================================================================

-- Soft delete flag (never hard delete - customer may reappear)
ALTER TABLE customers ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT false;

-- When the record was archived
ALTER TABLE customers ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP;

-- Reason for archival (e.g., "Deleted in HawkSoft")
ALTER TABLE customers ADD COLUMN IF NOT EXISTS archived_reason TEXT;

-- Index for filtering out archived records
CREATE INDEX IF NOT EXISTS customers_archived_idx ON customers(tenant_id, is_archived);

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Verify columns were added (will show in query results)
SELECT 
  'users' as table_name,
  column_name,
  data_type
FROM information_schema.columns 
WHERE table_name = 'users' 
  AND column_name IN ('agencyzoom_id', 'agent_code', 'direct_dial', 'cell_phone')
UNION ALL
SELECT 
  'customers' as table_name,
  column_name,
  data_type
FROM information_schema.columns 
WHERE table_name = 'customers' 
  AND column_name IN ('is_lead', 'lead_status', 'converted_to_customer_at', 'is_archived', 'archived_at', 'archived_reason');
