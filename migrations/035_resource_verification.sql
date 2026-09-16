-- Link checks and member reports stay separate from public catalogue content.
CREATE TABLE resource_reviews (
  id uuid PRIMARY KEY,
  resource_slug text NOT NULL,
  fingerprint text NOT NULL,
  status text NOT NULL CHECK (status IN ('verified','needs_changes','retired')),
  note text NOT NULL,
  checks jsonb NOT NULL,
  reviewed_by uuid REFERENCES hub_accounts(id) ON DELETE SET NULL,
  reviewed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX resource_reviews_latest ON resource_reviews(resource_slug, reviewed_at DESC);
CREATE TABLE resource_issues (
  id uuid PRIMARY KEY,
  resource_slug text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('broken','outdated','tags','duplicate','other')),
  detail text NOT NULL,
  reported_by uuid REFERENCES hub_accounts(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_by uuid REFERENCES hub_accounts(id) ON DELETE SET NULL,
  resolved_at timestamptz,
  review_id uuid REFERENCES resource_reviews(id)
);
CREATE UNIQUE INDEX resource_issue_open_reporter ON resource_issues(resource_slug,reported_by) WHERE resolved_at IS NULL;
CREATE INDEX resource_issues_open ON resource_issues(created_at) WHERE resolved_at IS NULL;
