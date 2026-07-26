-- Postings organisations publish to the constituency: events, online
-- workshops, hackathons, calls and other opportunities.
CREATE TABLE IF NOT EXISTS ngo_opportunities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_account_id uuid NOT NULL REFERENCES hub_accounts(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (
    kind IN (
      'event',
      'workshop',
      'hackathon',
      'opportunity',
      'call',
      'training'
    )
  ),
  title text NOT NULL,
  summary text,
  body text,
  format text NOT NULL DEFAULT 'online' CHECK (format IN ('online', 'in_person', 'hybrid')),
  location text,
  region text,
  starts_at timestamptz,
  ends_at timestamptz,
  deadline_at timestamptz,
  link_url text,
  status text NOT NULL DEFAULT 'pending_review' CHECK (
    status IN (
      'pending_review',
      'published',
      'rejected',
      'withdrawn'
    )
  ),
  review_note text,
  reviewed_by uuid REFERENCES hub_accounts(id) ON DELETE
  SET NULL,
    reviewed_at timestamptz,
    created_by uuid REFERENCES hub_accounts(id) ON DELETE
  SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- The member-facing board reads published postings by date.
CREATE INDEX IF NOT EXISTS idx_ngo_opportunities_published ON ngo_opportunities (status, starts_at);

-- The organisation portal and the review queue both read by owner/state.
CREATE INDEX IF NOT EXISTS idx_ngo_opportunities_org ON ngo_opportunities (org_account_id, created_at DESC);

-- Trust is normally derived: an organisation with a published posting has
-- cleared review once and posts directly afterwards. A row here overrides that
-- derivation in either direction, so staff can put a misbehaving organisation
-- back into review or pre-approve a known partner.
CREATE TABLE IF NOT EXISTS ngo_opportunity_trust (
  org_account_id uuid PRIMARY KEY REFERENCES hub_accounts(id) ON DELETE CASCADE,
  state text NOT NULL CHECK (state IN ('trusted', 'review_required')),
  note text,
  updated_by uuid REFERENCES hub_accounts(id) ON DELETE
  SET NULL,
    updated_at timestamptz NOT NULL DEFAULT now()
);
