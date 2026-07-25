-- GYS participation signups (public write path — see server/routes/public.js).
-- Standalone (no extension dependency) so it applies even if 001 is skipped.
CREATE TABLE IF NOT EXISTS gys_signups (
  id bigserial PRIMARY KEY,
  cycle text NOT NULL,
  name text NOT NULL,
  email text NOT NULL,
  country text NOT NULL,
  organization text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_gys_signups_cycle ON gys_signups(cycle, created_at DESC);