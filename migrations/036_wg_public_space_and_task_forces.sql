-- Contact Point public-page opt-in, task-force tagging on activities, and a
-- CP-facing role title on member profiles.
ALTER TABLE member_profiles
ADD COLUMN IF NOT EXISTS role_title text;

ALTER TABLE wg_activities
ADD COLUMN IF NOT EXISTS task_force_slug text;

CREATE TABLE IF NOT EXISTS wg_settings (
  wg_slug text PRIMARY KEY,
  public_space boolean NOT NULL DEFAULT false,
  updated_by uuid REFERENCES hub_accounts (id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
