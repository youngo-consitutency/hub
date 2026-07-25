-- Multi-role operational workspaces. Platform role remains for backwards compatibility;
-- team responsibilities and WG mandates are additive and independently scoped.
ALTER TABLE hub_accounts
  ADD COLUMN IF NOT EXISTS team_roles text[] NOT NULL DEFAULT '{}';

ALTER TABLE hub_accounts
  DROP CONSTRAINT IF EXISTS hub_accounts_team_roles_valid;

ALTER TABLE hub_accounts
  ADD CONSTRAINT hub_accounts_team_roles_valid CHECK (
    team_roles <@ ARRAY['membership_team', 'gys_policy_team']::text[]
  );

CREATE INDEX IF NOT EXISTS idx_hub_accounts_team_roles
  ON hub_accounts USING gin (team_roles);

-- Convert legacy broad WG Contact Point accounts into scoped assignments when
-- their selected WG interests give us a safe scope to migrate.
INSERT INTO wg_workspace_progress (
  account_id, wg_slug, presentation_ok, rules_ok, unlocked_at, status, role_in_wg
)
SELECT id, unnest(wg_interests), true, true, now(), 'active', 'contact'
FROM hub_accounts
WHERE role = 'wg_contact' AND cardinality(wg_interests) > 0
ON CONFLICT (account_id, wg_slug) DO UPDATE
SET role_in_wg = 'contact', status = 'active';
