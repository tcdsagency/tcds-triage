-- Migration: Add Donna AI (AgencyIQ/Crux) columns to customers table
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/guvqhnmhubvytwqvfxle/sql

-- Add donnaData JSONB column for storing Donna AI insights
ALTER TABLE customers ADD COLUMN IF NOT EXISTS donna_data jsonb;

-- Add timestamp for tracking when data was last synced from Donna
ALTER TABLE customers ADD COLUMN IF NOT EXISTS last_synced_from_donna timestamp;

-- Add index for fast Donna sync queries
CREATE INDEX IF NOT EXISTS idx_customers_donna_sync
ON customers (tenant_id, last_synced_from_donna)
WHERE donna_data IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN customers.donna_data IS 'Donna AI (AgencyIQ/Crux) customer insights including sentiment, predictions, and recommendations';
COMMENT ON COLUMN customers.last_synced_from_donna IS 'Timestamp of last successful sync from Donna AI';
