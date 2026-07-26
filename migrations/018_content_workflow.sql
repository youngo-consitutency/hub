-- Scoped public-content drafting, independent review, and publication.
ALTER TABLE hub_accounts DROP CONSTRAINT IF EXISTS hub_accounts_team_roles_valid;
ALTER TABLE hub_accounts
ADD CONSTRAINT hub_accounts_team_roles_valid CHECK (
    team_roles <@ ARRAY [
      'membership_team',
      'gys_policy_team',
      'content_editor',
      'content_publisher'
    ]::text []
  );
CREATE TABLE IF NOT EXISTS hub_content_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_type text NOT NULL CHECK (content_type IN ('event', 'announcement')),
  content_key text NOT NULL,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (
    status IN (
      'draft',
      'in_review',
      'changes_requested',
      'approved',
      'rejected',
      'published'
    )
  ),
  created_by uuid NOT NULL REFERENCES hub_accounts(id) ON DELETE RESTRICT,
  reviewed_by uuid REFERENCES hub_accounts(id) ON DELETE
  SET NULL,
    review_note text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    submitted_at timestamptz,
    reviewed_at timestamptz,
    published_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_hub_content_revisions_queue ON hub_content_revisions (status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_hub_content_revisions_author ON hub_content_revisions (created_by, updated_at DESC);
CREATE TABLE IF NOT EXISTS hub_content_publications (
  content_type text NOT NULL CHECK (content_type IN ('event', 'announcement')),
  content_key text NOT NULL,
  payload jsonb NOT NULL,
  revision_id uuid NOT NULL REFERENCES hub_content_revisions(id) ON DELETE RESTRICT,
  published_by uuid NOT NULL REFERENCES hub_accounts(id) ON DELETE RESTRICT,
  published_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (content_type, content_key)
);
CREATE INDEX IF NOT EXISTS idx_hub_content_publications_time ON hub_content_publications (published_at DESC);