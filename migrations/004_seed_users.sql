-- Seed Script: TCDS Users
-- Run AFTER migrations and AFTER tenant is created
-- Replace {TENANT_ID} with actual tenant UUID from /api/setup response

-- ============================================================================
-- SEED USERS
-- ============================================================================

-- Note: These users have AgencyZoom IDs for producer/CSR resolution during sync
-- Extension is used for 3CX call matching

-- Insert users one at a time with upsert
-- Using ON CONFLICT on (tenant_id, email) unique index

INSERT INTO users (tenant_id, email, first_name, last_name, role, extension, agencyzoom_id, agent_code, is_active)
VALUES ('{TENANT_ID}'::UUID, 'tconn@insurebham.com', 'Todd', 'Conn', 'admin', '102', '94004', 'TJC', true)
ON CONFLICT ON CONSTRAINT users_tenant_email_unique DO UPDATE SET
  first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name, role = EXCLUDED.role,
  extension = EXCLUDED.extension, agencyzoom_id = EXCLUDED.agencyzoom_id, agent_code = EXCLUDED.agent_code, updated_at = NOW();

INSERT INTO users (tenant_id, email, first_name, last_name, role, extension, agencyzoom_id, agent_code, is_active)
VALUES ('{TENANT_ID}'::UUID, 'lee.tidwell@tcdsagency.com', 'Lee', 'Tidwell', 'admin', '101', '94007', 'LWT', true)
ON CONFLICT ON CONSTRAINT users_tenant_email_unique DO UPDATE SET
  first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name, role = EXCLUDED.role,
  extension = EXCLUDED.extension, agencyzoom_id = EXCLUDED.agencyzoom_id, agent_code = EXCLUDED.agent_code, updated_at = NOW();

INSERT INTO users (tenant_id, email, first_name, last_name, role, extension, agencyzoom_id, agent_code, is_active)
VALUES ('{TENANT_ID}'::UUID, 'blair.lee@tcdsagency.com', 'Blair', 'Lee', 'agent', '100', '94006', 'LBP', true)
ON CONFLICT ON CONSTRAINT users_tenant_email_unique DO UPDATE SET
  first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name, role = EXCLUDED.role,
  extension = EXCLUDED.extension, agencyzoom_id = EXCLUDED.agencyzoom_id, agent_code = EXCLUDED.agent_code, updated_at = NOW();

INSERT INTO users (tenant_id, email, first_name, last_name, role, extension, agencyzoom_id, agent_code, is_active)
VALUES ('{TENANT_ID}'::UUID, 'angie.sousa@tcdsagency.com', 'Angie', 'Sousa', 'agent', '103', '94008', 'AES', true)
ON CONFLICT ON CONSTRAINT users_tenant_email_unique DO UPDATE SET
  first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name, role = EXCLUDED.role,
  extension = EXCLUDED.extension, agencyzoom_id = EXCLUDED.agencyzoom_id, agent_code = EXCLUDED.agent_code, updated_at = NOW();

INSERT INTO users (tenant_id, email, first_name, last_name, role, extension, agencyzoom_id, agent_code, is_active)
VALUES ('{TENANT_ID}'::UUID, 'montrice.lemaster@tcdsagency.com', 'Montrice', 'LeMaster', 'agent', '104', '94005', 'MTW', true)
ON CONFLICT ON CONSTRAINT users_tenant_email_unique DO UPDATE SET
  first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name, role = EXCLUDED.role,
  extension = EXCLUDED.extension, agencyzoom_id = EXCLUDED.agencyzoom_id, agent_code = EXCLUDED.agent_code, updated_at = NOW();

INSERT INTO users (tenant_id, email, first_name, last_name, role, extension, agencyzoom_id, agent_code, is_active)
VALUES ('{TENANT_ID}'::UUID, 'paulo.gacula@tcdsagency.com', 'Paulo', 'Gacula', 'supervisor', '107', '132766', 'PAG', true)
ON CONFLICT ON CONSTRAINT users_tenant_email_unique DO UPDATE SET
  first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name, role = EXCLUDED.role,
  extension = EXCLUDED.extension, agencyzoom_id = EXCLUDED.agencyzoom_id, agent_code = EXCLUDED.agent_code, updated_at = NOW();

INSERT INTO users (tenant_id, email, first_name, last_name, role, extension, agencyzoom_id, agent_code, is_active)
VALUES ('{TENANT_ID}'::UUID, 'stephanie.goodman@tcdsagency.com', 'Stephanie', 'Goodman', 'supervisor', '110', '159477', 'SCG', true)
ON CONFLICT ON CONSTRAINT users_tenant_email_unique DO UPDATE SET
  first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name, role = EXCLUDED.role,
  extension = EXCLUDED.extension, agencyzoom_id = EXCLUDED.agencyzoom_id, agent_code = EXCLUDED.agent_code, updated_at = NOW();

-- ============================================================================
-- VERIFY
-- ============================================================================

SELECT 
  first_name || ' ' || last_name as name,
  email,
  extension,
  agencyzoom_id,
  agent_code,
  role
FROM users 
WHERE tenant_id = '{TENANT_ID}'::UUID
ORDER BY extension;
