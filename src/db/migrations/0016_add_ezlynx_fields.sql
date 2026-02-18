-- Add EZLynx integration fields to customers table
ALTER TABLE customers ADD COLUMN IF NOT EXISTS ezlynx_account_id VARCHAR(50);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS ezlynx_synced_at TIMESTAMP;

-- Index for EZLynx account ID lookups
CREATE INDEX IF NOT EXISTS customers_ezlynx_idx ON customers (tenant_id, ezlynx_account_id);
