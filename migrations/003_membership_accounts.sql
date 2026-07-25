-- YOUNGO Hub membership accounts (platform auth + registration profile).
-- Replaces the external Google membership form for hub access.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE TABLE IF NOT EXISTS hub_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  password_salt text NOT NULL,
  name text NOT NULL,
  entity_type text NOT NULL CHECK (entity_type IN ('individual', 'organization')),
  membership_track text NOT NULL CHECK (
    membership_track IN ('network', 'constituency_work')
  ),
  country text NOT NULL,
  date_of_birth date,
  organization_name text,
  organization_type text,
  is_unfccc_admitted boolean NOT NULL DEFAULT false,
  dcp_name text,
  under_18 boolean NOT NULL DEFAULT false,
  guardian_name text,
  guardian_email text,
  guardian_consent boolean NOT NULL DEFAULT false,
  coi_declared boolean NOT NULL DEFAULT false,
  coi_details text,
  policies_accepted boolean NOT NULL DEFAULT false,
  membership_policy_version text NOT NULL,
  constituency_work_status text CHECK (
    constituency_work_status IS NULL
    OR constituency_work_status IN ('pending_onboarding', 'active')
  ),
  created_at timestamptz NOT NULL DEFAULT now(),
  last_login_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_hub_accounts_email ON hub_accounts (lower(email));
CREATE INDEX IF NOT EXISTS idx_hub_accounts_track ON hub_accounts (membership_track, created_at DESC);
CREATE TABLE IF NOT EXISTS hub_sessions (
  token text PRIMARY KEY,
  account_id uuid NOT NULL REFERENCES hub_accounts(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_hub_sessions_account ON hub_sessions (account_id);
CREATE INDEX IF NOT EXISTS idx_hub_sessions_expires ON hub_sessions (expires_at);