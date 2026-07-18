-- Canonical backend foundation: lifecycle, scoped assignments, audit, GYS workflow,
-- secure NGO invitations, and account references for future content writes.

ALTER TABLE hub_accounts
  ADD COLUMN IF NOT EXISTS hub_access_status text NOT NULL DEFAULT 'pending_course'
    CHECK (hub_access_status IN ('pending_course','active','suspended')),
  ADD COLUMN IF NOT EXISTS membership_status text NOT NULL DEFAULT 'registered'
    CHECK (membership_status IN ('registered','course_passed','awaiting_onboarding','active','renewal_due','expired','terminated')),
  ADD COLUMN IF NOT EXISTS onboarding_cohort text,
  ADD COLUMN IF NOT EXISTS renewal_due_at timestamptz,
  ADD COLUMN IF NOT EXISTS membership_ended_at timestamptz,
  ADD COLUMN IF NOT EXISTS membership_end_reason text;

UPDATE hub_accounts
SET hub_access_status = CASE WHEN member_status = 'verified' THEN 'active' ELSE 'pending_course' END,
    membership_status = CASE
      WHEN constituency_work_status = 'active' THEN 'active'
      WHEN course_passed_at IS NOT NULL AND membership_track = 'constituency_work' THEN 'awaiting_onboarding'
      WHEN course_passed_at IS NOT NULL THEN 'course_passed'
      ELSE 'registered'
    END;

CREATE UNIQUE INDEX IF NOT EXISTS uq_hub_accounts_email_ci ON hub_accounts (lower(email));

CREATE TABLE IF NOT EXISTS account_assignments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id  uuid NOT NULL REFERENCES hub_accounts(id) ON DELETE CASCADE,
  scope_type  text NOT NULL CHECK (scope_type IN ('platform','team','working_group','organization')),
  scope_id    text NOT NULL,
  role        text NOT NULL,
  status      text NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','expired')),
  starts_at   timestamptz NOT NULL DEFAULT now(),
  ends_at     timestamptz,
  assigned_by uuid REFERENCES hub_accounts(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, scope_type, scope_id, role)
);
CREATE INDEX IF NOT EXISTS idx_account_assignments_lookup
  ON account_assignments (account_id, status, scope_type);

INSERT INTO account_assignments (account_id, scope_type, scope_id, role)
SELECT id, 'team', team_role, 'member'
FROM hub_accounts, unnest(team_roles) AS team_role
ON CONFLICT DO NOTHING;

INSERT INTO account_assignments (account_id, scope_type, scope_id, role, starts_at)
SELECT account_id, 'working_group', wg_slug, role_in_wg, joined_at
FROM wg_workspace_progress
WHERE status = 'active' AND role_in_wg IN ('contact','lead')
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS governance_audit (
  id          bigserial PRIMARY KEY,
  actor_id    uuid REFERENCES hub_accounts(id) ON DELETE SET NULL,
  action      text NOT NULL,
  target_type text NOT NULL,
  target_id   text,
  before_data jsonb,
  after_data  jsonb,
  reason      text,
  request_id  text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_governance_audit_target ON governance_audit (target_type, target_id, created_at DESC);

ALTER TABLE ngo_seats
  ADD COLUMN IF NOT EXISTS invite_token_hash text,
  ADD COLUMN IF NOT EXISTS invite_expires_at timestamptz;
CREATE UNIQUE INDEX IF NOT EXISTS idx_ngo_seats_token_hash ON ngo_seats (invite_token_hash) WHERE invite_token_hash IS NOT NULL;

CREATE TABLE IF NOT EXISTS gys_cycles (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code        text UNIQUE NOT NULL,
  title       text NOT NULL,
  year        integer NOT NULL,
  status      text NOT NULL DEFAULT 'intake' CHECK (status IN ('planning','intake','synthesis','review','consultation','approved','published','archived')),
  opens_at    timestamptz,
  closes_at   timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS gys_contributions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id    uuid NOT NULL REFERENCES gys_cycles(id) ON DELETE CASCADE,
  title       text NOT NULL,
  body        text NOT NULL,
  theme       text,
  region      text,
  country     text,
  author_id   uuid REFERENCES hub_accounts(id) ON DELETE SET NULL,
  reviewer_id uuid REFERENCES hub_accounts(id) ON DELETE SET NULL,
  status      text NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted','triaged','drafting','needs_review','approved','rejected','published')),
  version     integer NOT NULL DEFAULT 1,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_gys_contributions_cycle_status ON gys_contributions (cycle_id, status, updated_at DESC);

CREATE TABLE IF NOT EXISTS gys_reviews (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contribution_id uuid NOT NULL REFERENCES gys_contributions(id) ON DELETE CASCADE,
  reviewer_id     uuid REFERENCES hub_accounts(id) ON DELETE SET NULL,
  decision        text NOT NULL CHECK (decision IN ('comment','request_changes','approve','reject')),
  note            text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS gys_status_log (
  id              bigserial PRIMARY KEY,
  contribution_id uuid NOT NULL REFERENCES gys_contributions(id) ON DELETE CASCADE,
  from_status     text,
  to_status       text NOT NULL,
  changed_by      uuid REFERENCES hub_accounts(id) ON DELETE SET NULL,
  note            text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- New authenticated writes should use hub_accounts. Legacy user references remain
-- readable until their content is migrated.
ALTER TABLE events ADD COLUMN IF NOT EXISTS created_by_account_id uuid REFERENCES hub_accounts(id) ON DELETE SET NULL;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS created_by_account_id uuid REFERENCES hub_accounts(id) ON DELETE SET NULL;
ALTER TABLE dmp_decisions ADD COLUMN IF NOT EXISTS created_by_account_id uuid REFERENCES hub_accounts(id) ON DELETE SET NULL;
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS created_by_account_id uuid REFERENCES hub_accounts(id) ON DELETE SET NULL;
ALTER TABLE coys ADD COLUMN IF NOT EXISTS reviewed_by_account_id uuid REFERENCES hub_accounts(id) ON DELETE SET NULL;
