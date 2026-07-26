-- Member-submitted feedback tickets: UI/UX reports, bugs, blockers and ideas
-- raised from anywhere in the Hub.
--
-- The reporter reference is nullable and ON DELETE SET NULL so a closed account
-- never takes the team's bug history with it.
CREATE TABLE IF NOT EXISTS feedback_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_account_id uuid REFERENCES hub_accounts(id) ON DELETE
  SET NULL,
    kind text NOT NULL CHECK (
      kind IN (
        'bug',
        'ui_ux',
        'feature',
        'blocker',
        'content',
        'other'
      )
    ),
    severity text NOT NULL DEFAULT 'normal' CHECK (severity IN ('low', 'normal', 'high', 'critical')),
    title text NOT NULL,
    body text,
    -- Context captured from the browser so the team can reproduce without a
    -- follow-up conversation. No personal fields beyond the reporter link.
    page_path text,
    user_agent text,
    viewport text,
    status text NOT NULL DEFAULT 'new' CHECK (
      status IN (
        'new',
        'triaged',
        'in_progress',
        'resolved',
        'declined'
      )
    ),
    triage_note text,
    github_issue_url text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- The triage queue reads open tickets newest-first.
CREATE INDEX IF NOT EXISTS idx_feedback_tickets_status ON feedback_tickets (status, created_at DESC);

-- A member reads their own tickets from the submit dialog.
CREATE INDEX IF NOT EXISTS idx_feedback_tickets_reporter ON feedback_tickets (reporter_account_id, created_at DESC);
