-- Public consultation floor: questions, concerns, comments, and feature ideas
-- collected during the YOUNGO Hub consultation. No account is required.
-- Display names are optional. Do not store emails, phone numbers, or IPs.

CREATE TABLE IF NOT EXISTS consultation_contributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (
    kind IN ('question', 'concern', 'comment', 'feature')
  ),
  body text NOT NULL,
  display_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_consultation_contributions_created
  ON consultation_contributions (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_consultation_contributions_kind
  ON consultation_contributions (kind, created_at DESC);
