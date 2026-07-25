-- Member lifecycle, roles, WG interests, course progress, WG workspace unlocks.
ALTER TABLE hub_accounts
ADD COLUMN IF NOT EXISTS member_status text NOT NULL DEFAULT 'pending_course' CHECK (member_status IN ('pending_course', 'verified')),
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'member' CHECK (
    role IN ('member', 'wg_contact', 'ngo_admin', 'admin')
  ),
  ADD COLUMN IF NOT EXISTS wg_interests text [] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS course_passed_at timestamptz,
  ADD COLUMN IF NOT EXISTS course_score integer,
  ADD COLUMN IF NOT EXISTS verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS verified_by text;
CREATE INDEX IF NOT EXISTS idx_hub_accounts_status ON hub_accounts (member_status);
CREATE INDEX IF NOT EXISTS idx_hub_accounts_role ON hub_accounts (role);
-- Existing accounts: keep as pending unless already created (ops can promote admins).
-- WG workspace onboarding per member × group
CREATE TABLE IF NOT EXISTS wg_workspace_progress (
  account_id uuid NOT NULL REFERENCES hub_accounts(id) ON DELETE CASCADE,
  wg_slug text NOT NULL,
  presentation_ok boolean NOT NULL DEFAULT false,
  rules_ok boolean NOT NULL DEFAULT false,
  unlocked_at timestamptz,
  joined_at timestamptz NOT NULL DEFAULT now(),
  role_in_wg text NOT NULL DEFAULT 'member' CHECK (role_in_wg IN ('member', 'contact', 'lead')),
  status text NOT NULL DEFAULT 'interested' CHECK (
    status IN (
      'interested',
      'pending_approval',
      'active',
      'rejected'
    )
  ),
  PRIMARY KEY (account_id, wg_slug)
);
CREATE INDEX IF NOT EXISTS idx_wg_progress_wg ON wg_workspace_progress (wg_slug, status);
-- Simple WG activities / calls registered by CPs
CREATE TABLE IF NOT EXISTS wg_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wg_slug text NOT NULL,
  kind text NOT NULL CHECK (
    kind IN ('call', 'submission', 'campaign', 'action_point')
  ),
  title text NOT NULL,
  body text,
  starts_at timestamptz,
  ends_at timestamptz,
  url text,
  created_by uuid REFERENCES hub_accounts(id) ON DELETE
  SET NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_wg_activities_wg ON wg_activities (wg_slug, created_at DESC);
-- NGO endorsement / request inbox
CREATE TABLE IF NOT EXISTS ngo_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_account_id uuid NOT NULL REFERENCES hub_accounts(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (
    kind IN (
      'submit',
      'endorse',
      'represent',
      'deadline',
      'other'
    )
  ),
  title text NOT NULL,
  body text,
  deadline_at timestamptz,
  status text NOT NULL DEFAULT 'open' CHECK (
    status IN ('open', 'in_progress', 'done', 'declined')
  ),
  created_by uuid REFERENCES hub_accounts(id) ON DELETE
  SET NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ngo_requests_org ON ngo_requests (org_account_id, status);