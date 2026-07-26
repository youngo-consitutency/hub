-- GYS Google Form CSV ingest fields on contributions.
ALTER TABLE gys_contributions
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual', 'google_form_csv')),
  ADD COLUMN IF NOT EXISTS external_id text,
  ADD COLUMN IF NOT EXISTS submitter_type text,
  ADD COLUMN IF NOT EXISTS organization text,
  ADD COLUMN IF NOT EXISTS raw_answers jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS idx_gys_contributions_cycle_external
  ON gys_contributions (cycle_id, external_id)
  WHERE external_id IS NOT NULL;
